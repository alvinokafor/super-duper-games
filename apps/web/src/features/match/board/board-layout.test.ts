import { BOARD_SIZE } from "@bankroll/lagos-rules";
import { describe, expect, it } from "vitest";
import { cellBox, pieceSpot, placement } from "./board-layout";

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
    expect(placement(7)).toEqual({ row: 1, col: 1, side: "corner" });
    expect(placement(14)).toEqual({ row: 1, col: 8, side: "corner" });
    expect(placement(21)).toEqual({ row: 8, col: 8, side: "corner" });
  });

  it("goes up the left side first, starting just above GO", () => {
    expect(placement(1)).toEqual({ row: 7, col: 1, side: "left" });
    expect(placement(27)).toEqual({ row: 8, col: 2, side: "bottom" });
  });

  it("puts each space next to the one before it, going round once", () => {
    for (let i = 0; i < BOARD_SIZE; i++) {
      const a = all[i]!;
      const b = all[(i + 1) % BOARD_SIZE]!;
      expect(Math.abs(a.row - b.row) + Math.abs(a.col - b.col)).toBe(1);
    }
  });

  it("names the side each space sits on", () => {
    expect(all.slice(1, 7).every((p) => p.side === "left" && p.col === 1)).toBe(true);
    expect(all.slice(8, 14).every((p) => p.side === "top" && p.row === 1)).toBe(true);
    expect(all.slice(15, 21).every((p) => p.side === "right" && p.col === 8)).toBe(true);
    expect(all.slice(22).every((p) => p.side === "bottom" && p.row === 8)).toBe(true);
  });
});

describe("cellBox", () => {
  const boxes = Array.from({ length: BOARD_SIZE }, (_, i) => cellBox(i));

  it("puts GO in the bottom-left corner and Banana Island just right of it", () => {
    const go = cellBox(0);
    expect(go.x).toBe(0);
    expect(go.y + go.h).toBeCloseTo(1);
    expect(cellBox(27).x).toBeCloseTo(go.w);
  });

  it("lines each edge up exactly from one side of the board to the other", () => {
    const bottom = [0, ...Array.from({ length: 6 }, (_, i) => 27 - i), 21].map((i) => boxes[i]!);
    let x = 0;
    for (const box of bottom) {
      expect(box.x).toBeCloseTo(x);
      x += box.w;
    }
    expect(x).toBeCloseTo(1);
  });

  it("centres a lone piece across its tile, in the upper part", () => {
    const box = cellBox(5);
    const spot = pieceSpot(5, 0, 1);
    expect(spot.x).toBeCloseTo(box.x + box.w / 2);
    expect(spot.y).toBeGreaterThan(box.y);
    expect(spot.y).toBeLessThan(box.y + box.h / 2);
  });

  it("spreads pieces sharing a tile evenly around its centre, inside the tile", () => {
    for (let count = 2; count <= 6; count++) {
      const box = cellBox(12);
      const xs = Array.from({ length: count }, (_, slot) => pieceSpot(12, slot, count).x);
      expect((xs[0]! + xs.at(-1)!) / 2).toBeCloseTo(box.x + box.w / 2);
      expect(xs[0]!).toBeGreaterThan(box.x);
      expect(xs.at(-1)!).toBeLessThan(box.x + box.w);
    }
  });

  it("keeps every box inside the board", () => {
    for (const { x, y, w, h } of boxes) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(1 + 1e-9);
      expect(y + h).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});
