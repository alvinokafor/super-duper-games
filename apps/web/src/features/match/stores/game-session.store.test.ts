import { beforeEach, describe, expect, it } from "vitest";
import type { LagosSnapshot, LagosUpdate } from "../types";
import { useGameSessionStore } from "./game-session.store";

const matchId = "00000000-0000-4000-8000-000000000001";

const snapshot = (version: number, round = 1): LagosSnapshot => ({
  matchId,
  gameId: "lagos-property",
  status: "active",
  version,
  turnDeadline: null,
  state: {
    round,
    maxRounds: 24,
    currentPlayerId: "a",
    phase: "awaiting_roll",
    lastRoll: null,
    players: [],
  },
});

const update = (version: number, commandId: string | null = null): LagosUpdate => ({
  snapshot: snapshot(version, version),
  applied: { matchId, version, commandId, events: [], createdAt: new Date().toISOString() },
});

const store = () => useGameSessionStore.getState();

describe("game session store", () => {
  beforeEach(() => {
    store().reset();
    store().hydrate(snapshot(5));
  });

  it("applies the next version", () => {
    expect(store().applyUpdate(update(6))).toBe("applied");
    expect(store().stateVersion).toBe(6);
  });

  it("ignores duplicates", () => {
    store().applyUpdate(update(6));
    expect(store().applyUpdate(update(6))).toBe("duplicate");
    expect(store().applyUpdate(update(4))).toBe("duplicate");
    expect(store().stateVersion).toBe(6);
  });

  it("reports a gap and does not apply it", () => {
    expect(store().applyUpdate(update(8))).toBe("gap");
    expect(store().stateVersion).toBe(5);
  });

  it("ignores updates for another match", () => {
    const other = update(6);
    other.snapshot.matchId = "00000000-0000-4000-8000-000000000002";
    expect(store().applyUpdate(other)).toBe("wrong_match");
  });

  it("does not go back to an older snapshot", () => {
    store().applyUpdate(update(6));
    store().hydrate(snapshot(3));
    expect(store().stateVersion).toBe(6);
  });

  it("clears a pending command once the server confirms it", () => {
    store().addPending("cmd-1");
    store().applyUpdate(update(6, "cmd-1"));
    expect(store().pendingCommandIds).toEqual([]);
  });
});
