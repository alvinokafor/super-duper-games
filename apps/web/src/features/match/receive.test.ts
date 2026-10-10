import { beforeEach, describe, expect, it } from "vitest";
import { receiveSnapshot, receiveUpdate } from "./receive";
import { useGameAnimationStore } from "./stores/game-animation.store";
import { useGameSessionStore } from "./stores/game-session.store";
import type { LagosSnapshot, LagosUpdate } from "./types";

const matchId = "00000000-0000-4000-8000-000000000001";

const snapshot = (version: number): LagosSnapshot => ({
  matchId,
  gameId: "lagos-property",
  status: "active",
  version,
  turnDeadline: null,
  state: {
    round: version + 1,
    maxRounds: 48,
    currentPlayerId: "a",
    phase: "awaiting_roll",
    lastRoll: null,
    players: [],
    owners: Array.from({ length: 28 }, () => null),
    winnerIds: null,
  },
});

const update = (applied: number, latest = applied): LagosUpdate => ({
  snapshot: snapshot(latest),
  applied: {
    matchId,
    version: applied,
    commandId: null,
    events: [{ type: "dice_rolled", playerId: "a", value: 3 }],
    createdAt: new Date().toISOString(),
  },
});

const session = () => useGameSessionStore.getState();
const queue = () => useGameAnimationStore.getState().queue;

describe("receiving match updates", () => {
  beforeEach(() => {
    session().reset();
    useGameAnimationStore.getState().clear();
  });

  it("asks for a reload when a live move arrives before the first load", () => {
    expect(receiveUpdate(update(1))).toBe(false);
    expect(session().gameState).toBeNull();
    expect(queue()).toEqual([]);
  });

  it("applies the next move and queues its animations", () => {
    receiveSnapshot(snapshot(0));
    expect(receiveUpdate(update(1))).toBe(true);
    expect(session().stateVersion).toBe(1);
    expect(queue()).toHaveLength(1);
  });

  it("asks for a reload when a move was missed", () => {
    receiveSnapshot(snapshot(0));
    expect(receiveUpdate(update(2))).toBe(false);
    expect(session().stateVersion).toBe(0);
  });

  it("takes the newer board from a retry reply that confirms an old move", () => {
    receiveSnapshot(snapshot(3));
    expect(receiveUpdate(update(2, 5))).toBe(true);
    expect(session().stateVersion).toBe(5);
    expect(session().gameState?.round).toBe(6);
    expect(queue()).toEqual([]);
  });

  it("never rolls back to an older board from a retry reply", () => {
    receiveSnapshot(snapshot(5));
    expect(receiveUpdate(update(2, 4))).toBe(true);
    expect(session().stateVersion).toBe(5);
  });

  it("drops queued animations when a reload jumps the board ahead", () => {
    receiveSnapshot(snapshot(0));
    receiveUpdate(update(1));
    receiveSnapshot(snapshot(1));
    expect(queue()).toHaveLength(1);
    receiveSnapshot(snapshot(4));
    expect(queue()).toEqual([]);
  });
});
