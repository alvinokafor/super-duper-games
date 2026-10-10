import { BOARD_SIZE } from "@bankroll/lagos-rules";
import { describe, expect, it } from "vitest";
import { placement } from "./board-layout";

const all = Array.from({ length: BOARD_SIZE }, (_, i) => placement(i));

describe("board placement", () => {
  it("puts every space in its own cell on the edge of the 8×8 grid", () => {
    const cells = new Set(all.map(({ row, col }) => `${row},${col}`));
    expect(cells.size).toBe(BOARD_SIZE);
    for (const { row, col } of all) {
      expect(row).toBeGreaterThanOrEqual(1);
      expect(row).toBeLessThanOrEqual(8);
      expect(col).toBeGreaterThanOrEqual(1);
      expect(col).toBeLessThanOrEqual(8);
      expect(row === 1 || row === 8 || col === 1 || col === 8).toBe(true);
    }
  });

  it("puts GO bottom-left and the other corners clockwise from it", () => {
    expect(placement(0)).toEqual({ row: 8, col: 1, side: "corner" });
    expect(placement(7)).toEqual({ row: 8, col: 8, side: "corner" });
    expect(placement(14)).toEqual({ row: 1, col: 8, side: "corner" });
    expect(placement(21)).toEqual({ row: 1, col: 1, side: "corner" });
  });

  it("puts each space next to the one before it, going round once", () => {
    for (let i = 0; i < BOARD_SIZE; i++) {
      const a = all[i]!;
      const b = all[(i + 1) % BOARD_SIZE]!;
      expect(Math.abs(a.row - b.row) + Math.abs(a.col - b.col)).toBe(1);
    }
  });

  it("names the side each space sits on", () => {
    expect(all.slice(1, 7).every((p) => p.side === "bottom" && p.row === 8)).toBe(true);
    expect(all.slice(8, 14).every((p) => p.side === "right" && p.col === 8)).toBe(true);
    expect(all.slice(15, 21).every((p) => p.side === "top" && p.row === 1)).toBe(true);
    expect(all.slice(22).every((p) => p.side === "left" && p.col === 1)).toBe(true);
  });
});
