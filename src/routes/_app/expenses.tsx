import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  CheckCircle2,
  Download,
  Loader2,
  MoreHorizontal,
  Plus,
  Receipt,
  Send,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/erp/page-header";
import { DataTable } from "@/components/erp/data-table";
import { RequirePermission } from "@/components/erp/permission-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Field } from "@/components/erp/form-field";
import {
  EXPENSE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  useBankAccounts,
  useCreateExpense,
  useExpenseCategories,
  useExpenses,
  usePostExpense,
  useSetExpenseStatus,
  type ExpenseWithRefs,
} from "@/features/finance/api";
import { useSuppliers } from "@/features/suppliers/hooks";
import { useAuth } from "@/lib/auth/auth-context";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import type { ExpenseRow, ExpenseStatus } from "@/lib/database.types";
import { downloadCsv } from "@/lib/export";
import { plural } from "@/lib/format";

export const Route = createFileRoute("/_app/expenses")({
  component: ExpensesPage,
});

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-warning/20 text-warning-foreground",
  approved: "bg-info/12 text-info",
  posted: "bg-success/12 text-success",
  rejected: "bg-destructive/12 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

function ExpensesPage() {
  return (
    <RequirePermission require={PERMISSIONS.EXPENSES_VIEW} what="expenses">
      <ExpensesScreen />
    </RequirePermission>
  );
}

