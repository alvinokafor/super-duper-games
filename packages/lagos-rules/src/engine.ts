import { BOARD, isBuyable } from "./board";
import { isCommercial, isResidential } from "./buildings";
import { checkBuild, netWorth, payday, rentDue } from "./economy";
import {
  BOARD_SIZE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  MISSED_TURNS_BEFORE_REMOVAL,
  ROUNDS_BY_PLAYER_COUNT,
  STARTING_CASH,
} from "./constants";
import {
  emptyBuildings,
  type LagosCommand,
  type LagosEvent,
  type LagosPlayer,
  type LagosPublicState,
  type LagosState,
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
      buildings: emptyBuildings(),
      winnerIds: null,
    },
    hidden: {},
  };
}

export function toPublicView(state: LagosState): LagosPublicState {
  return { ...state.public, buildings: state.public.buildings ?? emptyBuildings() };
}

/**
 * Whether a move left the same player on the same step of the same turn,
 * such as a build. The turn clock then keeps running instead of restarting,
 * so building can't stretch a turn.
 */
export function sameTurnStep(before: LagosPublicState, after: LagosPublicState): boolean {
  return (
    before.round === after.round &&
    before.currentPlayerId === after.currentPlayerId &&
    before.phase === after.phase
  );
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
      if (command.space !== player.position) return { ok: false, error: "illegal_move" };
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

    case "build": {
      if (next.public.phase !== "awaiting_action") return { ok: false, error: "illegal_move" };
      const check = checkBuild(next.public, player.id, command.space, command.building);
      if (!check.ok) return { ok: false, error: "illegal_move" };
      if (player.cash < check.cost) return { ok: false, error: "not_enough_cash" };
      player.cash -= check.cost;
      const slots = next.public.buildings[command.space]!;
      const building = command.building;
      if (isCommercial(building)) slots.commercial = building;
      else if (isResidential(building)) slots.residential = building;
      else slots.hotel = true;
      events.push({
        type: "building_built",
        playerId: player.id,
        space: command.space,
        building: command.building,
        cost: check.cost,
        replaced: check.replaces,
      });
      break;
    }

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
    next.public.owners.forEach((owner, index) => {
      if (owner !== player.id) return;
      next.public.owners[index] = null;
      next.public.buildings[index] = { commercial: null, residential: null, hotel: false };
    });
    events.push({ type: "player_removed", playerId: player.id });
  }

  advanceTurn(next, events);
  return { ok: true, state: next, events };
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

  // Rent and utility fees are automatic. Until the money-trouble flow
  // arrives, a player who can't cover it pays all their cash and the rest is
  // forgiven.
  const owed = rentDue(state.public, to, player.id);
  const ownerId = state.public.owners[to];
  if (owed > 0 && ownerId) {
    const amount = Math.min(owed, player.cash);
    player.cash -= amount;
    findPlayer(state, ownerId).cash += amount;
    events.push({ type: "rent_paid", playerId: player.id, ownerId, space: to, amount, owed });
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

/** Matches saved before buildings existed have no `buildings`; give them empty land. */
function clone(state: LagosState): LagosState {
  const next = structuredClone(state);
  next.public.buildings ??= emptyBuildings();
  return next;
}
