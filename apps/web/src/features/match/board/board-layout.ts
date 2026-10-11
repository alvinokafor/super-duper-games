import type { CorridorId, Space } from "@bankroll/lagos-rules";

export type Side = "bottom" | "right" | "top" | "left" | "corner";

// Corner tracks are a touch narrower than the edge tiles, as in the Paper board.
const EDGE = 48;
const CELL = 49;
const TOTAL = EDGE * 2 + CELL * 6;
export const gridTracks = `${EDGE}fr repeat(6, ${CELL}fr) ${EDGE}fr`;

const trackStart = (n: number) => (n === 1 ? 0 : EDGE + CELL * (n - 2));
const trackSize = (n: number) => (n === 1 || n === 8 ? EDGE : CELL);

/** A space's box on the board, as fractions of the board's width and height. */
export function cellBox(index: number): { x: number; y: number; w: number; h: number } {
  const { row, col } = placement(index);
  return { x: trackStart(col) / TOTAL, y: trackStart(row) / TOTAL, w: trackSize(col) / TOTAL, h: trackSize(row) / TOTAL };
}

/** A piece's radius, as a fraction of the board's width. */
export const PIECE_RADIUS = 0.016;

/**
 * Where a piece sits, as fractions of the board's width and height. Pieces
 * sharing a tile sit side by side in the top part of the tile, above its
 * name; `slot` is this piece's place in that row of `count`.
 */
export function pieceSpot(position: number, slot: number, count: number): { x: number; y: number } {
  const box = cellBox(position);
  const gap = PIECE_RADIUS * (count > 3 ? 1.2 : 1.8);
  return { x: box.x + box.w / 2 + (slot - (count - 1) / 2) * gap, y: box.y + box.h * 0.3 };
}

/**
 * Grid cell for each space on the 8×8 board. GO sits bottom-left and play
 * runs clockwise: up the left, along the top, down the right, back along the
 * bottom.
 */
export function placement(index: number): { row: number; col: number; side: Side } {
  if (index === 0) return { row: 8, col: 1, side: "corner" };
  if (index < 7) return { row: 8 - index, col: 1, side: "left" };
  if (index === 7) return { row: 1, col: 1, side: "corner" };
  if (index < 14) return { row: 1, col: index - 6, side: "top" };
  if (index === 14) return { row: 1, col: 8, side: "corner" };
  if (index < 21) return { row: index - 13, col: 8, side: "right" };
  if (index === 21) return { row: 8, col: 8, side: "corner" };
  return { row: 8, col: 29 - index, side: "bottom" };
}

export const corridorLook: Record<CorridorId, { solid: string; soft: string; ink: string; ring: string }> = {
  island_elite: { solid: "bg-brass", soft: "bg-brass-soft", ink: "text-brass-ink", ring: "border-brass" },
  lekki: { solid: "bg-teal", soft: "bg-teal-soft", ink: "text-teal-ink", ring: "border-teal" },
  mainland_premium: { solid: "bg-violet", soft: "bg-violet-soft", ink: "text-violet-ink", ring: "border-violet" },
  mainland_central: { solid: "bg-coral", soft: "bg-coral-soft", ink: "text-coral-ink", ring: "border-coral" },
  mainland_residential: { solid: "bg-orange", soft: "bg-orange-soft", ink: "text-orange-ink", ring: "border-orange" },
  mainland_low_cost: { solid: "bg-laterite", soft: "bg-laterite-soft", ink: "text-laterite-ink", ring: "border-laterite" },
};

/** The colour used for a space's dot in the "To Chance" roll pill. */
export function spaceDotClass(space: Space): string {
  switch (space.kind) {
    case "property":
      return corridorLook[space.corridor].solid;
    case "chance":
      return "bg-info";
    case "community_chest":
      return "bg-brass";
    case "go":
    case "park":
      return "bg-lagoon";
    case "efcc":
      return "bg-night";
    default:
      return "bg-ink-soft";
  }
}

// Short tile labels and their sizes, as drawn on the Paper board.
const tileLabels: Record<string, { label: string; size: string }> = {
  "Banana Island": { label: "Banana", size: "text-[7px] leading-[10px]" },
  "Eko Atlantic City": { label: "Eko", size: "text-[10px] leading-3" },
  "Victoria Island": { label: "V.I.", size: "text-[9px] leading-3" },
  "Lekki Phase 1": { label: "Lekki", size: "text-[8px] leading-[10px]" },
  "Chevron Drive": { label: "Chevron", size: "text-[7px] leading-[10px]" },
  "Osapa London": { label: "Osapa", size: "text-[8px] leading-[10px]" },
  Maryland: { label: "Maryland", size: "text-[7px] leading-[10px]" },
  Magodo: { label: "Magodo", size: "text-[7px] leading-[10px]" },
  "Ikeja GRA": { label: "Ikeja", size: "text-[8px] leading-[10px]" },
  Yaba: { label: "Yaba", size: "text-[9px] leading-3" },
  Anthony: { label: "Anthony", size: "text-[7px] leading-[10px]" },
  "Ajao Estate": { label: "Ajao", size: "text-[9px] leading-3" },
  Gbagada: { label: "Gbagada", size: "text-[7px] leading-[10px]" },
  "Festac Town": { label: "Festac", size: "text-[7px] leading-[10px]" },
  Ketu: { label: "Ketu", size: "text-[9px] leading-3" },
  Mushin: { label: "Mushin", size: "text-[8px] leading-[10px]" },
  Ajegunle: { label: "Ajegunle", size: "text-[7px] leading-[10px]" },
  Makoko: { label: "Makoko", size: "text-[7px] leading-[10px]" },
};

export function tileLabel(space: Space) {
  return tileLabels[space.name] ?? { label: space.name, size: "text-[7px] leading-[10px]" };
}