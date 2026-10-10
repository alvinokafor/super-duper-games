import type { CorridorId, Space } from "@bankroll/lagos-rules";

export type Side = "bottom" | "right" | "top" | "left" | "corner";

/**
 * Grid cell for each space on the 8×8 board. GO sits bottom-left and play
 * runs clockwise: along the bottom, up the right, back along the top, down
 * the left.
 */
export function placement(index: number): { row: number; col: number; side: Side } {
  if (index === 0) return { row: 8, col: 1, side: "corner" };
  if (index < 7) return { row: 8, col: index + 1, side: "bottom" };
  if (index === 7) return { row: 8, col: 8, side: "corner" };
  if (index < 14) return { row: 15 - index, col: 8, side: "right" };
  if (index === 14) return { row: 1, col: 8, side: "corner" };
  if (index < 21) return { row: 1, col: 22 - index, side: "top" };
  if (index === 21) return { row: 1, col: 1, side: "corner" };
  return { row: index - 20, col: 1, side: "left" };
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