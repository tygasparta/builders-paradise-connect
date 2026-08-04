/**
 * Weighted-average costing — the client-side mirror of
 * `public.post_inventory_movement()`.
 *
 * The database is the authority: stock only ever changes through that
 * function, inside one transaction, with the balance row locked. This
 * module exists so the UI can *preview* the effect of a receipt or an
 * issue before posting it (a GRN line showing "this moves your average
 * cost from 15.00 to 16.25"), and so the rule itself is unit-tested
 * without needing a live database.
 *
 * If these two ever disagree, the database wins.
 */

export type StockBalance = {
  quantity: number;
  averageCost: number;
  totalValue: number;
};

export const EMPTY_BALANCE: StockBalance = { quantity: 0, averageCost: 0, totalValue: 0 };

export type MovementDirection = 1 | -1;

export const INBOUND_MOVEMENTS = [
  "opening_balance",
  "goods_receipt",
  "customer_return",
  "adjustment_increase",
  "transfer_in",
  "count_increase",
  "requisition_return",
] as const;

export const OUTBOUND_MOVEMENTS = [
  "sale",
  "supplier_return",
  "adjustment_decrease",
  "transfer_out",
  "count_decrease",
  "requisition_issue",
] as const;

export type MovementType = (typeof INBOUND_MOVEMENTS)[number] | (typeof OUTBOUND_MOVEMENTS)[number];

/** +1 for receipts, -1 for issues. Null for an unrecognised type. */
export function movementDirection(type: string): MovementDirection | null {
  if ((INBOUND_MOVEMENTS as readonly string[]).includes(type)) return 1;
  if ((OUTBOUND_MOVEMENTS as readonly string[]).includes(type)) return -1;
  return null;
}

/** Money is held to 4 decimals; costs to 6. Matches the column scales. */
export function roundValue(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

export function roundCost(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Applies a receipt.
 *
 * `new_avg = (qty × avg + inQty × inCost) / (qty + inQty)`
 *
 * Two edge cases the naive formula gets wrong:
 *  - coming back from zero or negative stock, the incoming cost *becomes*
 *    the average; blending against a negative quantity is meaningless
 *  - landing exactly on zero leaves the average at zero rather than
 *    dividing by it
 */
export function applyReceipt(
  balance: StockBalance,
  quantity: number,
  unitCost: number,
): StockBalance {
  if (quantity <= 0) {
    throw new Error("Receipt quantity must be greater than zero");
  }
  if (unitCost < 0) {
    throw new Error("Receipt unit cost cannot be negative");
  }

  const newQuantity = balance.quantity + quantity;

  let newAverage: number;
  if (newQuantity === 0) {
    newAverage = 0;
  } else if (balance.quantity <= 0) {
    newAverage = unitCost;
  } else {
    newAverage = (balance.quantity * balance.averageCost + quantity * unitCost) / newQuantity;
  }

  return {
    quantity: newQuantity,
    averageCost: roundCost(newAverage),
    totalValue: roundValue(newQuantity * newAverage),
  };
}

/**
 * Applies an issue. Stock leaves at the current weighted average and the
 * average itself does not move — that is what makes cost of sales, and
 * therefore gross profit, honest.
 */
export function applyIssue(
  balance: StockBalance,
  quantity: number,
  fallbackCost = 0,
): { balance: StockBalance; unitCost: number; totalCost: number } {
  if (quantity <= 0) {
    throw new Error("Issue quantity must be greater than zero");
  }

  const unitCost = balance.averageCost > 0 ? balance.averageCost : fallbackCost;
  const newQuantity = balance.quantity - quantity;

  return {
    balance: {
      quantity: newQuantity,
      averageCost: balance.averageCost,
      totalValue: roundValue(newQuantity * balance.averageCost),
    },
    unitCost: roundCost(unitCost),
    totalCost: roundValue(quantity * unitCost),
  };
}

/**
 * Whether an issue may proceed.
 *
 * Both gates must open: the warehouse has to permit negative stock AND
 * the acting user has to hold `inventory.negative_stock.allow`. The
 * database enforces the same pair; this is for showing the user why the
 * button is disabled before they press it.
 */
export function canIssue(
  balance: StockBalance,
  quantity: number,
  options: { warehouseAllowsNegative: boolean; userMayGoNegative: boolean },
): { allowed: boolean; reason?: string } {
  if (quantity <= 0) {
    return { allowed: false, reason: "Quantity must be greater than zero." };
  }
  if (balance.quantity >= quantity) {
    return { allowed: true };
  }
  if (!options.warehouseAllowsNegative) {
    return {
      allowed: false,
      reason: `Only ${balance.quantity} in stock, and this warehouse does not allow negative stock.`,
    };
  }
  if (!options.userMayGoNegative) {
    return {
      allowed: false,
      reason: 'Going below zero needs the "Allow negative stock" permission.',
    };
  }
  return { allowed: true };
}

/** Gross profit for a sale line, using the cost the issue actually left at. */
export function grossProfit(
  sellingPrice: number,
  quantity: number,
  unitCost: number,
): { revenue: number; cost: number; profit: number; marginPercent: number } {
  const revenue = roundValue(sellingPrice * quantity);
  const cost = roundValue(unitCost * quantity);
  const profit = roundValue(revenue - cost);
  // Margin on a zero-revenue line is undefined, not infinite.
  const marginPercent = revenue === 0 ? 0 : roundValue((profit / revenue) * 100);
  return { revenue, cost, profit, marginPercent };
}
