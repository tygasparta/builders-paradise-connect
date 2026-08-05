import { describe, expect, it } from "vitest";

import { documentTotals, lineTotals } from "@/lib/document-math";

describe("lineTotals", () => {
  it("multiplies quantity by price", () => {
    const result = lineTotals({
      quantity: 100,
      unit_price: 12,
      discount_percent: 0,
      tax_rate: 0,
    });
    expect(result.gross).toBe(1200);
    expect(result.total).toBe(1200);
  });

  it("takes the discount off before tax, not after", () => {
    // 1000 gross, 10% off = 900 net, 15% tax on 900 = 135, total 1035.
    // Taxing first would give 1150 then discounting to 1035 — same here,
    // but it diverges the moment rounding bites, and the supplier's
    // invoice will discount first.
    const result = lineTotals({
      quantity: 100,
      unit_price: 10,
      discount_percent: 10,
      tax_rate: 15,
    });
    expect(result.gross).toBe(1000);
    expect(result.discount).toBe(100);
    expect(result.net).toBe(900);
    expect(result.tax).toBe(135);
    expect(result.total).toBe(1035);
  });

  it("handles a zero-price line without dividing by anything", () => {
    const result = lineTotals({
      quantity: 5,
      unit_price: 0,
      discount_percent: 10,
      tax_rate: 15,
    });
    expect(result.total).toBe(0);
  });

  it("handles a full discount", () => {
    const result = lineTotals({
      quantity: 10,
      unit_price: 50,
      discount_percent: 100,
      tax_rate: 15,
    });
    expect(result.net).toBe(0);
    expect(result.tax).toBe(0);
    expect(result.total).toBe(0);
  });

  it("keeps fractional quantities exact to four places", () => {
    // 2.5 tonnes of sand at 18.75
    const result = lineTotals({
      quantity: 2.5,
      unit_price: 18.75,
      discount_percent: 0,
      tax_rate: 0,
    });
    expect(result.total).toBe(46.875);
  });
});

describe("documentTotals", () => {
  const lines = [
    {
      product_id: "a",
      description: "",
      quantity: 100,
      unit_price: 12,
      discount_percent: 0,
      tax_rate: 15,
    },
    {
      product_id: "b",
      description: "",
      quantity: 50,
      unit_price: 8,
      discount_percent: 10,
      tax_rate: 15,
    },
  ];

  it("sums each component across lines", () => {
    const result = documentTotals(lines);
    // Line 1: 1200 gross, 0 discount, 180 tax, 1380
    // Line 2:  400 gross, 40 discount, 54 tax, 414
    expect(result.subtotal).toBe(1600);
    expect(result.discount_total).toBe(40);
    expect(result.tax_total).toBe(234);
    expect(result.total).toBe(1794);
  });

  it("makes the total the sum of the displayed line totals", () => {
    const result = documentTotals(lines);
    const sumOfLines = lines.reduce((sum, line) => sum + lineTotals(line).total, 0);
    expect(result.total).toBe(Math.round(sumOfLines * 1e4) / 1e4);
  });

  it("returns zeroes for an empty order", () => {
    expect(documentTotals([])).toEqual({
      subtotal: 0,
      discount_total: 0,
      tax_total: 0,
      total: 0,
    });
  });
});
