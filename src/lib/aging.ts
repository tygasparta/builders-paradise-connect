/**
 * Receivables and payables aging.
 *
 * Buckets are by days PAST DUE, not days since the document was raised.
 * An invoice on 60-day terms issued 45 days ago is current, not 31–60 —
 * getting that wrong makes a healthy ledger look distressed.
 */

export const AGING_BUCKETS = ["current", "1-30", "31-60", "61-90", "90+"] as const;

export type AgingBucket = (typeof AGING_BUCKETS)[number];

export const AGING_LABELS: Record<AgingBucket, string> = {
  current: "Current",
  "1-30": "1–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "Over 90 days",
};

export type AgeableDocument = {
  /** When payment fell due. Null is treated as due on issue. */
  dueDate: string | null;
  /** Fallback when there is no due date. */
  documentDate: string;
  /** What is still owed on this document. */
  outstanding: number;
};

export type AgingSummary = Record<AgingBucket, number> & { total: number };

/** Whole days between two dates, ignoring time of day. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Which bucket a document falls in as at a date. */
export function bucketFor(document: AgeableDocument, asAt: string): AgingBucket {
  const due = document.dueDate ?? document.documentDate;
  const overdue = daysBetween(due, asAt);
  if (overdue <= 0) return "current";
  if (overdue <= 30) return "1-30";
  if (overdue <= 60) return "31-60";
  if (overdue <= 90) return "61-90";
  return "90+";
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Totals outstanding per bucket.
 *
 * Documents with nothing outstanding are skipped rather than counted as
 * zero, so a fully settled invoice does not sit in the aging report.
 */
export function ageDocuments(
  documents: readonly AgeableDocument[],
  asAt: string = new Date().toISOString().slice(0, 10),
): AgingSummary {
  const summary: AgingSummary = {
    current: 0,
    "1-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
    total: 0,
  };

  for (const document of documents) {
    if (document.outstanding <= 0) continue;
    const bucket = bucketFor(document, asAt);
    summary[bucket] = round2(summary[bucket] + document.outstanding);
    summary.total = round2(summary.total + document.outstanding);
  }

  return summary;
}

/**
 * How much of a credit limit is used.
 * A null limit means cash only — there is no facility to utilise.
 */
export function creditUtilisation(
  creditLimit: number | null,
  balance: number,
): { limited: boolean; percent: number; available: number; overLimit: boolean } {
  if (creditLimit === null || creditLimit === 0) {
    return { limited: creditLimit === 0, percent: 0, available: 0, overLimit: balance > 0 };
  }
  const percent = round2((balance / creditLimit) * 100);
  return {
    limited: true,
    percent,
    available: round2(creditLimit - balance),
    overLimit: balance > creditLimit,
  };
}
