import { useQuery } from "@tanstack/react-query";

import { db, unwrap } from "@/lib/supabase";

/**
 * Reports read the same tables the operational screens do. Nothing is
 * recomputed from a separate store, so a report cannot disagree with the
 * document it summarises.
 */

export type DateRange = { from: string; to: string };

export type SalesSummaryRow = {
  invoice_no: string;
  invoice_date: string;
  customer_name: string;
  payment_type: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  /** What the goods cost us, captured on the invoice when it posted. */
  cost_of_sales: number;
  status: string;
};

export async function fetchSalesSummary(range: DateRange): Promise<SalesSummaryRow[]> {
  const rows = unwrap(
    await db
      .from("sales_invoices")
      .select(
        `invoice_no, invoice_date, payment_type, subtotal, discount_total, tax_total,
         total, amount_paid, cost_of_sales, status,
         customer:customers!sales_invoices_customer_id_fkey(name)`,
      )
      .gte("invoice_date", range.from)
      .lte("invoice_date", range.to)
      .not("status", "in", "(draft,cancelled)")
      .order("invoice_date", { ascending: false })
      .limit(1000),
  ) as unknown as (Omit<SalesSummaryRow, "customer_name"> & {
    customer: { name: string } | null;
  })[];

  return rows.map(({ customer, ...row }) => ({
    ...row,
    customer_name: customer?.name ?? "Walk-in",
  }));
}

export type PurchaseSummaryRow = {
  po_no: string;
  order_date: string;
  supplier_name: string;
  currency_code: string;
  total: number;
  status: string;
};

export async function fetchPurchaseSummary(range: DateRange): Promise<PurchaseSummaryRow[]> {
  const rows = unwrap(
    await db
      .from("purchase_orders")
      .select(
        `po_no, order_date, currency_code, total, status,
         supplier:suppliers!purchase_orders_supplier_id_fkey(name)`,
      )
      .gte("order_date", range.from)
      .lte("order_date", range.to)
      .not("status", "in", "(draft,cancelled)")
      .order("order_date", { ascending: false })
      .limit(1000),
  ) as unknown as (Omit<PurchaseSummaryRow, "supplier_name"> & {
    supplier: { name: string } | null;
  })[];

  return rows.map(({ supplier, ...row }) => ({
    ...row,
    supplier_name: supplier?.name ?? "—",
  }));
}

export type ExpenseSummaryRow = {
  expense_no: string;
  expense_date: string;
  category_name: string;
  description: string;
  amount: number;
  tax_amount: number;
  total: number;
  status: string;
};

export async function fetchExpenseSummary(range: DateRange): Promise<ExpenseSummaryRow[]> {
  const rows = unwrap(
    await db
      .from("expenses")
      .select(
        `expense_no, expense_date, description, amount, tax_amount, total, status,
         category:expense_categories!expenses_category_id_fkey(name)`,
      )
      .gte("expense_date", range.from)
      .lte("expense_date", range.to)
      .eq("status", "posted")
      .order("expense_date", { ascending: false })
      .limit(1000),
  ) as unknown as (Omit<ExpenseSummaryRow, "category_name"> & {
    category: { name: string } | null;
  })[];

  return rows.map(({ category, ...row }) => ({
    ...row,
    category_name: category?.name ?? "Uncategorised",
  }));
}

export type StockValuationRow = {
  sku: string;
  name: string;
  warehouse_name: string;
  quantity: number;
  average_cost: number;
  total_value: number;
};

export async function fetchStockValuation(): Promise<StockValuationRow[]> {
  const rows = unwrap(
    await db
      .from("inventory_balances")
      .select(
        `quantity, average_cost, total_value,
         product:products!inventory_balances_product_id_fkey(sku, name),
         warehouse:warehouses!inventory_balances_warehouse_id_fkey(name)`,
      )
      .gt("quantity", 0)
      .limit(2000),
  ) as unknown as {
    quantity: number;
    average_cost: number;
    total_value: number;
    product: { sku: string; name: string } | null;
    warehouse: { name: string } | null;
  }[];

  return rows.map((row) => ({
    sku: row.product?.sku ?? "",
    name: row.product?.name ?? "",
    warehouse_name: row.warehouse?.name ?? "",
    quantity: Number(row.quantity),
    average_cost: Number(row.average_cost),
    total_value: Number(row.total_value),
  }));
}

export type PayrollSummaryRow = {
  run_no: string;
  period_name: string;
  employee_count: number;
  total_gross: number;
  total_paye: number;
  total_statutory: number;
  total_net: number;
  status: string;
};

export async function fetchPayrollSummary(): Promise<PayrollSummaryRow[]> {
  const rows = unwrap(
    await db
      .from("payroll_runs")
      .select(
        `run_no, employee_count, total_gross, total_paye, total_statutory, total_net, status,
         period:payroll_periods!payroll_runs_period_id_fkey(name)`,
      )
      .in("status", ["posted", "paid"])
      .order("created_at", { ascending: false })
      .limit(100),
  ) as unknown as (Omit<PayrollSummaryRow, "period_name"> & {
    period: { name: string } | null;
  })[];

  return rows.map(({ period, ...row }) => ({ ...row, period_name: period?.name ?? "—" }));
}

/** Groups any rows by a key and sums a numeric field. */
export function groupSum<T>(
  rows: readonly T[],
  keyOf: (row: T) => string,
  valueOf: (row: T) => number,
): { key: string; value: number; count: number }[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const row of rows) {
    const key = keyOf(row);
    const current = map.get(key) ?? { value: 0, count: 0 };
    map.set(key, { value: current.value + valueOf(row), count: current.count + 1 });
  }
  return [...map.entries()]
    .map(([key, { value, count }]) => ({ key, value: Math.round(value * 100) / 100, count }))
    .sort((a, b) => b.value - a.value);
}

// ---------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------

export const reportKeys = {
  all: ["reports"] as const,
  sales: (range: DateRange) => ["reports", "sales", range.from, range.to] as const,
  purchases: (range: DateRange) => ["reports", "purchases", range.from, range.to] as const,
  expenses: (range: DateRange) => ["reports", "expenses", range.from, range.to] as const,
  stock: ["reports", "stock"] as const,
  payroll: ["reports", "payroll"] as const,
};

export function useSalesSummary(range: DateRange, enabled = true) {
  return useQuery({
    queryKey: reportKeys.sales(range),
    queryFn: () => fetchSalesSummary(range),
    enabled,
    staleTime: 60_000,
  });
}

export function usePurchaseSummary(range: DateRange, enabled = true) {
  return useQuery({
    queryKey: reportKeys.purchases(range),
    queryFn: () => fetchPurchaseSummary(range),
    enabled,
    staleTime: 60_000,
  });
}

export function useExpenseSummary(range: DateRange, enabled = true) {
  return useQuery({
    queryKey: reportKeys.expenses(range),
    queryFn: () => fetchExpenseSummary(range),
    enabled,
    staleTime: 60_000,
  });
}

export function useStockValuation(enabled = true) {
  return useQuery({
    queryKey: reportKeys.stock,
    queryFn: fetchStockValuation,
    enabled,
    staleTime: 60_000,
  });
}

export function usePayrollSummary(enabled = true) {
  return useQuery({
    queryKey: reportKeys.payroll,
    queryFn: fetchPayrollSummary,
    enabled,
    staleTime: 60_000,
  });
}

/** First and last day of the month containing a date. */
export function monthRange(date = new Date()): DateRange {
  const from = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const to = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}
