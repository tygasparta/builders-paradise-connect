import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { db, unwrap } from "@/lib/supabase";
import type {
  BankAccountRow,
  BankTransactionRow,
  BankTransactionType,
  ExpenseCategoryRow,
  ExpenseRow,
  ExpenseStatus,
} from "@/lib/database.types";

// ---------------------------------------------------------------------
// Banking
// ---------------------------------------------------------------------

export type BankAccountWithLedger = BankAccountRow & {
  ledger_account: { account_code: string; name: string } | null;
};

export type BankTransactionWithAccount = BankTransactionRow & {
  bank_account: { name: string; bank_name: string } | null;
};

export async function listBankAccounts(): Promise<BankAccountWithLedger[]> {
  return unwrap(
    await db
      .from("bank_accounts")
      .select(
        "*, ledger_account:chart_of_accounts!bank_accounts_ledger_account_id_fkey(account_code, name)",
      )
      .order("name"),
  ) as unknown as BankAccountWithLedger[];
}

export async function listBankTransactions(
  bankAccountId: string | null,
): Promise<BankTransactionWithAccount[]> {
  let query = db
    .from("bank_transactions")
    .select("*, bank_account:bank_accounts!bank_transactions_bank_account_id_fkey(name, bank_name)")
    .order("transaction_date", { ascending: false })
    .limit(200);
  if (bankAccountId) query = query.eq("bank_account_id", bankAccountId);
  return unwrap(await query) as unknown as BankTransactionWithAccount[];
}

export type BankTransactionInput = {
  bank_account_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: BankTransactionType;
  contra_account: string;
  reference: string | null;
};

export async function recordBankTransaction(input: BankTransactionInput): Promise<string> {
  const { data, error } = await db.rpc("post_bank_transaction", {
    p_bank_account_id: input.bank_account_id,
    p_date: input.transaction_date,
    p_description: input.description,
    p_amount: input.amount,
    p_type: input.transaction_type,
    p_contra_account: input.contra_account,
    p_reference: input.reference,
  });
  if (error) throw new Error(error.message);
  return data as unknown as string;
}

/** Marks statement lines as reconciled, or clears them. */
export async function setReconciled(ids: string[], reconciled: boolean): Promise<void> {
  if (ids.length === 0) return;
  unwrap(await db.from("bank_transactions").update({ reconciled }).in("id", ids).select("id"));
}

// ---------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------

export type ExpenseWithRefs = ExpenseRow & {
  category: { code: string; name: string } | null;
  bank_account: { name: string } | null;
  supplier: { name: string } | null;
};

const EXPENSE_SELECT: string = `
  *,
  category:expense_categories!expenses_category_id_fkey(code, name),
  bank_account:bank_accounts!expenses_bank_account_id_fkey(name),
  supplier:suppliers!expenses_supplier_id_fkey(name)
`;

export async function listExpenses(status: ExpenseStatus | null): Promise<ExpenseWithRefs[]> {
  let query = db
    .from("expenses")
    .select(EXPENSE_SELECT)
    .order("expense_date", { ascending: false })
    .limit(300);
  if (status) query = query.eq("status", status);
  return unwrap(await query) as unknown as ExpenseWithRefs[];
}

export async function listExpenseCategories(): Promise<ExpenseCategoryRow[]> {
  return unwrap(
    await db.from("expense_categories").select("*").eq("status", "active").order("name"),
  ) as ExpenseCategoryRow[];
}

export type ExpenseInput = {
  category_id: string;
  branch_id: string | null;
  supplier_id: string | null;
  expense_date: string;
  description: string;
  reference: string | null;
  amount: number;
  tax_amount: number;
  payment_method: ExpenseRow["payment_method"];
  bank_account_id: string | null;
  notes: string | null;
};

