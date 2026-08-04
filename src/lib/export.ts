/**
 * Export helpers shared by every module's reports and tables.
 *
 * CSV is generated here rather than pulled in as a dependency because the
 * only genuinely hard parts are quoting and the spreadsheet-injection guard,
 * both of which are a few lines and both of which are tested.
 */

export type ExportColumn<T> = {
  /** Column heading in the exported file. */
  header: string;
  /** Pull the cell value out of a row. */
  value: (row: T) => string | number | boolean | null | undefined;
};

/**
 * Escapes one CSV field.
 *
 * Two separate concerns:
 *  - RFC 4180 quoting for commas, quotes and newlines.
 *  - Formula injection: a leading =, +, - or @ makes Excel and Sheets treat
 *    the cell as a formula, which is a real attack path when the data came
 *    from a customer or supplier name. Prefixing a tab neutralises it while
 *    keeping the text readable.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `\t${text}`;
  }

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Builds an RFC 4180 CSV document from rows and a column definition. */
export function toCsv<T>(rows: readonly T[], columns: readonly ExportColumn<T>[]): string {
  const header = columns.map((column) => escapeCsvField(column.header)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvField(column.value(row))).join(","),
  );
  return [header, ...body].join("\r\n");
}

/** `Inventory valuation` + today → `inventory-valuation-2026-08-04.csv` */
export function exportFilename(base: string, extension = "csv", date = new Date()): string {
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  return `${slug}-${stamp}.${extension}`;
}

/**
 * Triggers a browser download. Separated from `toCsv` so the string builder
 * stays pure and testable in Node.
 */
export function downloadFile(
  filename: string,
  contents: string,
  mimeType = "text/csv;charset=utf-8",
): void {
  if (typeof document === "undefined") return;

  // A BOM makes Excel open UTF-8 correctly instead of mangling accents.
  const blob = new Blob([`\uFEFF${contents}`], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Convenience: build and download in one call. */
export function downloadCsv<T>(
  base: string,
  rows: readonly T[],
  columns: readonly ExportColumn<T>[],
): void {
  downloadFile(exportFilename(base), toCsv(rows, columns));
}
