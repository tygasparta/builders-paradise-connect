import { describe, expect, it } from "vitest";

import { groupSum, monthRange } from "./api";

type Row = { customer: string; total: number };

const rows: Row[] = [
  { customer: "Chikwanha Builders", total: 100 },
  { customer: "Moyo Hardware", total: 250 },
  { customer: "Chikwanha Builders", total: 50.5 },
  { customer: "Ncube Contractors", total: 75.25 },
];

describe("groupSum", () => {
  it("sums each key", () => {
    const result = groupSum(
      rows,
      (r) => r.customer,
      (r) => r.total,
    );
    expect(result.find((r) => r.key === "Chikwanha Builders")?.value).toBe(150.5);
  });

  it("counts the rows behind each key", () => {
    const result = groupSum(
      rows,
      (r) => r.customer,
      (r) => r.total,
    );
    expect(result.find((r) => r.key === "Chikwanha Builders")?.count).toBe(2);
  });

  it("orders by value descending, so the biggest reads first", () => {
    const result = groupSum(
      rows,
      (r) => r.customer,
      (r) => r.total,
    );
    expect(result.map((r) => r.key)).toEqual([
      "Moyo Hardware",
      "Chikwanha Builders",
      "Ncube Contractors",
    ]);
  });

  it("rounds to cents rather than carrying float noise", () => {
    const noisy = [
      { customer: "A", total: 0.1 },
      { customer: "A", total: 0.2 },
    ];
    // 0.1 + 0.2 is 0.30000000000000004 in binary floating point.
    expect(
      groupSum(
        noisy,
        (r) => r.customer,
        (r) => r.total,
      )[0]?.value,
    ).toBe(0.3);
  });

  it("returns nothing for no rows", () => {
    expect(
      groupSum(
        [],
        () => "x",
        () => 1,
      ),
    ).toEqual([]);
  });

  it("keeps a zero-valued group rather than dropping it", () => {
    // A customer who bought and fully returned still belongs in the list.
    const result = groupSum(
      [{ customer: "A", total: 0 }],
      (r) => r.customer,
      (r) => r.total,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.count).toBe(1);
  });
});

describe("monthRange", () => {
  it("covers the whole calendar month", () => {
    const range = monthRange(new Date("2026-08-05T12:00:00Z"));
    expect(range).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });

  it("handles a 30-day month", () => {
    expect(monthRange(new Date("2026-09-15T00:00:00Z")).to).toBe("2026-09-30");
  });

  it("handles February in a leap year", () => {
    expect(monthRange(new Date("2028-02-10T00:00:00Z")).to).toBe("2028-02-29");
  });

  it("handles February in a common year", () => {
    expect(monthRange(new Date("2026-02-10T00:00:00Z")).to).toBe("2026-02-28");
  });

  it("does not slip a month at the last instant of the month", () => {
    // A late-in-the-day date must not roll into the next month.
    expect(monthRange(new Date("2026-08-31T23:59:59Z")).from).toBe("2026-08-01");
  });
});
