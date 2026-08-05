/**
 * Line and document arithmetic shared by every trading document —
 * purchase orders, quotations, invoices and credit notes.
 *
 * One implementation, so a purchase order and a sales invoice can never
 * disagree about what a 10% discount on a taxed line comes to.
 */

export type DocumentLine = {
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
};

export type LineTotals = {
  gross: number;
  discount: number;
  net: number;
  tax: number;
  total: number;
};

export function round4(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

/**
 * Discount comes off the line before tax, which is the ordinary treatment
 * and the one the counterparty's own paperwork will use. Rounding happens
 * once, at the line, so a document total is the sum of the figures on
 * screen rather than a separately rounded number that differs by a cent.
 */
export function lineTotals(line: DocumentLine): LineTotals {
  const gross = round4(line.quantity * line.unit_price);
  const discount = round4(gross * (line.discount_percent / 100));
  const net = round4(gross - discount);
  const tax = round4(net * (line.tax_rate / 100));
  return { gross, discount, net, tax, total: round4(net + tax) };
}

export type DocumentTotals = {
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
};

export function documentTotals(lines: readonly DocumentLine[]): DocumentTotals {
  return lines.reduce<DocumentTotals>(
    (acc, line) => {
      const totals = lineTotals(line);
      return {
        subtotal: round4(acc.subtotal + totals.gross),
        discount_total: round4(acc.discount_total + totals.discount),
        tax_total: round4(acc.tax_total + totals.tax),
        total: round4(acc.total + totals.total),
      };
    },
    { subtotal: 0, discount_total: 0, tax_total: 0, total: 0 },
  );
}

/**
 * Gross profit on a sales line, using the cost the stock issue actually
 * left at rather than the catalogue price.
 */
export function lineMargin(revenue: number, cost: number) {
  const profit = round4(revenue - cost);
  const marginPercent = revenue === 0 ? 0 : round4((profit / revenue) * 100);
  return { profit, marginPercent };
}
