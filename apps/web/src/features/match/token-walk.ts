import { BOARD_SIZE, type LagosPlayer } from "@bankroll/lagos-rules";
import type { QueuedAnimation } from "./stores/game-animation.store";

/** How long the die stays on screen. */
export const DICE_MS = 1500;
/** How long a piece takes to step onto the next tile. */
export const STEP_MS = 250;

/** A piece part-way through its walk: the move it belongs to and the tile it is on. */
export interface Walk {
  key: string;
  playerId: string;
  at: number;
}

/** How long a rent or build notice stays on the board. */
export const NOTICE_MS = 1800;

/** How to show the event at the front of the queue. */
export type Play = "dice" | "walk" | "notice" | "instant";

/**
 * Only the latest die and the latest walk are worth showing. When a later
 * one is already queued, this phone is behind, so it skips ahead; notices
 * are skipped once another roll is waiting. My own builds need no notice,
 * since I just tapped them. Nothing is shown while the page is hidden,
 * since timers crawl in background tabs.
 */
export function planFront(queue: readonly QueuedAnimation[], hidden: boolean, myId: string): Play | null {
  const front = queue[0];
  if (!front) return null;
  if (hidden) return "instant";
  const event = front.event;
  const later = (type: string) => queue.slice(1).some((a) => a.event.type === type);
  if (event.type === "dice_rolled" && !later("dice_rolled")) return "dice";
  if (event.type === "token_moved" && !later("token_moved")) return "walk";
  const notice = event.type === "rent_paid" || (event.type === "building_built" && event.playerId !== myId);
  if (notice && !later("dice_rolled")) return "notice";
  return "instant";
}

/** The tiles a piece steps onto, in order, ending where it lands. */
export function walkPath(from: number, to: number): number[] {
  const steps = (to - from + BOARD_SIZE) % BOARD_SIZE;
  return Array.from({ length: steps }, (_, i) => (from + i + 1) % BOARD_SIZE);
}

/**
 * Steps a piece along `path`, one tile every STEP_MS, and calls `onDone` one
 * step after it lands so the landing is seen. Returns a function that stops it.
 */
export function startWalk(path: readonly number[], onStep: (at: number) => void, onDone: () => void): () => void {
  let step = 0;
  const timer = setInterval(() => {
    const at = path[step++];
    if (at !== undefined) return onStep(at);
    clearInterval(timer);
    onDone();
  }, STEP_MS);
  return () => clearInterval(timer);
}

/**
 * Where each piece should be drawn right now. The store already holds where
 * pieces end up, so a piece with a move still waiting to play stays where
 * that move starts, and the walking piece is wherever its walk has reached.
 */
export function shownPositions(
  players: readonly Pick<LagosPlayer, "id" | "position">[],
  queue: readonly QueuedAnimation[],
  walk: Walk | null,
): Map<string, number> {
  const walking = walk && queue[0]?.key === walk.key ? walk : null;
  return new Map(
    players.map((p) => {
      if (walking?.playerId === p.id) return [p.id, walking.at];
      const waiting = queue.find((a) => a.event.type === "token_moved" && a.event.playerId === p.id);
      return [p.id, waiting?.event.type === "token_moved" ? waiting.event.from : p.position];
    }),
  );
}
