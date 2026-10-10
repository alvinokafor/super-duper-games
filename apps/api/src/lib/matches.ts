import { randomInt } from "node:crypto";
import {
  MATCH_EVENT,
  matchChannelName,
  matchUpdateSchema,
  ROOM_CHANGED_EVENT,
  roomChannelName,
} from "@bankroll/contracts";
import {
  type LagosEvent,
  type LagosState,
  lagosEventSchema,
  lagosPublicStateSchema,
  netWorth,
  PHASE_SECONDS,
  type RandomInt,
  toPublicView,
} from "@bankroll/lagos-rules";
import { and, eq, type SQL, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Db, Tx } from "../db/client";
import { matchEvents, matches, matchPlayers, matchResults, matchStates, rooms } from "../db/generated/schema";
import { notFound, toIso } from "./http";
import { broadcast } from "./realtime";

const lagosUpdateSchema = matchUpdateSchema(lagosPublicStateSchema, lagosEventSchema);
export type LagosUpdate = z.infer<typeof lagosUpdateSchema>;
export type LagosSnapshot = LagosUpdate["snapshot"];

export interface MatchRow {
  id: string;
  gameId: string;
  status: string;
  version: number;
  state: LagosState;
  turnDeadline: string | null;
}

const matchColumns = {
  id: matches.id,
  gameId: matches.gameId,
  status: matches.status,
  version: matches.version,
  state: matches.state,
  turnDeadline: matches.turnDeadline,
};

export async function loadMatch(executor: Db | Tx, matchId: string, lock: "none" | "update" = "none") {
  const query = executor.select(matchColumns).from(matches).where(eq(matches.id, matchId));
  const [row] = lock === "update" ? await query.for("update") : await query;
  if (!row) throw notFound("Match not found");
  return row as MatchRow;
}

export async function requireSeated(executor: Db | Tx, matchId: string, userId: string) {
  const [seat] = await executor
    .select({ seat: matchPlayers.seat })
    .from(matchPlayers)
    .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.userId, userId)));
  if (!seat) throw notFound("Match not found");
}

export function toSnapshot(row: Pick<MatchRow, "id" | "gameId" | "status" | "version" | "turnDeadline">, state: LagosState): LagosSnapshot {
  return {
    matchId: row.id,
    gameId: row.gameId,
    status: row.status === "finished" || row.status === "abandoned" ? row.status : "active",
    version: row.version,
    turnDeadline: row.turnDeadline ? toIso(row.turnDeadline) : null,
    state: toPublicView(state),
  };
}

/** Dice and shuffles must come from a secure source so rolls can't be predicted. */
export const secureRandomInt: RandomInt = (max) => randomInt(max);

/**
 * The turn deadline, worked out by the database clock. The turn timer
 * compares against the same clock, so the API server's clock never matters.
 */
export function deadlineFor(state: LagosState): SQL | null {
  const phase = state.public.phase;
  if (phase === "finished") return null;
  return sql`now() + make_interval(secs => ${PHASE_SECONDS[phase]})`;
}

/**
 * Saves one accepted move: bumps the version, keeps a full copy of the state,
 * logs the events and sends the update on the match channel. Must run inside
 * the transaction that locked the match row.
 */
export async function saveMove(
  tx: Tx,
  match: MatchRow,
  next: LagosState,
  events: LagosEvent[],
  meta: { commandId: string | null; actorId: string | null },
): Promise<LagosUpdate> {
  const version = match.version + 1;
  const finished = next.public.phase === "finished";

  const [saved] = await tx
    .update(matches)
    .set({
      version,
      state: next,
      turnDeadline: deadlineFor(next),
      status: finished ? "finished" : "active",
      updatedAt: sql`now()`,
      finishedAt: finished ? sql`now()` : null,
    })
    .where(eq(matches.id, match.id))
    .returning({ roomId: matches.roomId, turnDeadline: matches.turnDeadline });
  await tx.insert(matchStates).values({ matchId: match.id, version, state: next });
  const [logged] = await tx
    .insert(matchEvents)
    .values({ matchId: match.id, version, commandId: meta.commandId, actorId: meta.actorId, events })
    .returning({ createdAt: matchEvents.createdAt });

  if (finished) {
    await saveResults(tx, match.id, next);
    await tx.update(rooms).set({ status: "closed" }).where(eq(rooms.id, saved!.roomId));
    await broadcast(tx, roomChannelName(saved!.roomId), ROOM_CHANGED_EVENT);
  }

  const update: LagosUpdate = {
    snapshot: toSnapshot(
      { ...match, version, status: finished ? "finished" : "active", turnDeadline: saved!.turnDeadline },
      next,
    ),
    applied: {
      matchId: match.id,
      version,
      commandId: meta.commandId,
      events,
      createdAt: toIso(logged!.createdAt),
    },
  };
  await broadcast(tx, matchChannelName(match.id), MATCH_EVENT, update);
  return update;
}

/** The saved answer for a command id that was already handled. */
export async function loadReceipt(tx: Tx, match: MatchRow, commandId: string): Promise<LagosUpdate | null> {
  const [receipt] = await tx
    .select({ version: matchEvents.version, events: matchEvents.events, createdAt: matchEvents.createdAt })
    .from(matchEvents)
    .where(and(eq(matchEvents.matchId, match.id), eq(matchEvents.commandId, commandId)));
  if (!receipt) return null;

  // Reply with the latest state so a retry never rolls the phone back.
  return {
    snapshot: toSnapshot(match, match.state),
    applied: {
      matchId: match.id,
      version: receipt.version,
      commandId,
      events: receipt.events as LagosEvent[],
      createdAt: toIso(receipt.createdAt),
    },
  };
}

// Players still in the game rank above removed ones; then net worth, then cash.
async function saveResults(tx: Tx, matchId: string, state: LagosState) {
  const scored = state.public.players.map((p) => ({
    id: p.id,
    playing: p.status === "playing" ? 1 : 0,
    worth: netWorth(state.public, p.id),
    cash: p.cash,
  }));
  const better = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
    a.playing !== b.playing ? a.playing > b.playing : a.worth !== b.worth ? a.worth > b.worth : a.cash > b.cash;

  await tx.insert(matchResults).values(
    scored.map((p) => ({
      matchId,
      userId: p.id,
      rank: 1 + scored.filter((other) => better(other, p)).length,
      score: p.worth,
    })),
  );
}
