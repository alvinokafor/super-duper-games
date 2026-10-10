export type CorridorId =
  | "island_elite"
  | "lekki"
  | "mainland_premium"
  | "mainland_central"
  | "mainland_residential"
  | "mainland_low_cost";

export const CORRIDORS: Record<CorridorId, { name: string; short: string }> = {
  island_elite: { name: "Island Elite", short: "Island" },
  lekki: { name: "Lekki", short: "Lekki" },
  mainland_premium: { name: "Mainland Premium", short: "Premium" },
  mainland_central: { name: "Mainland Central", short: "Central" },
  mainland_residential: { name: "Mainland Residential", short: "Residential" },
  mainland_low_cost: { name: "Mainland Low-Cost", short: "Low-Cost" },
};

export type Space =
  | { kind: "go"; name: string }
  | { kind: "property"; name: string; corridor: CorridorId; price: number }
  | { kind: "utility"; name: string; price: number }
  | { kind: "chance"; name: string }
  | { kind: "community_chest"; name: string }
  | { kind: "tax"; name: string }
  | { kind: "efcc"; name: string }
  | { kind: "park"; name: string };

export type BuyableSpace = Extract<Space, { price: number }>;

/**
 * The canonical board from the rules doc (§3). Index 0 is space #1 (GO).
 * Players move clockwise, so the index only ever goes up and wraps.
 */
export const BOARD: readonly Space[] = [
  { kind: "go", name: "GO" },
  { kind: "property", name: "Banana Island", corridor: "island_elite", price: 42_000 },
  { kind: "property", name: "Eko Atlantic City", corridor: "island_elite", price: 44_000 },
  { kind: "property", name: "Victoria Island", corridor: "island_elite", price: 36_000 },
  { kind: "chance", name: "Chance" },
  { kind: "utility", name: "Airport", price: 16_000 },
  { kind: "property", name: "Lekki Phase 1", corridor: "lekki", price: 30_000 },
  { kind: "tax", name: "3% Property Tax" },
  { kind: "property", name: "Chevron Drive", corridor: "lekki", price: 26_000 },
  { kind: "property", name: "Osapa London", corridor: "lekki", price: 22_000 },
  { kind: "utility", name: "Refinery", price: 18_000 },
  { kind: "property", name: "Maryland", corridor: "mainland_premium", price: 23_000 },
  { kind: "property", name: "Magodo", corridor: "mainland_premium", price: 28_000 },
  { kind: "property", name: "Ikeja GRA", corridor: "mainland_premium", price: 35_000 },
  { kind: "efcc", name: "EFCC Holding" },
  { kind: "property", name: "Yaba", corridor: "mainland_central", price: 20_000 },
  { kind: "property", name: "Anthony", corridor: "mainland_central", price: 17_000 },
  { kind: "property", name: "Ajao Estate", corridor: "mainland_central", price: 14_000 },
  { kind: "utility", name: "Railway", price: 14_000 },
  { kind: "property", name: "Gbagada", corridor: "mainland_residential", price: 20_000 },
  { kind: "property", name: "Festac Town", corridor: "mainland_residential", price: 17_000 },
  { kind: "park", name: "Park" },
  { kind: "property", name: "Ketu", corridor: "mainland_residential", price: 12_000 },
  { kind: "community_chest", name: "Community Chest" },
  { kind: "tax", name: "5% Income Tax" },
  { kind: "property", name: "Mushin", corridor: "mainland_low_cost", price: 10_000 },
  { kind: "property", name: "Ajegunle", corridor: "mainland_low_cost", price: 8_000 },
  { kind: "property", name: "Makoko", corridor: "mainland_low_cost", price: 6_000 },
];

export function isBuyable(space: Space): space is BuyableSpace {
  return space.kind === "property" || space.kind === "utility";
}

export function corridorSpaces(corridor: CorridorId): number[] {
  return BOARD.flatMap((space, index) =>
    space.kind === "property" && space.corridor === corridor ? [index] : [],
  );
}
