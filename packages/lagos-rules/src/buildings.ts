import type { CorridorId } from "./board";

export type Slot = "commercial" | "residential" | "hotel";

export const COMMERCIAL_IDS = ["shop", "small_business", "office", "shopping_complex", "skyscraper"] as const;
export const RESIDENTIAL_IDS = ["basic_house", "duplex", "premium_apartments", "apartment_block", "luxury_mansion"] as const;
export type CommercialId = (typeof COMMERCIAL_IDS)[number];
export type ResidentialId = (typeof RESIDENTIAL_IDS)[number];
export type BuildingId = CommercialId | ResidentialId | "hotel";

export interface Building {
  name: string;
  slot: Slot;
  /** How many of the corridor's three properties the player must own. */
  unlock: 1 | 2 | 3;
  cost: number;
  /** Paid to the owner at GO. */
  income: number;
  /** Paid by anyone else who lands here. */
  rent: number;
  /** Taken from the owner's GO payday. */
  maintenance: number;
}

// PROVISIONAL v1 prototype economy at middle-class prices (rules §9.1–9.3).
// Settings for balancing, not final figures.
export const BUILDINGS: Record<BuildingId, Building> = {
  shop: { name: "Shop", slot: "commercial", unlock: 1, cost: 6_000, income: 2_600, rent: 0, maintenance: 400 },
  small_business: { name: "Small Business", slot: "commercial", unlock: 1, cost: 9_000, income: 3_800, rent: 0, maintenance: 700 },
  office: { name: "Office Building", slot: "commercial", unlock: 2, cost: 17_000, income: 7_100, rent: 0, maintenance: 1_300 },
  shopping_complex: { name: "Shopping Complex", slot: "commercial", unlock: 3, cost: 26_000, income: 13_000, rent: 0, maintenance: 2_600 },
  skyscraper: { name: "Skyscraper", slot: "commercial", unlock: 3, cost: 40_000, income: 21_000, rent: 0, maintenance: 5_000 },
  basic_house: { name: "Basic House", slot: "residential", unlock: 2, cost: 7_000, income: 0, rent: 4_200, maintenance: 300 },
  duplex: { name: "Duplex", slot: "residential", unlock: 2, cost: 13_000, income: 0, rent: 7_600, maintenance: 650 },
  premium_apartments: { name: "Premium Apartments", slot: "residential", unlock: 3, cost: 15_000, income: 0, rent: 9_000, maintenance: 850 },
  apartment_block: { name: "Apartment Block", slot: "residential", unlock: 3, cost: 18_500, income: 0, rent: 13_500, maintenance: 1_200 },
  luxury_mansion: { name: "Luxury Mansion", slot: "residential", unlock: 3, cost: 31_000, income: 0, rent: 22_000, maintenance: 2_200 },
  hotel: { name: "Hotel", slot: "hotel", unlock: 3, cost: 34_000, income: 7_000, rent: 6_000, maintenance: 2_000 },
};

export const BUILDING_IDS = [...COMMERCIAL_IDS, ...RESIDENTIAL_IDS, "hotel"] as const;

export const isCommercial = (id: BuildingId): id is CommercialId => (COMMERCIAL_IDS as readonly string[]).includes(id);
export const isResidential = (id: BuildingId): id is ResidentialId => (RESIDENTIAL_IDS as readonly string[]).includes(id);

export type Tier = "low_cost" | "middle" | "premium" | "ultra";

/** Decision log D06. */
export const CORRIDOR_TIER: Record<CorridorId, Tier> = {
  mainland_low_cost: "low_cost",
  mainland_residential: "middle",
  mainland_central: "middle",
  mainland_premium: "premium",
  lekki: "premium",
  island_elite: "ultra",
};

// PROVISIONAL (rules §9.5). Maintenance follows the construction multiplier;
// hotel income follows the commercial one and its landing fee the rent one.
export const TIER_MULTIPLIERS: Record<Tier, { construction: number; rent: number; commercial: number }> = {
  low_cost: { construction: 0.75, rent: 0.65, commercial: 0.8 },
  middle: { construction: 1, rent: 1, commercial: 1 },
  premium: { construction: 1.45, rent: 1.55, commercial: 1.45 },
  ultra: { construction: 2.15, rent: 2.3, commercial: 1.9 },
};

/** A building's figures on a given corridor, rounded to the nearest naira. */
export function buildingStats(id: BuildingId, corridor: CorridorId) {
  const base = BUILDINGS[id];
  const m = TIER_MULTIPLIERS[CORRIDOR_TIER[corridor]];
  return {
    cost: Math.round(base.cost * m.construction),
    income: Math.round(base.income * m.commercial),
    rent: Math.round(base.rent * m.rent),
    maintenance: Math.round(base.maintenance * m.construction),
  };
}

/** Upgrading within a slot costs the price difference plus a 10% renovation fee on it (§9.4). */
export const RENOVATION_FEE = 0.1;

/** Automatic fee for landing on a utility, by how many utilities the owner holds (§11). */
export const UTILITY_FEES = [2_000, 5_000, 9_000] as const;

/** Share of a building's construction value counted in net worth (§18.1). */
export const BUILDING_WORTH = 0.7;
