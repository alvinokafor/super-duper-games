import { BOARD, type CorridorId, corridorSpaces, isBuyable } from "./board";
import {
  BUILDING_WORTH,
  BUILDINGS,
  type BuildingId,
  buildingStats,
  RENOVATION_FEE,
  UTILITY_FEES,
} from "./buildings";
import type { LagosPublicState, Slots } from "./schemas";

/** How many of a corridor's three properties this player owns. */
export function corridorCount(state: LagosPublicState, playerId: string, corridor: CorridorId): number {
  return corridorSpaces(corridor).filter((i) => state.owners[i] === playerId).length;
}

/** The buildings standing on a space, in slot order. */
export function buildingsOn(slots: Slots): BuildingId[] {
  return [slots.commercial, slots.residential, slots.hotel ? "hotel" : null].filter((b): b is BuildingId => b !== null);
}

function current(slots: Slots, building: BuildingId): BuildingId | null {
  const slot = BUILDINGS[building].slot;
  if (slot === "hotel") return slots.hotel ? "hotel" : null;
  return slots[slot];
}

export type BuildCheck =
  | { ok: true; cost: number; replaces: BuildingId | null }
  | {
      ok: false;
      /**
       * not_yours: not land this player owns. locked: needs more of the corridor.
       * built: already standing. lower: cheaper than what stands in that slot.
       * uneven: another property in the corridor needs a building first.
       */
      reason: "not_yours" | "locked" | "built" | "lower" | "uneven";
      /** For `locked`, how many of the corridor are needed. */
      needs?: number;
    };

/**
 * Whether this player may put `building` on `space`, and what it costs.
 * Building straight to any unlocked building is allowed; replacing one in
 * the same slot costs the difference plus a renovation fee. New buildings
 * must keep the corridor even: no property may end up 2 or more buildings
 * ahead of another the player owns there. Cash is checked separately.
 */
export function checkBuild(state: LagosPublicState, playerId: string, space: number, building: BuildingId): BuildCheck {
  const land = BOARD[space];
  if (!land || land.kind !== "property" || state.owners[space] !== playerId) return { ok: false, reason: "not_yours" };

  const base = BUILDINGS[building];
  const owned = corridorCount(state, playerId, land.corridor);
  if (owned < base.unlock) return { ok: false, reason: "locked", needs: base.unlock };

  const slots = state.buildings[space]!;
  const standing = current(slots, building);
  if (standing === building) return { ok: false, reason: "built" };

  const cost = buildingStats(building, land.corridor).cost;
  if (standing) {
    const old = buildingStats(standing, land.corridor).cost;
    if (cost <= old) return { ok: false, reason: "lower" };
    return { ok: true, cost: cost - old + Math.round((cost - old) * RENOVATION_FEE), replaces: standing };
  }

  const mine = corridorSpaces(land.corridor).filter((i) => state.owners[i] === playerId);
  const after = buildingsOn(slots).length + 1;
  if (mine.some((i) => i !== space && after - buildingsOn(state.buildings[i]!).length >= 2)) {
    return { ok: false, reason: "uneven" };
  }
  return { ok: true, cost, replaces: null };
}

/** What `payerId` owes for landing on `space`. Never anything on their own land or unowned land. */
export function rentDue(state: LagosPublicState, space: number, payerId: string): number {
  const owner = state.owners[space];
  const land = BOARD[space]!;
  if (!owner || owner === payerId) return 0;
  if (land.kind === "utility") {
    const held = BOARD.filter((s, i) => s.kind === "utility" && state.owners[i] === owner).length;
    return UTILITY_FEES[held - 1] ?? 0;
  }
  if (land.kind !== "property") return 0;
  return buildingsOn(state.buildings[space]!).reduce((sum, b) => sum + buildingStats(b, land.corridor).rent, 0);
}

/**
 * What GO pays this player: business and hotel income minus upkeep on every
 * building they own. GO never takes money, so it is never below zero.
 */
export function payday(state: LagosPublicState, playerId: string) {
  let income = 0;
  let costs = 0;
  state.owners.forEach((owner, index) => {
    const land = BOARD[index]!;
    if (owner !== playerId || land.kind !== "property") return;
    for (const b of buildingsOn(state.buildings[index]!)) {
      const stats = buildingStats(b, land.corridor);
      income += stats.income;
      costs += stats.maintenance;
    }
  });
  return { income, costs, amount: Math.max(0, income - costs) };
}

/** Cash, plus the list price of land and utilities, plus 70% of what the buildings cost. */
export function netWorth(state: LagosPublicState, playerId: string): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;
  let total = player.cash;
  let built = 0;
  state.owners.forEach((owner, index) => {
    const space = BOARD[index]!;
    if (owner !== playerId || !isBuyable(space)) return;
    total += space.price;
    if (space.kind !== "property") return;
    for (const b of buildingsOn(state.buildings[index]!)) built += buildingStats(b, space.corridor).cost;
  });
  return total + Math.round(built * BUILDING_WORTH);
}
