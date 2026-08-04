import { describe, expect, it } from "vitest";

import {
  EMPTY_BALANCE,
  applyIssue,
  applyReceipt,
  canIssue,
  grossProfit,
  movementDirection,
} from "./costing";

describe("movementDirection", () => {
  it("treats receipts as inbound", () => {
    expect(movementDirection("goods_receipt")).toBe(1);
    expect(movementDirection("customer_return")).toBe(1);
    expect(movementDirection("adjustment_increase")).toBe(1);
  });

  it("treats issues as outbound", () => {
    expect(movementDirection("sale")).toBe(-1);
    expect(movementDirection("supplier_return")).toBe(-1);
    expect(movementDirection("requisition_issue")).toBe(-1);
  });

  it("refuses an unknown type rather than guessing a direction", () => {
    expect(movementDirection("teleport")).toBeNull();
  });
});

describe("applyReceipt", () => {
  it("sets the average from the first receipt", () => {
    const result = applyReceipt(EMPTY_BALANCE, 100, 10);
    expect(result).toEqual({ quantity: 100, averageCost: 10, totalValue: 1000 });
  });

  it("blends two equal receipts at different prices", () => {
    // 100 @ 10 then 100 @ 20 -> 200 @ 15
    const first = applyReceipt(EMPTY_BALANCE, 100, 10);
    const second = applyReceipt(first, 100, 20);
    expect(second.quantity).toBe(200);
    expect(second.averageCost).toBe(15);
    expect(second.totalValue).toBe(3000);
  });

  it("weights by quantity, not by number of receipts", () => {
    // 150 @ 15 then 30 @ 22.50 -> (2250 + 675) / 180 = 16.25
    const result = applyReceipt({ quantity: 150, averageCost: 15, totalValue: 2250 }, 30, 22.5);
    expect(result.quantity).toBe(180);
    expect(result.averageCost).toBe(16.25);
    expect(result.totalValue).toBe(2925);
  });

  it("takes the incoming cost as the average when restocking from zero", () => {
    const result = applyReceipt({ quantity: 0, averageCost: 12, totalValue: 0 }, 10, 30);
    expect(result.averageCost).toBe(30);
  });

  it("takes the incoming cost as the average when restocking from negative", () => {
    // Blending against a negative quantity would produce a nonsense average.
    const result = applyReceipt({ quantity: -5, averageCost: 12, totalValue: -60 }, 10, 30);
    expect(result.quantity).toBe(5);
    expect(result.averageCost).toBe(30);
  });

  it("handles a zero-cost receipt such as a free sample", () => {
    const result = applyReceipt({ quantity: 100, averageCost: 10, totalValue: 1000 }, 100, 0);
    expect(result.averageCost).toBe(5);
  });

  it("rejects a non-positive quantity", () => {
    expect(() => applyReceipt(EMPTY_BALANCE, 0, 10)).toThrow(/greater than zero/);
    expect(() => applyReceipt(EMPTY_BALANCE, -5, 10)).toThrow(/greater than zero/);
  });

  it("rejects a negative cost", () => {
    expect(() => applyReceipt(EMPTY_BALANCE, 5, -1)).toThrow(/negative/);
  });

  it("keeps repeated receipts stable to six decimals", () => {
    // A third of a cent per unit, compounded — the case that drifts if
    // intermediate values are rounded to 2dp.
    let balance = applyReceipt(EMPTY_BALANCE, 3, 10);
    balance = applyReceipt(balance, 3, 20);
    balance = applyReceipt(balance, 3, 30);
    expect(balance.quantity).toBe(9);
    expect(balance.averageCost).toBe(20);
  });
});

describe("applyIssue", () => {
  const stocked = { quantity: 200, averageCost: 15, totalValue: 3000 };

  it("issues at the current average", () => {
    const result = applyIssue(stocked, 50);
    expect(result.unitCost).toBe(15);
    expect(result.totalCost).toBe(750);
  });

  it("does not move the average", () => {
    const result = applyIssue(stocked, 50);
    expect(result.balance.averageCost).toBe(15);
    expect(result.balance.quantity).toBe(150);
    expect(result.balance.totalValue).toBe(2250);
  });

  it("can take the balance negative when permitted upstream", () => {
    const result = applyIssue({ quantity: 5, averageCost: 10, totalValue: 50 }, 8);
    expect(result.balance.quantity).toBe(-3);
    expect(result.balance.totalValue).toBe(-30);
  });

  it("falls back to a supplied cost when nothing has ever been received", () => {
    const result = applyIssue(EMPTY_BALANCE, 2, 7.5);
    expect(result.unitCost).toBe(7.5);
    expect(result.totalCost).toBe(15);
  });

  it("rejects a non-positive quantity", () => {
    expect(() => applyIssue(stocked, 0)).toThrow(/greater than zero/);
  });
});

describe("canIssue", () => {
  const balance = { quantity: 10, averageCost: 5, totalValue: 50 };

  it("allows an issue covered by stock", () => {
    expect(
      canIssue(balance, 10, { warehouseAllowsNegative: false, userMayGoNegative: false }),
    ).toEqual({
      allowed: true,
    });
  });

  it("blocks an oversell where the warehouse forbids negative stock", () => {
    const result = canIssue(balance, 11, {
      warehouseAllowsNegative: false,
      userMayGoNegative: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/does not allow negative stock/);
  });

  it("blocks an oversell where the user lacks the override", () => {
    const result = canIssue(balance, 11, {
      warehouseAllowsNegative: true,
      userMayGoNegative: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/permission/);
  });

  it("allows an oversell only when both gates are open", () => {
    expect(
      canIssue(balance, 11, { warehouseAllowsNegative: true, userMayGoNegative: true }),
    ).toEqual({ allowed: true });
  });

  it("rejects a zero quantity", () => {
    expect(
      canIssue(balance, 0, { warehouseAllowsNegative: true, userMayGoNegative: true }).allowed,
    ).toBe(false);
  });
});

describe("grossProfit", () => {
  it("computes margin from the actual issue cost", () => {
    expect(grossProfit(25, 10, 15)).toEqual({
      revenue: 250,
      cost: 150,
      profit: 100,
      marginPercent: 40,
    });
  });

  it("reports a loss when sold below cost", () => {
    const result = grossProfit(10, 5, 15);
    expect(result.profit).toBe(-25);
    expect(result.marginPercent).toBe(-50);
  });

  it("treats margin on zero revenue as zero rather than infinite", () => {
    expect(grossProfit(0, 5, 15).marginPercent).toBe(0);
  });
});
