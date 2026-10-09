import type { MatchLength } from "@bankroll/contracts";
import {
  BOARD_SIZE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  MISSED_TURNS_BEFORE_REMOVAL,
  ROUNDS_BY_LENGTH,
} from "./constants";
import type {
  LagosCommand,
  LagosEvent,
  LagosPlayer,
  LagosPublicState,
  LagosState,
} from "./schemas";

export type RuleError = "not_your_turn" | "illegal_move" | "match_finished";

export type ApplyResult =
  | { ok: true; state: LagosState; events: LagosEvent[] }
  | { ok: false; error: RuleError };

export interface CreateMatchInput {
  /** In seat order. */
  playerIds: string[];
  length: MatchLength;
  startingCash: number;
  seed: number;
}

export function createMatch(input: CreateMatchInput): LagosState {
  const count = input.playerIds.length;
  if (count < MIN_PLAYERS || count > MAX_PLAYERS) {
    throw new Error(`Lagos Property needs ${MIN_PLAYERS}-${MAX_PLAYERS} players, got ${count}`);
  }
  if (new Set(input.playerIds).size !== count) {
    throw new Error("Player ids must be unique");
  }

  const players: LagosPlayer[] = input.playerIds.map((id, seat) => ({
    id,
    seat,
    cash: input.startingCash,
    position: 0,
    status: "playing",
    missedTurns: 0,
  }));

  return {
    public: {
      round: 1,
      maxRounds: ROUNDS_BY_LENGTH[input.length],
      currentPlayerId: players[0]!.id,
      phase: "awaiting_roll",
      lastRoll: null,
      players,
    },
    hidden: { rngState: input.seed >>> 0 },
  };
}

export function toPublicView(state: LagosState): LagosPublicState {
  return state.public;
}

export function applyCommand(
  state: LagosState,
  actorId: string,
  command: LagosCommand,
): ApplyResult {
  if (state.public.phase === "finished") return { ok: false, error: "match_finished" };
  if (state.public.currentPlayerId !== actorId) return { ok: false, error: "not_your_turn" };

  const next = clone(state);
  findPlayer(next, actorId).missedTurns = 0;
  const events: LagosEvent[] = [];

  switch (command.type) {
    case "roll_dice":
      if (next.public.phase !== "awaiting_roll") return { ok: false, error: "illegal_move" };
      rollAndMove(next, actorId, events);
      return { ok: true, state: next, events };

    case "end_turn":
      if (next.public.phase !== "awaiting_action") return { ok: false, error: "illegal_move" };
      advanceTurn(next, events);
      return { ok: true, state: next, events };
  }
}

/** Default move when the turn deadline passes. Rolls if needed, never buys, then ends the turn. */
export function applyTimeout(state: LagosState): ApplyResult {
  if (state.public.phase === "finished") return { ok: false, error: "match_finished" };

  const next = clone(state);
  const playerId = next.public.currentPlayerId;
  const events: LagosEvent[] = [];

  if (next.public.phase === "awaiting_roll") rollAndMove(next, playerId, events);

  const player = findPlayer(next, playerId);
  player.missedTurns += 1;
  events.push({ type: "turn_timed_out", playerId, missedTurns: player.missedTurns });

  if (player.missedTurns >= MISSED_TURNS_BEFORE_REMOVAL) {
    // TODO: return properties to the bank, hand shared property to co-owners,
    // write off loans owed by this player, and cancel their open offers.
    player.status = "removed";
    events.push({ type: "player_removed", playerId });
  }

  advanceTurn(next, events);
  return { ok: true, state: next, events };
}

function rollAndMove(state: LagosState, playerId: string, events: LagosEvent[]) {
  const dice: [number, number] = [rollDie(state), rollDie(state)];
  const player = findPlayer(state, playerId);
  const from = player.position;
  const to = (from + dice[0] + dice[1]) % BOARD_SIZE;

  player.position = to;
  state.public.lastRoll = dice;
  state.public.phase = "awaiting_action";

  events.push({ type: "dice_rolled", playerId, dice });
  events.push({ type: "token_moved", playerId, from, to });
}

function advanceTurn(state: LagosState, events: LagosEvent[]) {
  const active = state.public.players
    .filter((p) => p.status === "playing")
    .sort((a, b) => a.seat - b.seat);

  if (active.length < 2) return finish(state, events);

  const currentSeat = findPlayer(state, state.public.currentPlayerId).seat;
  const after = active.find((p) => p.seat > currentSeat);
  const nextPlayer = after ?? active[0]!;

  if (!after) {
    state.public.round += 1;
    if (state.public.round > state.public.maxRounds) {
      state.public.round = state.public.maxRounds;
      return finish(state, events);
    }
  }

  state.public.currentPlayerId = nextPlayer.id;
  state.public.phase = "awaiting_roll";
  state.public.lastRoll = null;
  events.push({ type: "turn_started", playerId: nextPlayer.id, round: state.public.round });
}

function finish(state: LagosState, events: LagosEvent[]) {
  state.public.phase = "finished";
  events.push({ type: "match_finished" });
}

function findPlayer(state: LagosState, playerId: string): LagosPlayer {
  const player = state.public.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`Unknown player ${playerId}`);
  return player;
}

/** mulberry32. The state lives in hidden data so dice can't be predicted from the client. */
function rollDie(state: LagosState): number {
  let t = (state.hidden.rngState = (state.hidden.rngState + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return Math.floor(value * 6) + 1;
}

function clone(state: LagosState): LagosState {
  return structuredClone(state);
}