function ExpensesScreen() {
  const { can } = usePermissions();
  const canCreate = can(PERMISSIONS.EXPENSES_CREATE);
  const canApprove = can(PERMISSIONS.EXPENSES_APPROVE);
  const canPost = can(PERMISSIONS.EXPENSES_POST);
  const canExport = can(PERMISSIONS.REPORTS_EXPORT);

  const [status, setStatus] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [posting, setPosting] = useState<ExpenseWithRefs | null>(null);

  const expenses = useExpenses(status === "all" ? null : (status as ExpenseStatus));
  const setExpenseStatus = useSetExpenseStatus();
  const postExpense = usePostExpense();

  const totals = useMemo(() => {
    const rows = expenses.data ?? [];
    return {
      posted: rows.filter((r) => r.status === "posted").reduce((s, r) => s + Number(r.total), 0),
      awaiting: rows.filter((r) => ["submitted", "approved"].includes(r.status)).length,
    };
  }, [expenses.data]);

  const exportExpenses = () => {
    const rows = expenses.data ?? [];
    downloadCsv("Expenses", rows, [
      { header: "Number", value: (e) => e.expense_no },
      { header: "Date", value: (e) => e.expense_date },
      { header: "Category", value: (e) => e.category?.name },
      { header: "Description", value: (e) => e.description },
      { header: "Supplier", value: (e) => e.supplier?.name },
      { header: "Method", value: (e) => PAYMENT_METHOD_LABELS[e.payment_method] },
      { header: "Net", value: (e) => Number(e.amount).toFixed(2) },
      { header: "Tax", value: (e) => Number(e.tax_amount).toFixed(2) },
      { header: "Total", value: (e) => Number(e.total).toFixed(2) },
      { header: "Status", value: (e) => EXPENSE_STATUS_LABELS[e.status] ?? e.status },
    ]);
    toast.success(`${plural(rows.length, "expense")} exported`);
  };

  const columns = useMemo<ColumnDef<ExpenseWithRefs, unknown>[]>(
    () => [
      {
        accessorKey: "expense_no",
        header: "Expense",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="num text-helper font-medium">{row.original.expense_no}</p>
            <p className="text-helper text-muted-foreground">
              {format(new Date(row.original.expense_date), "dd MMM yyyy")}
            </p>
          </div>
        ),
      },
      {
        id: "description",
        header: "Description",
        accessorFn: (row) => row.description,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-td">{row.original.description}</p>
            <p className="truncate text-helper text-muted-foreground">
              {row.original.category?.name}
              {row.original.supplier ? ` · ${row.original.supplier.name}` : ""}
            </p>
          </div>
        ),
      },
      {
        id: "method",
        header: "Paid by",
        accessorFn: (row) => row.payment_method,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-td">{PAYMENT_METHOD_LABELS[row.original.payment_method]}</p>
            {row.original.bank_account && (
              <p className="truncate text-helper text-muted-foreground">
                {row.original.bank_account.name}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "total",
        header: "Total",
        cell: ({ row }) => (
          <div className="text-right">
            <p className="num font-medium">{money(row.original.total)}</p>
            {Number(row.original.tax_amount) > 0 && (
              <p className="num text-helper text-muted-foreground">
                incl. {money(row.original.tax_amount)} tax
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-helper font-semibold ${
              TONE[row.original.status] ?? "bg-muted text-muted-foreground"
            }`}
          >
            {EXPENSE_STATUS_LABELS[row.original.status] ?? row.original.status}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const expense = row.original;
          if (["posted", "cancelled"].includes(expense.status)) {
            return (
              <span className="flex justify-end pr-2 text-helper text-muted-foreground">
                {expense.status === "posted" ? "Posted" : "—"}
              </span>
            );
          }
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Actions for ${expense.expense_no}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {expense.status === "draft" && (
                    <DropdownMenuItem
                      onSelect={() =>
                        setExpenseStatus.mutate({ id: expense.id, status: "submitted" })
                      }
                    >
                      <Send className="size-4" />
                      Submit for approval
                    </DropdownMenuItem>
                  )}
                  {canApprove && ["draft", "submitted"].includes(expense.status) && (
                    <>
                      <DropdownMenuItem
                        onSelect={() =>
                          setExpenseStatus.mutate({ id: expense.id, status: "approved" })
                        }
                      >
                        <CheckCircle2 className="size-4" />
                        Approve
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          setExpenseStatus.mutate({ id: expense.id, status: "rejected" })
                        }
                      >
                        <XCircle className="size-4" />
                        Reject
                      </DropdownMenuItem>
                    </>
                  )}
                  {canPost && expense.status === "approved" && (
                    <DropdownMenuItem onSelect={() => setPosting(expense)}>
                      <Upload className="size-4" />
                      Post to ledger
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() =>
                      setExpenseStatus.mutate({ id: expense.id, status: "cancelled" })
                    }
                  >
                    Cancel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [canApprove, canPost, setExpenseStatus],
  );

  return (
    <>
      <PageHeader
        title="Expenses"
        description="What the business spends outside stock purchases. Posting debits the category's account and credits whatever paid for it."
        breadcrumbs={[{ label: "Finance" }, { label: "Expenses" }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {canExport && (
              <Button variant="outline" onClick={exportExpenses} disabled={!expenses.data?.length}>
                <Download className="size-4" />
                Export
              </Button>
            )}
            {canCreate && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="size-4" />
                Record expense
              </Button>
            )}
          </div>
        }
      />

      {(expenses.data?.length ?? 0) > 0 && (
        <p className="mb-4 text-td text-muted-foreground">
          <span className="num font-semibold text-foreground">{money(totals.posted)}</span> posted
          {totals.awaiting > 0 && (
            <>
              {" · "}
              <span className="font-medium text-foreground">{totals.awaiting}</span> awaiting
              approval or posting
            </>
          )}
        </p>
      )}

      <DataTable
        columns={columns}
        data={expenses.data}
        isLoading={expenses.isLoading}
        error={expenses.error}
        onRetry={() => void expenses.refetch()}
        searchPlaceholder="Search by number, description or category…"
        emptyTitle={status === "all" ? "No expenses yet" : "No expenses with that status"}
        emptyDescription={
          status === "all"
            ? "Record rent, fuel, bank charges and the rest — each one posts to its own ledger account."
            : "Try a different status filter."
        }
        emptyAction={
          canCreate && status === "all" ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="size-4" />
              Record expense
            </Button>
          ) : undefined
        }
        pageSize={25}
        toolbar={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-44" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(EXPENSE_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <ExpenseFormDialog open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog open={Boolean(posting)} onOpenChange={(open) => !open && setPosting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post {posting?.expense_no}?</AlertDialogTitle>
            <AlertDialogDescription>
              This debits {posting?.category?.name} and credits{" "}
              {posting?.payment_method === "bank"
                ? (posting?.bank_account?.name ?? "the bank account")
                : PAYMENT_METHOD_LABELS[posting?.payment_method ?? "cash"]}{" "}
              with {money(posting?.total)}.
              {posting?.payment_method === "bank" &&
                " A matching line is added to the bank statement so it appears in reconciliation."}{" "}
              A posted expense cannot be edited — a mistake is corrected by reversing its journal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (posting) postExpense.mutate(posting.id);
                setPosting(null);
              }}
            >
              Post expense
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="mt-4 flex items-center gap-1.5 text-helper text-muted-foreground">
        <Receipt className="size-3.5" aria-hidden />
        Each category maps to a ledger account, so the income statement adds up without anyone
        choosing an account by hand.
      </p>
    </>
  );
}

// ---------------------------------------------------------------------

function ExpenseFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { activeBranchId } = useAuth();
  const createExpense = useCreateExpense();
  const { data: categories } = useExpenseCategories();
  const { data: bankAccounts } = useBankAccounts();
  const { data: suppliers } = useSuppliers(false);

  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [method, setMethod] = useState<ExpenseRow["payment_method"]>("cash");
  const [bankAccountId, setBankAccountId] = useState("");
  const [notes, setNotes] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCategoryId("");
    setSupplierId("");
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setReference("");
    setAmount(0);
    setTaxAmount(0);
    setMethod("cash");
    setBankAccountId(bankAccounts?.find((a) => a.is_default)?.id ?? "");
    setNotes("");
    setServerError(null);
  }, [open, bankAccounts]);

  const onSubmit = async () => {
    setServerError(null);
    if (!categoryId)
      return setServerError("Choose a category — it decides which account is debited.");
    if (description.trim() === "") return setServerError("Give a description.");
    if (amount <= 0) return setServerError("The amount must be more than nil.");
    if (method === "bank" && !bankAccountId) {
      return setServerError("Choose which bank account paid for this.");
    }

    try {
      await createExpense.mutateAsync({
        category_id: categoryId,
        branch_id: activeBranchId,
        supplier_id: supplierId || null,
        expense_date: expenseDate,
        description: description.trim(),
        reference: reference.trim() || null,
        amount,
        tax_amount: taxAmount,
        payment_method: method,
        bank_account_id: method === "bank" ? bankAccountId : null,
        notes: notes.trim() || null,
      });
      onOpenChange(false);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "The expense could not be saved.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record expense</DialogTitle>
          <DialogDescription>
            Saved as a draft. Nothing reaches the ledger until it is approved and posted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {serverError && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/8 px-3 py-2 text-td text-destructive"
            >
              {serverError}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Category"
              htmlFor="exp_category"
              required
              hint="Decides the ledger account."
            >
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="exp_category">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date" htmlFor="exp_date" required>
              <Input
                id="exp_date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Description" htmlFor="exp_description" required>
            <Input
              id="exp_description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Diesel for the delivery truck"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Supplier" htmlFor="exp_supplier" hint="Optional.">
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger id="exp_supplier">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Reference" htmlFor="exp_reference" hint="Receipt or invoice number.">
              <Input
                id="exp_reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Amount" htmlFor="exp_amount" required>
              <Input
                id="exp_amount"
                type="number"
                min="0"
                step="0.01"
                className="num text-right"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value || 0))}
              />
            </Field>
            <Field label="Tax" htmlFor="exp_tax" hint="Recoverable input tax.">
              <Input
                id="exp_tax"
                type="number"
                min="0"
                step="0.01"
                className="num text-right"
                value={taxAmount}
                onChange={(e) => setTaxAmount(Number(e.target.value || 0))}
              />
            </Field>
            <Field label="Total" htmlFor="exp_total">
              <Input
                id="exp_total"
                readOnly
                className="num bg-muted text-right font-semibold"
                value={money(amount + taxAmount)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Paid by" htmlFor="exp_method" required>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as ExpenseRow["payment_method"])}
              >
                <SelectTrigger id="exp_method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {method === "bank" && (
              <Field label="Bank account" htmlFor="exp_bank" required>
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger id="exp_bank">
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts?.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} — {account.bank_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>

          <Field label="Notes" htmlFor="exp_notes">
            <Textarea
              id="exp_notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={createExpense.isPending}>
            {createExpense.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Save expense
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
