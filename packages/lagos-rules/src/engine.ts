import { BOARD, isBuyable } from "./board";
import {
  BOARD_SIZE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  MISSED_TURNS_BEFORE_REMOVAL,
  ROUNDS_BY_PLAYER_COUNT,
  STARTING_CASH,
} from "./constants";
import type {
  LagosCommand,
  LagosEvent,
  LagosPlayer,
  LagosPublicState,
  LagosState,
} from "./schemas";

export type RuleError = "not_your_turn" | "illegal_move" | "not_enough_cash" | "match_finished";

export type ApplyResult =
  | { ok: true; state: LagosState; events: LagosEvent[] }
  | { ok: false; error: RuleError };

/**
 * Returns a whole number from 0 up to, but not including, max. The server
 * must pass a secure source such as crypto.randomInt, so nobody can work out
 * future rolls from past ones.
 */
export type RandomInt = (max: number) => number;

export interface CreateMatchInput {
  /** Any order. Turn order is shuffled. */
  playerIds: string[];
  randomInt: RandomInt;
}

export function createMatch(input: CreateMatchInput): LagosState {
  const count = input.playerIds.length;
  if (count < MIN_PLAYERS || count > MAX_PLAYERS) {
    throw new Error(`Lagos Property needs ${MIN_PLAYERS}-${MAX_PLAYERS} players, got ${count}`);
  }
  if (new Set(input.playerIds).size !== count) {
    throw new Error("Player ids must be unique");
  }

  const order = [...input.playerIds];
  for (let i = order.length - 1; i > 0; i--) {
    const j = input.randomInt(i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }

  const players: LagosPlayer[] = order.map((id, seat) => ({
    id,
    seat,
    cash: STARTING_CASH,
    position: 0,
    status: "playing",
    missedTurns: 0,
  }));

  return {
    public: {
      round: 1,
      maxRounds: ROUNDS_BY_PLAYER_COUNT[count]!,
      currentPlayerId: players[0]!.id,
      phase: "awaiting_roll",
      lastRoll: null,
      players,
      owners: Array.from({ length: BOARD_SIZE }, () => null),
      winnerIds: null,
    },
    hidden: {},
  };
}

export function toPublicView(state: LagosState): LagosPublicState {
  return state.public;
}

export function applyCommand(
  state: LagosState,
  actorId: string,
  command: LagosCommand,
  randomInt: RandomInt,
): ApplyResult {
  if (state.public.phase === "finished") return { ok: false, error: "match_finished" };
  if (state.public.currentPlayerId !== actorId) return { ok: false, error: "not_your_turn" };

  const next = clone(state);
  const player = findPlayer(next, actorId);
  const events: LagosEvent[] = [];

  switch (command.type) {
    case "roll_dice":
      if (next.public.phase !== "awaiting_roll") return { ok: false, error: "illegal_move" };
      rollAndMove(next, player, events, randomInt);
      break;

    case "buy_property": {
      if (next.public.phase !== "awaiting_purchase") return { ok: false, error: "illegal_move" };
      const space = BOARD[player.position]!;
      if (!isBuyable(space)) return { ok: false, error: "illegal_move" };
      if (player.cash < space.price) return { ok: false, error: "not_enough_cash" };
      player.cash -= space.price;
      next.public.owners[player.position] = player.id;
      next.public.phase = "awaiting_action";
      events.push({ type: "property_bought", playerId: player.id, space: player.position, price: space.price });
      break;
    }

    case "pass_property":
      if (next.public.phase !== "awaiting_purchase") return { ok: false, error: "illegal_move" };
      passProperty(next, player, events);
      break;

    case "end_turn":
      if (next.public.phase !== "awaiting_action") return { ok: false, error: "illegal_move" };
      advanceTurn(next, events);
      break;
  }

  player.missedTurns = 0;
  return { ok: true, state: next, events };
}

/**
 * Plays the rest of the turn when a phase deadline passes: rolls if needed,
 * never buys, then ends the turn. Counts as a missed turn.
 */
export function applyTimeout(state: LagosState, randomInt: RandomInt): ApplyResult {
  if (state.public.phase === "finished") return { ok: false, error: "match_finished" };

  const next = clone(state);
  const player = findPlayer(next, next.public.currentPlayerId);
  const events: LagosEvent[] = [];

  if (next.public.phase === "awaiting_roll") rollAndMove(next, player, events, randomInt);
  if (next.public.phase === "awaiting_purchase") passProperty(next, player, events);

  player.missedTurns += 1;
  events.push({ type: "turn_timed_out", playerId: player.id, missedTurns: player.missedTurns });

  if (player.missedTurns >= MISSED_TURNS_BEFORE_REMOVAL) {
    // TODO: once shared property, loans and offers exist, hand those over too.
    player.status = "removed";
    next.public.owners = next.public.owners.map((owner) => (owner === player.id ? null : owner));
    events.push({ type: "player_removed", playerId: player.id });
  }

  advanceTurn(next, events);
  return { ok: true, state: next, events };
}

/** Cash plus the list price of land and utilities. Buildings join this later. */
export function netWorth(state: LagosPublicState, playerId: string): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;
  let total = player.cash;
  state.owners.forEach((owner, index) => {
    const space = BOARD[index]!;
    if (owner === playerId && isBuyable(space)) total += space.price;
  });
  return total;
}

