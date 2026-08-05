import { useQuery } from "@tanstack/react-query";

import { db, unwrap } from "@/lib/supabase";
import type { AccountingPeriodRow, ChartOfAccountRow, JournalEntryRow } from "@/lib/database.types";

export type TrialBalanceRow = {
  account_code: string;
  account_name: string;
  account_type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
};

export type JournalWithLines = JournalEntryRow & {
  journal_entry_lines: {
    id: string;
    line_no: number;
    debit: number;
    credit: number;
    description: string | null;
    account: { account_code: string; name: string } | null;
  }[];
};

const JOURNAL_SELECT: string = `
  *,
  journal_entry_lines(
    id, line_no, debit, credit, description,
    account:chart_of_accounts!journal_entry_lines_account_id_fkey(account_code, name)
  )
`;

export async function listAccounts(): Promise<ChartOfAccountRow[]> {
  return unwrap(
    await db.from("chart_of_accounts").select("*").order("account_code"),
  ) as ChartOfAccountRow[];
}

export async function listPeriods(): Promise<AccountingPeriodRow[]> {
  return unwrap(
    await db
      .from("accounting_periods")
      .select("*")
      .order("fiscal_year", { ascending: false })
      .order("period_no"),
  ) as AccountingPeriodRow[];
}

export async function listJournals(limit = 50): Promise<JournalWithLines[]> {
  return unwrap(
    await db
      .from("journal_entries")
      .select(JOURNAL_SELECT)
      .order("journal_date", { ascending: false })
      .order("journal_no", { ascending: false })
      .limit(limit),
  ) as unknown as JournalWithLines[];
}

export async function fetchTrialBalance(asAt: string): Promise<TrialBalanceRow[]> {
  const { data, error } = await db.rpc("trial_balance", { p_as_at: asAt });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TrialBalanceRow[];
}

/**
 * Income statement and balance sheet, derived from the trial balance.
 *
 * Built here rather than as separate queries so both statements and the
 * trial balance can never disagree — they are three views of one dataset.
 */
export function buildStatements(rows: readonly TrialBalanceRow[]) {
  const sumOf = (types: string[]) =>
    rows
      .filter((row) => types.includes(row.account_type))
      .reduce((sum, row) => sum + Number(row.balance), 0);

  const income = sumOf(["income"]);
  const costOfSales = sumOf(["cost_of_sales"]);
  const expenses = sumOf(["expense"]);
  const grossProfit = income - costOfSales;
  const netProfit = grossProfit - expenses;

  const assets = sumOf(["asset"]);
  const liabilities = sumOf(["liability"]);
  const equity = sumOf(["equity"]);

  return {
    income,
    costOfSales,
    grossProfit,
    expenses,
    netProfit,
    assets,
    liabilities,
    equity,
    // Assets = liabilities + equity + profit for the period. A non-zero
    // figure here means something is genuinely wrong, not a rounding blip.
    balanceCheck: assets - (liabilities + equity + netProfit),
  };
}

export const accountingKeys = {
  all: ["accounting"] as const,
  accounts: ["accounting", "accounts"] as const,
  periods: ["accounting", "periods"] as const,
  journals: (limit: number) => ["accounting", "journals", limit] as const,
  trialBalance: (asAt: string) => ["accounting", "trial-balance", asAt] as const,
};

export function useAccounts() {
  return useQuery({
    queryKey: accountingKeys.accounts,
    queryFn: listAccounts,
    staleTime: 5 * 60_000,
  });
}

export function usePeriods() {
  return useQuery({
    queryKey: accountingKeys.periods,
    queryFn: listPeriods,
    staleTime: 5 * 60_000,
  });
}

export function useJournals(limit = 50) {
  return useQuery({
    queryKey: accountingKeys.journals(limit),
    queryFn: () => listJournals(limit),
    staleTime: 30_000,
  });
}

export function useTrialBalance(asAt: string) {
  return useQuery({
    queryKey: accountingKeys.trialBalance(asAt),
    queryFn: () => fetchTrialBalance(asAt),
    staleTime: 30_000,
  });
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  income: "Income",
  cost_of_sales: "Cost of sales",
  expense: "Expenses",
};
