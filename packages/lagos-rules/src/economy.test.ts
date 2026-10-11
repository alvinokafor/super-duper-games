import { describe, expect, it } from "vitest";
import { BOARD, corridorSpaces } from "./board";
import { buildingStats } from "./buildings";
import { STARTING_CASH } from "./constants";
import { checkBuild, netWorth, payday, rentDue } from "./economy";
import { applyCommand, applyTimeout, createMatch, type RandomInt, sameTurnStep } from "./engine";
import type { LagosCommand, LagosState } from "./schemas";

const rolls = (face: number): RandomInt => () => face - 1;
const MAKOKO = 1;
const AJEGUNLE = 2;
const MUSHIN = 3;
const YABA = 13;
const BANANA = 27;
const RAILWAY = 10;
const REFINERY = 18;
const AIRPORT = 23;

/** Seat order a, b, c; a to move, ready to build. */
function setup(): LagosState {
  const state = createMatch({ playerIds: ["a", "b", "c"], randomInt: () => 0 });
  state.public.players = state.public.players
    .map((p) => ({ ...p, seat: ["a", "b", "c"].indexOf(p.id) }))
    .sort((x, y) => x.seat - y.seat);
  state.public.currentPlayerId = "a";
  state.public.phase = "awaiting_action";
  return state;
}

const own = (state: LagosState, id: string, ...spaces: number[]) => {
  for (const s of spaces) state.public.owners[s] = id;
  return state;
};
const cash = (state: LagosState, id: string) => state.public.players.find((p) => p.id === id)!.cash;
const build = (state: LagosState, space: number, building: Extract<LagosCommand, { type: "build" }>["building"]) =>
  applyCommand(state, "a", { type: "build", space, building }, rolls(1));
