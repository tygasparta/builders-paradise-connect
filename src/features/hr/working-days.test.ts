import { describe, expect, it } from "vitest";

import { workingDaysBetween } from "./api";

describe("workingDaysBetween", () => {
  it("counts a single weekday as one day", () => {
    // 2026-08-05 is a Wednesday.
    expect(workingDaysBetween("2026-08-05", "2026-08-05")).toBe(1);
  });

  it("excludes weekends from a full week", () => {
    // Monday to Sunday is five working days, not seven.
    expect(workingDaysBetween("2026-08-03", "2026-08-09")).toBe(5);
  });

  it("counts a weekend-only request as nil", () => {
    // Saturday to Sunday: no working days, so nothing is deducted.
    expect(workingDaysBetween("2026-08-08", "2026-08-09")).toBe(0);
  });

  it("spans a weekend correctly", () => {
    // Friday to Monday is two working days.
    expect(workingDaysBetween("2026-08-07", "2026-08-10")).toBe(2);
  });

  it("returns nil when the end is before the start", () => {
    expect(workingDaysBetween("2026-08-10", "2026-08-03")).toBe(0);
  });

  it("crosses a month boundary", () => {
    // 31 Aug (Mon) to 4 Sep (Fri) 2026 is five working days.
    expect(workingDaysBetween("2026-08-31", "2026-09-04")).toBe(5);
  });

  it("handles a leap-year February", () => {
    // 2028 is a leap year; 28 Feb is a Monday, 29 Feb a Tuesday.
    expect(workingDaysBetween("2028-02-28", "2028-02-29")).toBe(2);
  });

  it("returns nil for an unparseable date rather than throwing", () => {
    expect(workingDaysBetween("not-a-date", "2026-08-05")).toBe(0);
  });
});
