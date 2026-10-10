import {
  commandRequestSchema,
  MATCH_MESSAGE_EVENT,
  type MatchMessage,
  matchChannelName,
  sendMatchMessageSchema,
} from "@bankroll/contracts";
import { applyCommand, lagosCommandSchema, type RuleError } from "@bankroll/lagos-rules";
import { and, asc, count, desc, eq, gt, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db, type Tx } from "../db/client";
import { matchMessages, matchPlayers, profiles } from "../db/generated/schema";
import { ApiHttpError, readJson, toIso, uuidParam } from "../lib/http";
import { loadMatch, loadReceipt, requireSeated, saveMove, secureRandomInt, toSnapshot } from "../lib/matches";
import { profileColumns } from "../lib/profiles";
import { broadcast } from "../lib/realtime";
import type { AuthVariables } from "../middleware/auth";

const lagosCommandRequestSchema = commandRequestSchema(lagosCommandSchema);

const ruleErrors: Record<RuleError, string> = {
  not_your_turn: "It's not your turn",
  illegal_move: "You can't do that right now",
  not_enough_cash: "You don't have enough cash",
  match_finished: "This match has ended",
};

const MESSAGE_PAGE = 50;
const MESSAGE_BURST = 5;
const MESSAGE_WINDOW_SECONDS = 10;

async function loadMessage(executor: typeof db | Tx, id: number): Promise<MatchMessage> {
  const [row] = await executor
    .select({
      id: matchMessages.id,
      matchId: matchMessages.matchId,
      body: matchMessages.body,
      createdAt: matchMessages.createdAt,
      sender: profileColumns,
    })
    .from(matchMessages)
    .innerJoin(profiles, eq(profiles.id, matchMessages.senderId))
    .where(eq(matchMessages.id, id));
  if (!row) throw new Error("match message not found");
  return { ...row, createdAt: toIso(row.createdAt) };
}

// Only players seated in a match can see it. Removed players stay seated so
// they can keep watching.
export const matchRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/matches/:matchId", async (c) => {
    const matchId = uuidParam(c.req.param("matchId"));
    await requireSeated(db, matchId, c.get("userId"));
    const match = await loadMatch(db, matchId);
    const players = await db
      .select(profileColumns)
      .from(matchPlayers)
      .innerJoin(profiles, eq(profiles.id, matchPlayers.userId))
      .where(eq(matchPlayers.matchId, matchId))
      .orderBy(asc(matchPlayers.seat));
    return c.json({ snapshot: toSnapshot(match, match.state), players });
  })

  .post("/matches/:matchId/commands", async (c) => {
    const me = c.get("userId");
    const matchId = uuidParam(c.req.param("matchId"));
    const { commandId, command } = await readJson(c, lagosCommandRequestSchema);
    await requireSeated(db, matchId, me);

    const update = await db.transaction(async (tx) => {
      const match = await loadMatch(tx, matchId, "update");
      const receipt = await loadReceipt(tx, match, commandId);
      if (receipt) return receipt;

      const result = applyCommand(match.state, me, command, secureRandomInt);
      if (!result.ok) throw new ApiHttpError(409, result.error, ruleErrors[result.error]);
      return saveMove(tx, match, result.state, result.events, { commandId, actorId: me });
    });

    return c.json(update);
  })

  .get("/matches/:matchId/messages", async (c) => {
    const matchId = uuidParam(c.req.param("matchId"));
    await requireSeated(db, matchId, c.get("userId"));
    const rows = await db
      .select({
        id: matchMessages.id,
        matchId: matchMessages.matchId,
        body: matchMessages.body,
        createdAt: matchMessages.createdAt,
        sender: profileColumns,
      })
      .from(matchMessages)
      .innerJoin(profiles, eq(profiles.id, matchMessages.senderId))
      .where(eq(matchMessages.matchId, matchId))
      .orderBy(desc(matchMessages.id))
      .limit(MESSAGE_PAGE);
    const messages = rows.reverse().map((row) => ({ ...row, createdAt: toIso(row.createdAt) }));
    return c.json({ messages });
  })

  .post("/matches/:matchId/messages", async (c) => {
    const me = c.get("userId");
    const matchId = uuidParam(c.req.param("matchId"));
    const { body } = await readJson(c, sendMatchMessageSchema);
    await requireSeated(db, matchId, me);

    const message = await db.transaction(async (tx) => {
      // One sender's messages are handled one at a time so the limit holds
      // even when several are sent at once.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`match_chat:${matchId}:${me}`}))`);
      const [recent] = await tx
        .select({ n: count() })
        .from(matchMessages)
        .where(
          and(
            eq(matchMessages.matchId, matchId),
            eq(matchMessages.senderId, me),
            gt(matchMessages.createdAt, sql`now() - make_interval(secs => ${MESSAGE_WINDOW_SECONDS})`),
          ),
        );
      if ((recent?.n ?? 0) >= MESSAGE_BURST) {
        throw new ApiHttpError(429, "rate_limited", "Slow down a little before sending more");
      }

      const [inserted] = await tx
        .insert(matchMessages)
        .values({ matchId, senderId: me, body })
        .returning({ id: matchMessages.id });
      const message = await loadMessage(tx, inserted!.id);
      await broadcast(tx, matchChannelName(matchId), MATCH_MESSAGE_EVENT, message);
      return message;
    });

    return c.json(message, 201);
  });
