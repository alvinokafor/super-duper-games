import { useGameAnimationStore } from "./stores/game-animation.store";
import { useGameSessionStore } from "./stores/game-session.store";
import type { LagosSnapshot, LagosUpdate } from "./types";

/**
 * Puts a server update into the store. Returns false when the store could not
 * use it, either because a version was missed or because the first load has
 * not reached the store yet, so the caller can reload the full state.
 */
export function receiveUpdate(update: LagosUpdate): boolean {
  const outcome = useGameSessionStore.getState().applyUpdate(update);
  if (outcome === "applied") useGameAnimationStore.getState().enqueue(update.applied.version, update.applied.events);
  return outcome === "applied" || outcome === "duplicate";
}

/** Loads a full snapshot into the store and drops animations it has made stale. */
export function receiveSnapshot(snapshot: LagosSnapshot) {
  if (useGameSessionStore.getState().hydrate(snapshot)) useGameAnimationStore.getState().clear();
}
