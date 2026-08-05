import { describe, expect, it } from "vitest";

import { buildTaxBands, previewTax, validateBands, type BandDraft } from "./tax-bands";

// A three-band schedule: nil to 100, then 20% to 300, then 30% above.
const SCHEDULE: BandDraft[] = [
  { upperLimit: 100, ratePercent: 0 },
  { upperLimit: 300, ratePercent: 20 },
  { upperLimit: null, ratePercent: 30 },
];

describe("buildTaxBands", () => {
  it("starts the first band at nil", () => {
    expect(buildTaxBands(SCHEDULE)[0]).toMatchObject({ lower_limit: 0, cumulative_tax: 0 });
  });

  it("chains each lower limit to the previous upper limit", () => {
    const bands = buildTaxBands(SCHEDULE);
    expect(bands[1]?.lower_limit).toBe(100);
    expect(bands[2]?.lower_limit).toBe(300);
  });

  it("accumulates tax from the bands below", () => {
    const bands = buildTaxBands(SCHEDULE);
    // Nothing accrues in the nil band.
    expect(bands[1]?.cumulative_tax).toBe(0);
    // Filling the 20% band completely: (300 - 100) * 0.20 = 40.
    expect(bands[2]?.cumulative_tax).toBe(40);
  });

  it("converts a published percentage to a decimal rate", () => {
    expect(buildTaxBands(SCHEDULE)[1]?.rate).toBe(0.2);
  });

  it("leaves the final band open-ended", () => {
    expect(buildTaxBands(SCHEDULE).at(-1)?.upper_limit).toBeNull();
  });

  it("stops at the first open-ended band", () => {
    const bands = buildTaxBands([
      { upperLimit: null, ratePercent: 15 },
      { upperLimit: 500, ratePercent: 25 },
    ]);
    expect(bands).toHaveLength(1);
  });

  it("rounds cumulative tax to cents", () => {
    const bands = buildTaxBands([
      { upperLimit: 33.33, ratePercent: 33 },
      { upperLimit: null, ratePercent: 40 },
    ]);
    // 33.33 * 0.33 = 10.9989 → 11.00
    expect(bands[1]?.cumulative_tax).toBe(11);
  });
});

describe("previewTax", () => {
  const bands = buildTaxBands(SCHEDULE);

  it("taxes nothing inside the nil band", () => {
    expect(previewTax(bands, 80)).toBe(0);
  });

  it("taxes only the amount above the threshold", () => {
    // (150 - 100) * 0.20 = 10
    expect(previewTax(bands, 150)).toBe(10);
  });

  it("adds the cumulative tax in a higher band", () => {
    // (400 - 300) * 0.30 + 40 = 70
    expect(previewTax(bands, 400)).toBe(70);
  });

  it("is continuous across a boundary", () => {
    // At exactly 300 both bands must agree, or pay jumps at the seam.
    expect(previewTax(bands, 300)).toBe(40);
  });

  it("returns nil for nil pay", () => {
    expect(previewTax(bands, 0)).toBe(0);
  });
});

describe("validateBands", () => {
  it("accepts a well-formed schedule", () => {
    expect(validateBands(SCHEDULE)).toEqual([]);
  });

  it("refuses an empty set", () => {
    expect(validateBands([])).toHaveLength(1);
  });

  it("refuses an open-ended band that is not last", () => {
    const problems = validateBands([
      { upperLimit: null, ratePercent: 10 },
      { upperLimit: 200, ratePercent: 20 },
    ]);
    expect(problems.some((p) => p.message.includes("final band can be open-ended"))).toBe(true);
  });

  it("requires the last band to be open-ended", () => {
    const problems = validateBands([
      { upperLimit: 100, ratePercent: 0 },
      { upperLimit: 300, ratePercent: 20 },
    ]);
    expect(problems.some((p) => p.message.includes("must be open-ended"))).toBe(true);
  });

  it("refuses limits that do not ascend", () => {
    const problems = validateBands([
      { upperLimit: 300, ratePercent: 0 },
      { upperLimit: 100, ratePercent: 20 },
      { upperLimit: null, ratePercent: 30 },
    ]);
    expect(problems.some((p) => p.message.includes("above the one before"))).toBe(true);
  });

  it("refuses a rate outside nil to a hundred per cent", () => {
    const problems = validateBands([{ upperLimit: null, ratePercent: 150 }]);
    expect(problems.some((p) => p.message.includes("between 0 and 100"))).toBe(true);
  });
});
