/**
 * Building a set of PAYE bands from what a person actually knows.
 *
 * A tax schedule is published as "up to X, pay r%". The cumulative tax
 * carried into each band is arithmetic on the bands below it — real, but
 * tedious and easy to get wrong by hand, and a wrong figure understates
 * every payslip in that band silently. So it is computed here rather
 * than typed.
 */

export type BandDraft = {
  /** Upper limit of this band; null means "and above". */
  upperLimit: number | null;
  /** Rate as a percentage, as published — 20 for 20%. */
  ratePercent: number;
};

export type BuiltBand = {
  lower_limit: number;
  upper_limit: number | null;
  rate: number;
  cumulative_tax: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Turns published bands into rows for payroll_tax_bands.
 * Bands must be given in ascending order; the last one is open-ended.
 */
export function buildTaxBands(drafts: readonly BandDraft[]): BuiltBand[] {
  const built: BuiltBand[] = [];
  let lower = 0;
  let cumulative = 0;

  for (const draft of drafts) {
    const rate = draft.ratePercent / 100;
    built.push({
      lower_limit: lower,
      upper_limit: draft.upperLimit,
      rate,
      cumulative_tax: round2(cumulative),
    });

    if (draft.upperLimit === null) break;

    // Tax accumulated by filling this band completely.
    cumulative += (draft.upperLimit - lower) * rate;
    lower = draft.upperLimit;
  }

  return built;
}

export type BandProblem = { index: number; message: string };

/** Checks a draft set before it is saved. Returns every problem found. */
export function validateBands(drafts: readonly BandDraft[]): BandProblem[] {
  const problems: BandProblem[] = [];

  if (drafts.length === 0) {
    return [{ index: -1, message: "Add at least one band." }];
  }

  drafts.forEach((draft, index) => {
    const isLast = index === drafts.length - 1;

    if (draft.ratePercent < 0 || draft.ratePercent > 100) {
      problems.push({ index, message: "Rate must be between 0 and 100 per cent." });
    }

    if (!isLast && draft.upperLimit === null) {
      problems.push({ index, message: "Only the final band can be open-ended." });
    }

    if (isLast && draft.upperLimit !== null) {
      problems.push({
        index,
        message: "The final band must be open-ended — leave its upper limit empty.",
      });
    }

    if (draft.upperLimit !== null) {
      const previous = index === 0 ? 0 : drafts[index - 1]?.upperLimit;
      if (previous !== null && previous !== undefined && draft.upperLimit <= previous) {
        problems.push({ index, message: "Each upper limit must be above the one before it." });
      }
    }
  });

  return problems;
}

/** What someone on this pay would be taxed, for checking a draft set. */
export function previewTax(bands: readonly BuiltBand[], taxable: number): number {
  if (taxable <= 0) return 0;
  const band = [...bands]
    .reverse()
    .find((b) => b.lower_limit <= taxable && (b.upper_limit === null || b.upper_limit >= taxable));
  if (!band) return 0;
  return round2(Math.max(0, (taxable - band.lower_limit) * band.rate + band.cumulative_tax));
}