function ok(result: ReturnType<typeof applyCommand>): LagosState {
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe("area prices", () => {
  it("scales buildings by corridor tier", () => {
    expect(buildingStats("shop", "mainland_central")).toEqual({ cost: 6_000, income: 2_600, rent: 0, maintenance: 400 });
    expect(buildingStats("shop", "mainland_low_cost")).toEqual({ cost: 4_500, income: 2_080, rent: 0, maintenance: 300 });
    expect(buildingStats("basic_house", "island_elite").rent).toBe(9_660);
    expect(buildingStats("hotel", "lekki")).toEqual({ cost: 49_300, income: 10_150, rent: 9_300, maintenance: 2_900 });
  });
});

describe("building", () => {
  it("builds a shop with one of three and charges the area price", () => {
    const state = ok(build(own(setup(), "a", MAKOKO), MAKOKO, "shop"));
    expect(state.public.buildings[MAKOKO]).toEqual({ commercial: "shop", residential: null, hotel: false });
    expect(cash(state, "a")).toBe(STARTING_CASH - 4_500);
  });

  it("needs two of three for houses and offices, and all three for hotels", () => {
    const one = own(setup(), "a", YABA);
    expect(checkBuild(one.public, "a", YABA, "basic_house")).toEqual({ ok: false, reason: "locked", needs: 2 });
    const two = own(setup(), "a", ...corridorSpaces("mainland_central").slice(0, 2));
    expect(checkBuild(two.public, "a", corridorSpaces("mainland_central")[0]!, "office").ok).toBe(true);
    expect(checkBuild(two.public, "a", corridorSpaces("mainland_central")[0]!, "hotel")).toMatchObject({ reason: "locked", needs: 3 });
  });

  it("goes straight to any unlocked building", () => {
    const state = ok(build(own(setup(), "a", MAKOKO, AJEGUNLE, MUSHIN), MAKOKO, "skyscraper"));
    expect(state.public.buildings[MAKOKO]!.commercial).toBe("skyscraper");
  });

  it("charges the difference plus 10% to upgrade, and won't go down", () => {
    let state = own(setup(), "a", MAKOKO, AJEGUNLE);
    state = ok(build(state, MAKOKO, "shop"));
    const before = cash(state, "a");
    state = ok(build(state, MAKOKO, "office"));
    const diff = buildingStats("office", "mainland_low_cost").cost - 4_500;
    expect(cash(state, "a")).toBe(before - diff - Math.round(diff * 0.1));
    expect(state.public.buildings[MAKOKO]!.commercial).toBe("office");
    expect(checkBuild(state.public, "a", MAKOKO, "shop")).toEqual({ ok: false, reason: "lower" });
    expect(checkBuild(state.public, "a", MAKOKO, "office")).toEqual({ ok: false, reason: "built" });
  });

  it("keeps the corridor even", () => {
    let state = own(setup(), "a", MAKOKO, AJEGUNLE);
    state = ok(build(state, MAKOKO, "shop"));
    expect(checkBuild(state.public, "a", MAKOKO, "basic_house")).toEqual({ ok: false, reason: "uneven" });
    state = ok(build(state, AJEGUNLE, "shop"));
    expect(checkBuild(state.public, "a", MAKOKO, "basic_house").ok).toBe(true);
    // Upgrading in place doesn't add a building, so it is always even.
    expect(checkBuild(state.public, "a", MAKOKO, "office").ok).toBe(true);
  });

  it("allows several builds in one turn", () => {
    let state = own(setup(), "a", MAKOKO, AJEGUNLE, MUSHIN);
    for (const s of [MAKOKO, AJEGUNLE, MUSHIN]) state = ok(build(state, s, "shop"));
    expect([MAKOKO, AJEGUNLE, MUSHIN].every((s) => state.public.buildings[s]!.commercial === "shop")).toBe(true);
  });

  it("keeps the turn clock running through builds, but not past the end of the turn", () => {
    const before = own(setup(), "a", MAKOKO);
    const built = ok(build(before, MAKOKO, "shop"));
    expect(sameTurnStep(before.public, built.public)).toBe(true);
    const ended = ok(applyCommand(built, "a", { type: "end_turn" }, rolls(1)));
    expect(sameTurnStep(built.public, ended.public)).toBe(false);
  });

  it("refuses land you don't own, utilities, the wrong phase and empty pockets", () => {
    const state = own(setup(), "b", MAKOKO);
    expect(build(state, MAKOKO, "shop")).toEqual({ ok: false, error: "illegal_move" });
    expect(build(own(setup(), "a", RAILWAY), RAILWAY, "shop")).toEqual({ ok: false, error: "illegal_move" });
    const rolling = own(setup(), "a", MAKOKO);
    rolling.public.phase = "awaiting_roll";
    expect(build(rolling, MAKOKO, "shop")).toEqual({ ok: false, error: "illegal_move" });
    const poor = own(setup(), "a", MAKOKO);
    poor.public.players[0]!.cash = 100;
    expect(build(poor, MAKOKO, "shop")).toEqual({ ok: false, error: "not_enough_cash" });
  });
});

describe("rent and fees", () => {
  /** b owns `space`; a rolls from just behind it. */
  function landOnOwned(state: LagosState, space: number) {
    state.public.phase = "awaiting_roll";
    state.public.players[0]!.position = space - 1;
    return ok(applyCommand(state, "a", { type: "roll_dice" }, rolls(1)));
  }

  it("charges nothing for bare land", () => {
    const state = landOnOwned(own(setup(), "b", YABA), YABA);
    expect(cash(state, "a")).toBe(STARTING_CASH);
  });

  it("charges house rent plus the hotel fee, at area prices, to the owner", () => {
    const state = own(setup(), "b", BANANA);
    state.public.buildings[BANANA] = { commercial: "shop", residential: "duplex", hotel: true };
    const due = buildingStats("duplex", "island_elite").rent + buildingStats("hotel", "island_elite").rent;
    expect(rentDue(state.public, BANANA, "a")).toBe(due);
    const after = landOnOwned(state, BANANA);
    expect(cash(after, "a")).toBe(STARTING_CASH - due);
    expect(cash(after, "b")).toBe(STARTING_CASH + due);
  });

  it("charges utility fees by how many utilities the owner holds", () => {
    expect(rentDue(own(setup(), "b", RAILWAY).public, RAILWAY, "a")).toBe(2_000);
    expect(rentDue(own(setup(), "b", RAILWAY, AIRPORT).public, RAILWAY, "a")).toBe(5_000);
    expect(rentDue(own(setup(), "b", RAILWAY, AIRPORT, REFINERY).public, RAILWAY, "a")).toBe(9_000);
  });

  it("never charges the owner", () => {
    const state = own(setup(), "a", RAILWAY);
    expect(rentDue(state.public, RAILWAY, "a")).toBe(0);
  });

  it("takes all the payer's cash when they can't cover it and forgives the rest", () => {
    const state = own(setup(), "b", RAILWAY);
    state.public.players[0]!.cash = 500;
    state.public.phase = "awaiting_roll";
    state.public.players[0]!.position = RAILWAY - 1;
    const result = applyCommand(state, "a", { type: "roll_dice" }, rolls(1));
    if (!result.ok) throw new Error(result.error);
    expect(cash(result.state, "a")).toBe(0);
    expect(cash(result.state, "b")).toBe(STARTING_CASH + 500);
    expect(result.events).toContainEqual({ type: "rent_paid", playerId: "a", ownerId: "b", space: RAILWAY, amount: 500, owed: 2_000 });
  });
});

describe("payday and net worth", () => {
  it("pays business and hotel income minus upkeep on every building", () => {
    const state = own(setup(), "a", YABA);
    state.public.buildings[YABA] = { commercial: "office", residential: "duplex", hotel: true };
    const pay = payday(state.public, "a");
    expect(pay.income).toBe(7_100 + 7_000);
    expect(pay.costs).toBe(1_300 + 650 + 2_000);
    expect(pay.amount).toBe(pay.income - pay.costs);
  });

  it("never takes money at GO", () => {
    const state = own(setup(), "a", YABA);
    state.public.buildings[YABA] = { commercial: null, residential: "duplex", hotel: false };
    expect(payday(state.public, "a")).toEqual({ income: 0, costs: 650, amount: 0 });
  });

  it("pays out when passing GO", () => {
    const state = own(setup(), "a", YABA);
    state.public.buildings[YABA] = { commercial: "shop", residential: null, hotel: false };
    state.public.phase = "awaiting_roll";
    state.public.players[0]!.position = BOARD.length - 1;
    const after = ok(applyCommand(state, "a", { type: "roll_dice" }, rolls(2)));
    expect(cash(after, "a")).toBe(STARTING_CASH + 2_600 - 400);
  });

  it("counts 70% of what buildings cost in net worth", () => {
    const state = own(setup(), "a", YABA);
    state.public.buildings[YABA] = { commercial: "shop", residential: null, hotel: false };
    expect(netWorth(state.public, "a")).toBe(STARTING_CASH + 20_000 + 4_200);
  });
});

describe("old saves and removal", () => {
  it("reads a match saved before buildings existed", () => {
    const state = own(setup(), "a", MAKOKO);
    delete (state.public as Partial<typeof state.public>).buildings;
    const after = ok(build(state, MAKOKO, "shop"));
    expect(after.public.buildings[MAKOKO]!.commercial).toBe("shop");
  });

  it("clears a removed player's buildings with their land", () => {
    let state = own(setup(), "a", MAKOKO);
    state.public.buildings[MAKOKO] = { commercial: "shop", residential: null, hotel: false };
    state.public.players[0]!.missedTurns = 2;
    state = ok(applyTimeout(state, rolls(1)));
    expect(state.public.owners[MAKOKO]).toBeNull();
    expect(state.public.buildings[MAKOKO]).toEqual({ commercial: null, residential: null, hotel: false });
  });
});
