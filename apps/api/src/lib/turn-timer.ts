import { applyTimeout } from "@bankroll/lagos-rules";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { db } from "../db/client";
import { matches } from "../db/generated/schema";
import { type MatchRow, saveMove, secureRandomInt } from "./matches";

const TICK_MS = 1000;
const BATCH = 20;

/**
 * Plays the default move for every match whose turn deadline has passed.
 * Each match gets its own short transaction. Rows another server copy (or a
 * player's command) has locked are skipped and picked up on a later tick.
 */
async function playOverdueTurns() {
  const due = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.status, "active"), lte(matches.turnDeadline, sql`now()`)))
    .orderBy(asc(matches.turnDeadline))
    .limit(BATCH);

  for (const { id } of due) {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select({
          id: matches.id,
          gameId: matches.gameId,
          status: matches.status,
          version: matches.version,
          state: matches.state,
          turnDeadline: matches.turnDeadline,
        })
        .from(matches)
        .where(and(eq(matches.id, id), eq(matches.status, "active"), lte(matches.turnDeadline, sql`now()`)))
        .for("update", { skipLocked: true });
      if (!row) return;

      const match = row as MatchRow;
      const result = applyTimeout(match.state, secureRandomInt);
      if (!result.ok) return;
      await saveMove(tx, match, result.state, result.events, { commandId: null, actorId: null });
    });
  }
}

export function startTurnTimer(): () => void {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await playOverdueTurns();
    } catch (err) {
      console.error("turn timer failed", err);
    } finally {
      running = false;
    }
  }, TICK_MS);
  return () => clearInterval(timer);
}
