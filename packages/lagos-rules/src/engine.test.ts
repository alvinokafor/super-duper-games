import { beforeEach, describe, expect, it } from "vitest";
import { BOARD, CORRIDORS, corridorSpaces, isBuyable } from "./board";
import { BOARD_SIZE, STARTING_CASH } from "./constants";
import { applyCommand as apply, applyTimeout as timeout, createMatch, netWorth, type RandomInt } from "./engine";
import type { LagosCommand, LagosState } from "./schemas";

/** Repeatable stand-in for crypto.randomInt. */
function seeded(seed: number): RandomInt {
  let s = seed >>> 0;
  return (max) => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
  };
}

/** Always rolls this face. */
const rolls = (face: number): RandomInt => () => face - 1;

let random = seeded(42);
const setup = (playerIds = ["a", "b", "c"]) => createMatch({ playerIds, randomInt: seeded(42) });
const applyCommand = (state: LagosState, actorId: string, command: LagosCommand) =>
  apply(state, actorId, command, random);
const applyTimeout = (state: LagosState) => timeout(state, random);

function expectOk(result: ReturnType<typeof applyCommand>): LagosState {
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

const current = (state: LagosState) => state.public.currentPlayerId;
const player = (state: LagosState, id: string) => state.public.players.find((p) => p.id === id)!;

/** Roll, pass on any purchase, end the turn. */
function playTurn(state: LagosState): LagosState {
  const id = current(state);
  state = expectOk(applyCommand(state, id, { type: "roll_dice" }));
  if (state.public.phase === "awaiting_purchase") {
    state = expectOk(applyCommand(state, id, { type: "pass_property" }));
  }
  return expectOk(applyCommand(state, id, { type: "end_turn" }));
}

beforeEach(() => {
  random = seeded(42);
});

/** Puts the current player on a space, waiting to decide on buying it. */
function landOn(state: LagosState, space: number): LagosState {
  const next = structuredClone(state);
  player(next, current(next)).position = space;
  next.public.phase = "awaiting_purchase";
  return next;
}

describe("board", () => {
  it("has 28 spaces with the four fixed corners", () => {
    expect(BOARD).toHaveLength(BOARD_SIZE);
    expect(BOARD[0]!.kind).toBe("go");
    expect(BOARD[7]!.kind).toBe("park");
    expect(BOARD[14]!.kind).toBe("efcc");
    expect(BOARD[21]!.name).toBe("3% Property Tax");
  });

  it("walks from GO through the cheapest land first and reaches the Island last", () => {
    expect(BOARD.slice(1, 4).map((s) => s.name)).toEqual(["Makoko", "Ajegunle", "Mushin"]);
    expect(BOARD.slice(-3).map((s) => s.name)).toEqual(["Victoria Island", "Eko Atlantic City", "Banana Island"]);
  });

  it("has six corridors of three properties and three utilities", () => {
    for (const corridor of Object.keys(CORRIDORS) as (keyof typeof CORRIDORS)[]) {
      expect(corridorSpaces(corridor)).toHaveLength(3);
    }
    expect(BOARD.filter((s) => s.kind === "property")).toHaveLength(18);
    expect(BOARD.filter((s) => s.kind === "utility").map((s) => s.name)).toEqual(["Railway", "Refinery", "Airport"]);
  });
});

describe("createMatch", () => {
  it("rejects fewer than 3 or more than 6 players", () => {
    expect(() => setup(["a", "b"])).toThrow();
    expect(() => setup(["a", "b", "c", "d", "e", "f", "g"])).toThrow();
  });

  it("gives everyone ₦75,000 on GO with nothing owned", () => {
    const state = setup();
    for (const p of state.public.players) {
      expect(p.cash).toBe(STARTING_CASH);
      expect(p.position).toBe(0);
    }
    expect(state.public.owners.every((o) => o === null)).toBe(true);
    expect(state.public.phase).toBe("awaiting_roll");
  });

  it("shuffles turn order with the random source", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const orders = new Set(
      [1, 2, 3, 4, 5].map((seed) =>
        createMatch({ playerIds: ids, randomInt: seeded(seed) }).public.players.map((p) => p.id).join(""),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
    expect(createMatch({ playerIds: ids, randomInt: seeded(7) })).toEqual(
      createMatch({ playerIds: ids, randomInt: seeded(7) }),
    );
    const state = setup();
    expect(state.public.players.map((p) => p.seat)).toEqual([0, 1, 2]);
    expect(current(state)).toBe(state.public.players[0]!.id);
  });

  it("uses fewer rounds for bigger tables", () => {
    expect(setup(["a", "b", "c"]).public.maxRounds).toBeGreaterThan(
      setup(["a", "b", "c", "d", "e", "f"]).public.maxRounds,
    );
  });
});

describe("applyCommand", () => {
  it("only lets the current player act", () => {
    const state = setup();
    const other = state.public.players[1]!.id;
    expect(applyCommand(state, other, { type: "roll_dice" })).toEqual({ ok: false, error: "not_your_turn" });
  });

  it("does not change the input state", () => {
    const state = setup();
    const before = structuredClone(state);
    applyCommand(state, current(state), { type: "roll_dice" });
    expect(state).toEqual(before);
  });

  it("rolls one die and moves forward along the board", () => {
    const state = setup();
    const id = current(state);
    const result = apply(state, id, { type: "roll_dice" }, rolls(4));
    if (!result.ok) throw new Error(result.error);
    expect(result.events).toContainEqual({ type: "dice_rolled", playerId: id, value: 4 });
    expect(player(result.state, id).position).toBe(4);
    expect(result.state.public.lastRoll).toBe(4);
    expect(applyCommand(result.state, id, { type: "roll_dice" })).toEqual({ ok: false, error: "illegal_move" });
  });

  it("asks the random source for a number below 6 for each roll", () => {
    const asked: number[] = [];
    const state = setup();
    apply(state, current(state), { type: "roll_dice" }, (max) => {
      asked.push(max);
      return max - 1;
    });
    expect(asked).toEqual([6]);
  });

  it("keeps no dice secrets in the saved state", () => {
    expect(setup().hidden).toEqual({});
  });

  it("asks to buy on an unowned property and skips owned ones", () => {
    let state = expectOk(applyCommand(setup(), current(setup()), { type: "roll_dice" }));
    const landed = player(state, current(state)).position;
    expect(state.public.phase).toBe(isBuyable(BOARD[landed]!) ? "awaiting_purchase" : "awaiting_action");

    state = setup();
    state.public.owners = state.public.owners.map((_, i) => (isBuyable(BOARD[i]!) ? "c" : null));
    state = expectOk(applyCommand(state, current(state), { type: "roll_dice" }));
    expect(state.public.phase).toBe("awaiting_action");
  });

  it("buys the property for its price", () => {
    const start = landOn(setup(), 27);
    const id = current(start);
    const state = expectOk(applyCommand(start, id, { type: "buy_property", space: 27 }));
    expect(player(state, id).cash).toBe(STARTING_CASH - 42_000);
    expect(state.public.owners[27]).toBe(id);
    expect(state.public.phase).toBe("awaiting_action");
    expect(netWorth(state.public, id)).toBe(STARTING_CASH);
  });

  it("refuses to buy a different space from the one the player is on", () => {
    const start = landOn(setup(), 27);
    expect(applyCommand(start, current(start), { type: "buy_property", space: 1 })).toEqual({
      ok: false,
      error: "illegal_move",
    });
  });

  it("refuses to buy without enough cash", () => {
    const start = landOn(setup(), 2);
    player(start, current(start)).cash = 1_000;
    expect(applyCommand(start, current(start), { type: "buy_property", space: 2 })).toEqual({
      ok: false,
      error: "not_enough_cash",
    });
  });

  it("leaves a passed property unowned", () => {
    const start = landOn(setup(), 6);
    const state = expectOk(applyCommand(start, current(start), { type: "pass_property" }));
    expect(state.public.owners[6]).toBeNull();
    expect(state.public.phase).toBe("awaiting_action");
  });

  it("pays GO when passing it and never takes money", () => {
    const state = setup();
    const id = current(state);
    player(state, id).position = 27;
    const result = apply(state, id, { type: "roll_dice" }, rolls(3));
    if (!result.ok) throw new Error(result.error);
    expect(result.events).toContainEqual({ type: "token_moved", playerId: id, from: 27, to: 2, passedGo: true });
    const pay = result.events.find((e) => e.type === "payday");
    expect(pay?.type === "payday" && pay.amount).toBe(0);
    expect(player(result.state, id).position).toBe(2);
    expect(player(result.state, id).cash).toBe(STARTING_CASH);
  });

  it("moves to the next seat after end_turn and wraps to a new round", () => {
    let state = setup();
    const first = current(state);
    for (let i = 0; i < 3; i++) state = playTurn(state);
    expect(current(state)).toBe(first);
    expect(state.public.round).toBe(2);
  });

  it("ends at the round cap and names the richest player", () => {
    let state = setup();
    state.public.maxRounds = 1;
    const rich = state.public.players[2]!.id;
    player(state, rich).cash += 1;
    for (let i = 0; i < 3; i++) state = playTurn(state);
    expect(state.public.phase).toBe("finished");
    expect(state.public.winnerIds).toEqual([rich]);
  });
});

describe("applyTimeout", () => {
  it("rolls and ends the turn without buying", () => {
    const start = setup();
    const id = current(start);
    const state = expectOk(applyTimeout(start));
    expect(current(state)).toBe(start.public.players[1]!.id);
    expect(player(state, id).cash).toBe(STARTING_CASH);
    expect(player(state, id).missedTurns).toBe(1);
    expect(state.public.owners.every((o) => o === null)).toBe(true);
  });

  it("passes on a pending purchase", () => {
    const start = landOn(setup(), 1);
    const state = expectOk(applyTimeout(start));
    expect(state.public.owners[1]).toBeNull();
    expect(state.public.phase).toBe("awaiting_roll");
  });

  it("removes a player after 3 missed turns and returns their land", () => {
    let state = setup(["a", "b", "c", "d"]);
    const idle = current(state);
    state.public.owners[1] = idle;
    const playOthers = () => {
      while (current(state) !== idle) state = playTurn(state);
    };
    state = expectOk(applyTimeout(state));
    playOthers();
    state = expectOk(applyTimeout(state));
    playOthers();
    state = expectOk(applyTimeout(state));
    expect(player(state, idle).status).toBe("removed");
    expect(state.public.owners[1]).toBeNull();
    expect(current(state)).not.toBe(idle);
  });

  it("resets missed turns when the player acts", () => {
    let state = setup();
    const id = current(state);
    state = expectOk(applyTimeout(state));
    while (current(state) !== id) state = playTurn(state);
    state = expectOk(applyCommand(state, id, { type: "roll_dice" }));
    expect(player(state, id).missedTurns).toBe(0);
  });

  it("ends the match when fewer than 2 players remain", () => {
    let state = setup();
    while (state.public.phase !== "finished") state = expectOk(applyTimeout(state));
    expect(state.public.players.filter((p) => p.status === "playing").length).toBeLessThan(2);
    expect(state.public.winnerIds).toHaveLength(1);
  });
});
