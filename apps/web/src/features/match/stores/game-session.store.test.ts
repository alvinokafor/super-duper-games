import { emptyBuildings } from "@bankroll/lagos-rules";
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
    owners: Array.from({ length: 28 }, () => null),
    buildings: emptyBuildings(),
    winnerIds: null,
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
    expect(store().hydrate(snapshot(3))).toBe(false);
    expect(store().stateVersion).toBe(6);
  });

  it("says whether a snapshot moved the board ahead", () => {
    expect(store().hydrate(snapshot(5))).toBe(false);
    expect(store().hydrate(snapshot(7))).toBe(true);
    store().reset();
    expect(store().hydrate(snapshot(0))).toBe(true);
  });

  it("takes a newer board carried by a duplicate", () => {
    const retry = update(4);
    retry.snapshot = snapshot(9, 9);
    expect(store().applyUpdate(retry)).toBe("duplicate");
    expect(store().stateVersion).toBe(9);
    expect(store().gameState?.round).toBe(9);
  });

  it("reports an empty store as the wrong match", () => {
    store().reset();
    expect(store().applyUpdate(update(1))).toBe("wrong_match");
  });

  it("clears a pending command once the server confirms it", () => {
    store().addPending("cmd-1");
    store().applyUpdate(update(6, "cmd-1"));
    expect(store().pendingCommandIds).toEqual([]);
  });
});
