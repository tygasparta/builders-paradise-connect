import { describe, expect, it } from "vitest";

import { ageDocuments, bucketFor, creditUtilisation, daysBetween } from "./aging";

const doc = (dueDate: string | null, outstanding: number, documentDate = "2026-01-01") => ({
  dueDate,
  documentDate,
  outstanding,
});

describe("daysBetween", () => {
  it("counts whole days", () => {
    expect(daysBetween("2026-08-01", "2026-08-31")).toBe(30);
  });

  it("is negative when the second date is earlier", () => {
    expect(daysBetween("2026-08-31", "2026-08-01")).toBe(-30);
  });

  it("ignores the time of day", () => {
    expect(daysBetween("2026-08-01T23:59:00Z", "2026-08-02T00:01:00Z")).toBe(1);
  });

  it("crosses a month boundary correctly", () => {
    expect(daysBetween("2026-01-31", "2026-03-01")).toBe(29);
  });
});

describe("bucketFor", () => {
  it("treats a document not yet due as current", () => {
    expect(bucketFor(doc("2026-09-30", 100), "2026-08-05")).toBe("current");
  });

  it("treats due today as current, not overdue", () => {
    expect(bucketFor(doc("2026-08-05", 100), "2026-08-05")).toBe("current");
  });

  it("ages by days past due, not by document age", () => {
    // Raised 45 days ago on 60-day terms: current, despite being old.
    // Getting this wrong makes a healthy ledger look distressed.
    expect(bucketFor(doc("2026-09-15", 100, "2026-06-21"), "2026-08-05")).toBe("current");
  });

  it("puts one day past due in the first bucket", () => {
    expect(bucketFor(doc("2026-08-04", 100), "2026-08-05")).toBe("1-30");
  });

  it("respects each boundary exactly", () => {
    expect(bucketFor(doc("2026-07-06", 100), "2026-08-05")).toBe("1-30"); // 30 days
    expect(bucketFor(doc("2026-07-05", 100), "2026-08-05")).toBe("31-60"); // 31 days
    expect(bucketFor(doc("2026-06-06", 100), "2026-08-05")).toBe("31-60"); // 60 days
    expect(bucketFor(doc("2026-06-05", 100), "2026-08-05")).toBe("61-90"); // 61 days
    expect(bucketFor(doc("2026-05-07", 100), "2026-08-05")).toBe("61-90"); // 90 days
    expect(bucketFor(doc("2026-05-06", 100), "2026-08-05")).toBe("90+"); // 91 days
  });

  it("falls back to the document date when there is no due date", () => {
    expect(bucketFor(doc(null, 100, "2026-01-01"), "2026-08-05")).toBe("90+");
  });
});

describe("ageDocuments", () => {
  it("totals each bucket", () => {
    const summary = ageDocuments(
      [
        doc("2026-09-30", 100),
        doc("2026-08-04", 200),
        doc("2026-07-01", 300),
        doc("2026-01-01", 400),
      ],
      "2026-08-05",
    );
    expect(summary.current).toBe(100);
    expect(summary["1-30"]).toBe(200);
    expect(summary["31-60"]).toBe(300);
    expect(summary["90+"]).toBe(400);
    expect(summary.total).toBe(1000);
  });

  it("skips settled documents rather than counting them as zero", () => {
    const summary = ageDocuments([doc("2026-01-01", 0), doc("2026-01-01", 50)], "2026-08-05");
    expect(summary["90+"]).toBe(50);
    expect(summary.total).toBe(50);
  });

  it("ignores negative outstanding amounts", () => {
    // An over-applied receipt should not quietly reduce the aging report.
    const summary = ageDocuments([doc("2026-01-01", -25), doc("2026-01-01", 75)], "2026-08-05");
    expect(summary.total).toBe(75);
  });

  it("returns all zeroes for no documents", () => {
    expect(ageDocuments([], "2026-08-05")).toEqual({
      current: 0,
      "1-30": 0,
      "31-60": 0,
      "61-90": 0,
      "90+": 0,
      total: 0,
    });
  });

  it("keeps cents exact across many documents", () => {
    const summary = ageDocuments(
      Array.from({ length: 3 }, () => doc("2026-08-04", 33.33)),
      "2026-08-05",
    );
    expect(summary["1-30"]).toBe(99.99);
    expect(summary.total).toBe(99.99);
  });
});

describe("creditUtilisation", () => {
  it("reports usage against a limit", () => {
    const result = creditUtilisation(1000, 250);
    expect(result.limited).toBe(true);
    expect(result.percent).toBe(25);
    expect(result.available).toBe(750);
    expect(result.overLimit).toBe(false);
  });

  it("flags a balance beyond the limit", () => {
    const result = creditUtilisation(1000, 1200);
    expect(result.overLimit).toBe(true);
    expect(result.available).toBe(-200);
  });

  it("treats a null limit as cash only, with no facility", () => {
    const result = creditUtilisation(null, 0);
    expect(result.limited).toBe(false);
    expect(result.available).toBe(0);
  });

  it("treats any balance on a cash-only account as over limit", () => {
    // No credit was extended, so anything owing is already an exception.
    expect(creditUtilisation(null, 50).overLimit).toBe(true);
  });

  it("treats a zero limit as a blocked facility", () => {
    const result = creditUtilisation(0, 10);
    expect(result.limited).toBe(true);
    expect(result.overLimit).toBe(true);
  });
});
