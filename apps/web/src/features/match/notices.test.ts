import { describe, expect, it } from "vitest";
import { noticeText } from "./notices";

const names = new Map([
  ["a", "Ada"],
  ["b", "Bola"],
]);
const RAILWAY = 10;
const YABA = 13;

describe("noticeText", () => {
  it("names who paid whom, calling utility charges a fee", () => {
    expect(noticeText({ type: "rent_paid", playerId: "a", ownerId: "b", space: YABA, amount: 4_200, owed: 4_200 }, "me", names)).toBe(
      "Ada paid Bola ₦4,200 rent",
    );
    expect(noticeText({ type: "rent_paid", playerId: "a", ownerId: "b", space: RAILWAY, amount: 2_000, owed: 2_000 }, "me", names)).toBe(
      "Ada paid Bola ₦2,000 fee",
    );
  });

  it("speaks to me when I pay or get paid", () => {
    expect(noticeText({ type: "rent_paid", playerId: "a", ownerId: "b", space: YABA, amount: 4_200, owed: 4_200 }, "a", names)).toBe(
      "You paid Bola ₦4,200 rent",
    );
    expect(noticeText({ type: "rent_paid", playerId: "a", ownerId: "b", space: YABA, amount: 4_200, owed: 4_200 }, "b", names)).toBe(
      "Ada paid you ₦4,200 rent",
    );
  });

  it("shows a short payment as part of what was owed", () => {
    expect(noticeText({ type: "rent_paid", playerId: "a", ownerId: "b", space: YABA, amount: 500, owed: 4_200 }, "me", names)).toBe(
      "Ada paid Bola ₦500 of ₦4,200 rent",
    );
  });

  it("says when the payer had no cash at all", () => {
    expect(noticeText({ type: "rent_paid", playerId: "a", ownerId: "b", space: YABA, amount: 0, owed: 4_200 }, "me", names)).toBe(
      "Ada had no cash for Bola's ₦4,200 rent",
    );
    expect(noticeText({ type: "rent_paid", playerId: "a", ownerId: "b", space: YABA, amount: 0, owed: 4_200 }, "b", names)).toBe(
      "Ada had no cash for your ₦4,200 rent",
    );
  });

  it("describes builds and upgrades", () => {
    expect(
      noticeText({ type: "building_built", playerId: "b", space: YABA, building: "office", cost: 17_000, replaced: null }, "me", names),
    ).toBe("Bola built an Office Building on Yaba");
    expect(
      noticeText({ type: "building_built", playerId: "b", space: YABA, building: "duplex", cost: 6_600, replaced: "basic_house" }, "me", names),
    ).toBe("Bola upgraded to a Duplex on Yaba");
  });

  it("ignores other events", () => {
    expect(noticeText({ type: "turn_started", playerId: "a", round: 1 }, "me", names)).toBeNull();
  });
});