/**
 * What GO pays this player. Commercial and hotel income minus maintenance and
 * loan repayments; with no buildings yet it is always zero. Never negative.
 */
export function payday(_state: LagosPublicState, _playerId: string) {
  const income = 0;
  const costs = 0;
  return { income, costs, amount: Math.max(0, income - costs) };
}

function rollAndMove(state: LagosState, player: LagosPlayer, events: LagosEvent[], randomInt: RandomInt) {
  const value = randomInt(6) + 1;
  const from = player.position;
  const to = (from + value) % BOARD_SIZE;
  const passedGo = from + value >= BOARD_SIZE;

  player.position = to;
  state.public.lastRoll = value;
  events.push({ type: "dice_rolled", playerId: player.id, value });
  events.push({ type: "token_moved", playerId: player.id, from, to, passedGo });

  if (passedGo) {
    const pay = payday(state.public, player.id);
    player.cash += pay.amount;
    events.push({ type: "payday", playerId: player.id, ...pay });
  }

  const space = BOARD[to]!;
  state.public.phase =
    isBuyable(space) && state.public.owners[to] === null ? "awaiting_purchase" : "awaiting_action";
}

function passProperty(state: LagosState, player: LagosPlayer, events: LagosEvent[]) {
  state.public.phase = "awaiting_action";
  events.push({ type: "property_passed", playerId: player.id, space: player.position });
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
    if (state.public.round >= state.public.maxRounds) return finish(state, events);
    state.public.round += 1;
  }

  state.public.currentPlayerId = nextPlayer.id;
  state.public.phase = "awaiting_roll";
  state.public.lastRoll = null;
  events.push({ type: "turn_started", playerId: nextPlayer.id, round: state.public.round });
}

/** Highest net worth wins; more cash breaks a tie; a full tie is a shared win. */
function finish(state: LagosState, events: LagosEvent[]) {
  const ranked = state.public.players
    .filter((p) => p.status === "playing")
    .map((p) => ({ id: p.id, worth: netWorth(state.public, p.id), cash: p.cash }));
  const best = ranked.reduce<(typeof ranked)[number] | null>(
    (top, p) => (!top || p.worth > top.worth || (p.worth === top.worth && p.cash > top.cash) ? p : top),
    null,
  );
  const winnerIds = best ? ranked.filter((p) => p.worth === best.worth && p.cash === best.cash).map((p) => p.id) : [];

  state.public.phase = "finished";
  state.public.winnerIds = winnerIds;
  events.push({ type: "match_finished", winnerIds });
}

function findPlayer(state: LagosState, playerId: string): LagosPlayer {
  const player = state.public.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`Unknown player ${playerId}`);
  return player;
}

function clone(state: LagosState): LagosState {
  return structuredClone(state);
}
