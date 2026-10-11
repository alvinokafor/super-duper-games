import type { LagosEvent } from "@bankroll/lagos-rules";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { QueuedAnimation } from "./stores/game-animation.store";
import { planFront, STEP_MS, shownPositions, startWalk, walkPath } from "./token-walk";

const moved = (key: string, playerId: string, from: number, to: number): QueuedAnimation => ({
  key,
  event: { type: "token_moved", playerId, from, to, passedGo: to < from },
});
const other = (key: string, event: LagosEvent): QueuedAnimation => ({ key, event });

const players = [
  { id: "a", position: 9 },
  { id: "b", position: 4 },
];

describe("walkPath", () => {
  it("steps onto every tile up to the landing tile", () => {
    expect(walkPath(3, 7)).toEqual([4, 5, 6, 7]);
  });

  it("wraps past GO", () => {
    expect(walkPath(26, 2)).toEqual([27, 0, 1, 2]);
  });
});

describe("planFront", () => {
  const dice = (key: string) => other(key, { type: "dice_rolled", playerId: "a", value: 3 });

  it("has nothing to play on an empty queue", () => {
    expect(planFront([], false, "me")).toBeNull();
  });

  it("shows the die, then walks", () => {
    expect(planFront([dice("1:0"), moved("1:1", "a", 0, 3)], false, "me")).toBe("dice");
    expect(planFront([moved("1:1", "a", 0, 3)], false, "me")).toBe("walk");
  });

  it("skips a die or walk when a later one is already waiting", () => {
    const queue = [dice("1:0"), moved("1:1", "a", 0, 3), dice("2:0"), moved("2:1", "b", 4, 6)];
    expect(planFront(queue, false, "me")).toBe("instant");
    expect(planFront(queue.slice(1), false, "me")).toBe("instant");
  });

  it("plays everything at once while the page is hidden", () => {
    expect(planFront([dice("1:0"), moved("1:1", "a", 0, 3)], true, "me")).toBe("instant");
    expect(planFront([moved("1:1", "a", 0, 3)], true, "me")).toBe("instant");
  });

  it("shows rent and other players' builds as a notice, but not my own builds", () => {
    const rent = other("1:3", { type: "rent_paid", playerId: "a", ownerId: "b", space: 10, amount: 2_000, owed: 2_000 });
    const built = (playerId: string) =>
      other("2:0", { type: "building_built", playerId, space: 1, building: "shop", cost: 4_500, replaced: null });
    expect(planFront([rent], false, "me")).toBe("notice");
    expect(planFront([built("b")], false, "me")).toBe("notice");
    expect(planFront([built("me")], false, "me")).toBe("instant");
  });

  it("skips a notice once another roll is waiting", () => {
    const rent = other("1:3", { type: "rent_paid", playerId: "a", ownerId: "b", space: 10, amount: 2_000, owed: 2_000 });
    expect(planFront([rent, dice("2:0")], false, "me")).toBe("instant");
  });

  it("plays other events at once", () => {
    expect(planFront([other("1:2", { type: "turn_started", playerId: "b", round: 1 })], false, "me")).toBe("instant");
  });
});

describe("startWalk", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("steps one tile at a time and finishes one step after landing", () => {
    vi.useFakeTimers();
    const steps: number[] = [];
    const done = vi.fn();
    startWalk([4, 5, 6], (at) => steps.push(at), done);

    vi.advanceTimersByTime(STEP_MS);
    expect(steps).toEqual([4]);
    vi.advanceTimersByTime(STEP_MS * 2);
    expect(steps).toEqual([4, 5, 6]);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(STEP_MS);
    expect(done).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(STEP_MS * 4);
    expect(steps).toEqual([4, 5, 6]);
  });

  it("stops when cancelled", () => {
    vi.useFakeTimers();
    const steps: number[] = [];
    const done = vi.fn();
    const stop = startWalk([4, 5, 6], (at) => steps.push(at), done);
    vi.advanceTimersByTime(STEP_MS);
    stop();
    vi.advanceTimersByTime(STEP_MS * 10);
    expect(steps).toEqual([4]);
    expect(done).not.toHaveBeenCalled();
  });
});

describe("shownPositions", () => {
  it("shows where the store says when nothing is waiting", () => {
    expect(shownPositions(players, [], null)).toEqual(new Map([["a", 9], ["b", 4]]));
  });

  it("keeps a piece at its start while the die is still showing", () => {
    const queue = [other("1:0", { type: "dice_rolled", playerId: "a", value: 4 }), moved("1:1", "a", 5, 9)];
    expect(shownPositions(players, queue, null).get("a")).toBe(5);
  });

  it("follows the walk while the piece is moving", () => {
    const queue = [moved("1:1", "a", 5, 9)];
    expect(shownPositions(players, queue, { key: "1:1", playerId: "a", at: 7 }).get("a")).toBe(7);
  });

  it("ignores a walk that is no longer playing, such as after a reload", () => {
    expect(shownPositions(players, [], { key: "1:1", playerId: "a", at: 7 }).get("a")).toBe(9);
  });

  it("uses the earliest waiting move when a piece has several", () => {
    const queue = [moved("1:1", "b", 0, 2), moved("2:1", "b", 2, 4)];
    expect(shownPositions(players, queue, null).get("b")).toBe(0);
  });
});