export async function createExpense(input: ExpenseInput): Promise<string> {
  const { data: number, error: numberError } = await db.rpc("next_document_number", {
    p_doc_type: "expense",
  });
  if (numberError) throw new Error(numberError.message);

  const rows = unwrap(
    await db
      .from("expenses")
      .insert({
        expense_no: number as unknown as string,
        category_id: input.category_id,
        branch_id: input.branch_id,
        supplier_id: input.supplier_id,
        expense_date: input.expense_date,
        description: input.description,
        reference: input.reference,
        amount: input.amount,
        tax_amount: input.tax_amount,
        total: input.amount + input.tax_amount,
        payment_method: input.payment_method,
        bank_account_id: input.bank_account_id,
        notes: input.notes,
        status: "draft",
      })
      .select("expense_no"),
  ) as { expense_no: string }[];

  return rows[0]?.expense_no ?? (number as unknown as string);
}

export async function setExpenseStatus(id: string, status: ExpenseStatus): Promise<void> {
  const now = new Date().toISOString();
  const patch: Partial<
    Omit<ExpenseRow, "id" | "created_at" | "updated_at" | "created_by" | "updated_by">
  > = {
    status,
    ...(status === "submitted" ? { submitted_at: now } : {}),
    ...(status === "approved" ? { approved_at: now } : {}),
  };
  const rows = unwrap(await db.from("expenses").update(patch).eq("id", id).select("id")) as {
    id: string;
  }[];
  if (rows.length === 0) {
    throw new Error("The expense could not be updated. You may not have permission.");
  }
}

export async function postExpense(id: string): Promise<string> {
  const { data, error } = await db.rpc("post_expense", { p_expense_id: id });
  if (error) throw new Error(error.message);
  return data as unknown as string;
}

// ---------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------

export const financeKeys = {
  all: ["finance"] as const,
  bankAccounts: ["finance", "bank-accounts"] as const,
  bankTransactions: (id: string | null) => ["finance", "bank-txns", id ?? "all"] as const,
  expenses: (status: string | null) => ["finance", "expenses", status ?? "all"] as const,
  categories: ["finance", "expense-categories"] as const,
};

export function useBankAccounts() {
  return useQuery({
    queryKey: financeKeys.bankAccounts,
    queryFn: listBankAccounts,
    staleTime: 60_000,
  });
}

export function useBankTransactions(bankAccountId: string | null) {
  return useQuery({
    queryKey: financeKeys.bankTransactions(bankAccountId),
    queryFn: () => listBankTransactions(bankAccountId),
    staleTime: 30_000,
  });
}

export function useExpenses(status: ExpenseStatus | null) {
  return useQuery({
    queryKey: financeKeys.expenses(status),
    queryFn: () => listExpenses(status),
    staleTime: 30_000,
  });
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: financeKeys.categories,
    queryFn: listExpenseCategories,
    staleTime: 5 * 60_000,
  });
}

export function useRecordBankTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recordBankTransaction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      toast.success("Recorded and posted to the ledger");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetReconciled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, reconciled }: { ids: string[]; reconciled: boolean }) =>
      setReconciled(ids, reconciled),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: financeKeys.all });
      toast.success(variables.reconciled ? "Marked as reconciled" : "Reconciliation cleared");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createExpense,
    onSuccess: (number) => {
      void queryClient.invalidateQueries({ queryKey: financeKeys.all });
      toast.success(`${number} created — submit it for approval`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetExpenseStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ExpenseStatus }) =>
      setExpenseStatus(id, status),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: financeKeys.all });
      const labels: Record<string, string> = {
        submitted: "Sent for approval",
        approved: "Approved — it can now be posted",
        rejected: "Expense rejected",
        cancelled: "Expense cancelled",
      };
      toast.success(labels[variables.status] ?? "Expense updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function usePostExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postExpense,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      toast.success("Posted to the ledger");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export const EXPENSE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  posted: "Posted",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank: "Bank transfer",
  petty_cash: "Petty cash",
  card: "Card",
  mobile_money: "Mobile money",
};
