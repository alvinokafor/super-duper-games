import { describe, expect, it } from "vitest";
import { applyCommand, applyTimeout, createMatch } from "./engine";
import type { LagosState } from "./schemas";

const setup = (playerIds = ["a", "b", "c"]) =>
  createMatch({ playerIds, length: "short", startingCash: 1500, seed: 42 });

function expectOk(result: ReturnType<typeof applyCommand>): LagosState {
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe("createMatch", () => {
  it("rejects fewer than 3 or more than 6 players", () => {
    expect(() => setup(["a", "b"])).toThrow();
    expect(() => setup(["a", "b", "c", "d", "e", "f", "g"])).toThrow();
  });

  it("starts with seat 0 to roll", () => {
    const state = setup();
    expect(state.public.currentPlayerId).toBe("a");
    expect(state.public.phase).toBe("awaiting_roll");
  });
});

describe("applyCommand", () => {
  it("only lets the current player act", () => {
    expect(applyCommand(setup(), "b", { type: "roll_dice" })).toEqual({
      ok: false,
      error: "not_your_turn",
    });
  });

  it("does not change the input state", () => {
    const state = setup();
    const before = structuredClone(state);
    applyCommand(state, "a", { type: "roll_dice" });
    expect(state).toEqual(before);
  });

  it("gives the same dice for the same seed", () => {
    const a = applyCommand(setup(), "a", { type: "roll_dice" });
    const b = applyCommand(setup(), "a", { type: "roll_dice" });
    expect(a).toEqual(b);
  });

  it("moves to the next seat after end_turn and wraps to a new round", () => {
    let state = setup();
    for (const id of ["a", "b", "c"]) {
      state = expectOk(applyCommand(state, id, { type: "roll_dice" }));
      state = expectOk(applyCommand(state, id, { type: "end_turn" }));
    }
    expect(state.public.currentPlayerId).toBe("a");
    expect(state.public.round).toBe(2);
  });
});

describe("applyTimeout", () => {
  it("rolls and ends the turn without buying", () => {
    const state = expectOk(applyTimeout(setup()));
    expect(state.public.currentPlayerId).toBe("b");
    expect(state.public.players[0]!.cash).toBe(1500);
    expect(state.public.players[0]!.missedTurns).toBe(1);
  });

  it("removes a player after 3 missed turns in a row", () => {
    let state = setup(["a", "b", "c", "d"]);
    const playOthers = () => {
      while (state.public.currentPlayerId !== "a") {
        const id = state.public.currentPlayerId;
        state = expectOk(applyCommand(state, id, { type: "roll_dice" }));
        state = expectOk(applyCommand(state, id, { type: "end_turn" }));
      }
    };
    state = expectOk(applyTimeout(state));
    playOthers();
    state = expectOk(applyTimeout(state));
    playOthers();
    state = expectOk(applyTimeout(state));
    const a = state.public.players.find((p) => p.id === "a")!;
    expect(a.status).toBe("removed");
    expect(state.public.currentPlayerId).not.toBe("a");
  });

  it("resets missed turns when the player acts", () => {
    let state = expectOk(applyTimeout(setup()));
    for (const id of ["b", "c"]) {
      state = expectOk(applyCommand(state, id, { type: "roll_dice" }));
      state = expectOk(applyCommand(state, id, { type: "end_turn" }));
    }
    state = expectOk(applyCommand(state, "a", { type: "roll_dice" }));
    expect(state.public.players[0]!.missedTurns).toBe(0);
  });

  it("ends the match when fewer than 2 players remain", () => {
    let state = setup();
    while (state.public.phase !== "finished") {
      state = expectOk(applyTimeout(state));
    }
    expect(state.public.players.filter((p) => p.status === "playing").length).toBeLessThan(2);
  });
});
