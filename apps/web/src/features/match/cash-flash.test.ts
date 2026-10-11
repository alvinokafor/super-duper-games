import type { LagosEvent, LagosPlayer } from "@bankroll/lagos-rules";
import { describe, expect, it } from "vitest";
import { addFlashes, cashChanges, expireFlashes, shownCash } from "./cash-flash";

const players = [
  { id: "a", cash: 70_000 },
  { id: "b", cash: 80_000 },
] as LagosPlayer[];
const queued = (...events: LagosEvent[]) => events.map((event, i) => ({ key: `1:${i}`, event }));

describe("cashChanges", () => {
  it("moves money for payday, rent, buying and building", () => {
    expect(cashChanges({ type: "payday", playerId: "a", income: 3_000, costs: 400, amount: 2_600 })).toEqual([["a", 2_600]]);
    expect(cashChanges({ type: "rent_paid", playerId: "a", ownerId: "b", space: 13, amount: 4_200, owed: 4_200 })).toEqual([
      ["a", -4_200],
      ["b", 4_200],
    ]);
    expect(cashChanges({ type: "property_bought", playerId: "a", space: 1, price: 9_000 })).toEqual([["a", -9_000]]);
    expect(cashChanges({ type: "building_built", playerId: "a", space: 1, building: "shop", cost: 4_500, replaced: null })).toEqual([
      ["a", -4_500],
    ]);
  });

  it("ignores events that move no money", () => {
    expect(cashChanges({ type: "payday", playerId: "a", income: 0, costs: 0, amount: 0 })).toEqual([]);
    expect(cashChanges({ type: "rent_paid", playerId: "a", ownerId: "b", space: 13, amount: 0, owed: 4_200 })).toEqual([]);
    expect(cashChanges({ type: "turn_started", playerId: "a", round: 1 })).toEqual([]);
  });
});

describe("addFlashes and expireFlashes", () => {
  const rent = { key: "4:2", event: { type: "rent_paid", playerId: "a", ownerId: "b", space: 13, amount: 4_200, owed: 4_200 } } as const;
  const payday = { key: "5:2", event: { type: "payday", playerId: "a", income: 3_000, costs: 400, amount: 2_600 } } as const;

  it("tags everyone an event paid or charged", () => {
    expect(addFlashes(new Map(), rent)).toEqual(
      new Map([
        ["a", { key: "4:2", delta: -4_200 }],
        ["b", { key: "4:2", delta: 4_200 }],
      ]),
    );
  });

  it("adds no tags for events that move no money", () => {
    expect(addFlashes(new Map(), { key: "4:0", event: { type: "turn_started", playerId: "a", round: 1 } })).toEqual(new Map());
  });

  it("lets a newer tag replace an older one, and keeps it when the older one expires", () => {
    const both = addFlashes(addFlashes(new Map(), rent), payday);
    expect(both.get("a")).toEqual({ key: "5:2", delta: 2_600 });
    const later = expireFlashes(both, "4:2");
    expect(later).toEqual(new Map([["a", { key: "5:2", delta: 2_600 }]]));
    expect(expireFlashes(later, "5:2")).toEqual(new Map());
  });
});

describe("shownCash", () => {
  it("shows the server's cash when nothing is waiting", () => {
    expect(shownCash(players, [])).toEqual(new Map([["a", 70_000], ["b", 80_000]]));
  });

  it("holds back rent until the walk before it has played", () => {
    const queue = queued(
      { type: "dice_rolled", playerId: "a", value: 3 },
      { type: "token_moved", playerId: "a", from: 10, to: 13, passedGo: false },
      { type: "rent_paid", playerId: "a", ownerId: "b", space: 13, amount: 4_200, owed: 4_200 },
    );
    expect(shownCash(players, queue)).toEqual(new Map([["a", 74_200], ["b", 75_800]]));
    expect(shownCash(players, queue.slice(2))).toEqual(new Map([["a", 70_000], ["b", 80_000]]));
  });
});
