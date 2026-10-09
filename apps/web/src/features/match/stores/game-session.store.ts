import type { MatchStatus } from "@bankroll/contracts";
import type { LagosPublicState } from "@bankroll/lagos-rules";
import { create } from "zustand";
import type { LagosSnapshot, LagosUpdate } from "../types";

export type ApplyOutcome = "applied" | "duplicate" | "gap" | "wrong_match";

interface GameSessionState {
  matchId: string | null;
  stateVersion: number;
  status: MatchStatus | null;
  turnDeadline: string | null;
  gameState: LagosPublicState | null;
  /** Commands sent but not yet confirmed by the server. */
  pendingCommandIds: readonly string[];
}

interface GameSessionActions {
  /** Sync layer only. Ignores snapshots older than what we already have. */
  hydrate: (snapshot: LagosSnapshot) => void;
  /** Sync layer only. Applies an update only if it is exactly the next version. */
  applyUpdate: (update: LagosUpdate) => ApplyOutcome;
  addPending: (commandId: string) => void;
  removePending: (commandId: string) => void;
  reset: () => void;
}

const initialState: GameSessionState = {
  matchId: null,
  stateVersion: 0,
  status: null,
  turnDeadline: null,
  gameState: null,
  pendingCommandIds: [],
};

export const useGameSessionStore = create<GameSessionState & GameSessionActions>()((set, get) => ({
  ...initialState,

  hydrate: (snapshot) => {
    const current = get();
    if (current.matchId === snapshot.matchId && snapshot.version < current.stateVersion) return;
    set({
      matchId: snapshot.matchId,
      stateVersion: snapshot.version,
      status: snapshot.status,
      turnDeadline: snapshot.turnDeadline,
      gameState: snapshot.state,
      pendingCommandIds: current.matchId === snapshot.matchId ? current.pendingCommandIds : [],
    });
  },

  applyUpdate: ({ snapshot, applied }) => {
    const current = get();
    if (current.matchId !== snapshot.matchId) return "wrong_match";
    if (applied.version <= current.stateVersion) return "duplicate";
    if (applied.version !== current.stateVersion + 1) return "gap";

    set({
      stateVersion: applied.version,
      status: snapshot.status,
      turnDeadline: snapshot.turnDeadline,
      gameState: snapshot.state,
      pendingCommandIds: applied.commandId
        ? current.pendingCommandIds.filter((id) => id !== applied.commandId)
        : current.pendingCommandIds,
    });
    return "applied";
  },

  addPending: (commandId) =>
    set((s) => ({ pendingCommandIds: [...s.pendingCommandIds, commandId] })),

  removePending: (commandId) =>
    set((s) => ({ pendingCommandIds: s.pendingCommandIds.filter((id) => id !== commandId) })),

  reset: () => set(initialState),
}));
