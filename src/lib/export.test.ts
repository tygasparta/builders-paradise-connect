import { describe, expect, it } from "vitest";

import { escapeCsvField, exportFilename, toCsv, type ExportColumn } from "./export";

type Row = { name: string; qty: number; note?: string | null };

const columns: ExportColumn<Row>[] = [
  { header: "Product", value: (r) => r.name },
  { header: "Qty", value: (r) => r.qty },
  { header: "Note", value: (r) => r.note },
];

describe("escapeCsvField", () => {
  it("leaves plain text alone", () => {
    expect(escapeCsvField("Cement 32.5N")).toBe("Cement 32.5N");
  });

  it("quotes fields containing a comma", () => {
    expect(escapeCsvField("Harare, Zimbabwe")).toBe('"Harare, Zimbabwe"');
  });

  it("doubles embedded quotes", () => {
    expect(escapeCsvField('6" PVC pipe')).toBe('"6"" PVC pipe"');
  });

  it("quotes newlines so rows cannot be split", () => {
    expect(escapeCsvField("line one\nline two")).toBe('"line one\nline two"');
  });

  it("renders null and undefined as empty", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });

  it("neutralises spreadsheet formula injection", () => {
    // A supplier named "=cmd|..." must not execute when the CSV is opened.
    expect(escapeCsvField("=1+1")).toBe("\t=1+1");
    expect(escapeCsvField("+44 77 000")).toBe("\t+44 77 000");
    expect(escapeCsvField("-1")).toBe("\t-1");
    expect(escapeCsvField("@SUM(A1)")).toBe("\t@SUM(A1)");
  });

  it("still quotes an injected field that also contains a comma", () => {
    expect(escapeCsvField("=A1,B1")).toBe('"\t=A1,B1"');
  });

  it("treats ordinary negative numbers as text-safe", () => {
    // Guarded, because a negative quantity is legitimate data.
    expect(escapeCsvField(-5)).toBe("\t-5");
  });
});

describe("toCsv", () => {
  it("writes a header row and CRLF line endings", () => {
    const csv = toCsv([{ name: "Cement", qty: 10, note: null }], columns);
    expect(csv).toBe("Product,Qty,Note\r\nCement,10,");
  });

  it("handles an empty dataset by emitting headers only", () => {
    expect(toCsv([], columns)).toBe("Product,Qty,Note");
  });

  it("keeps column order stable", () => {
    const csv = toCsv(
      [
        { name: "Steel rod", qty: 4, note: "bent" },
        { name: "Sand", qty: 2, note: null },
      ],
      columns,
    );
    expect(csv.split("\r\n")).toEqual(["Product,Qty,Note", "Steel rod,4,bent", "Sand,2,"]);
  });

  it("escapes values inside rows", () => {
    const csv = toCsv([{ name: 'Pipe, 6"', qty: 1, note: null }], columns);
    expect(csv).toContain('"Pipe, 6"""');
  });
});

describe("exportFilename", () => {
  it("slugifies and date-stamps", () => {
    expect(exportFilename("Inventory Valuation", "csv", new Date(2026, 7, 4))).toBe(
      "inventory-valuation-2026-08-04.csv",
    );
  });

  it("pads single-digit months and days", () => {
    expect(exportFilename("Trial Balance", "csv", new Date(2026, 0, 9))).toBe(
      "trial-balance-2026-01-09.csv",
    );
  });

  it("collapses punctuation runs", () => {
    expect(exportFilename("Sales — by  Customer", "csv", new Date(2026, 7, 4))).toBe(
      "sales-by-customer-2026-08-04.csv",
    );
  });
});
