import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Download,
  Landmark,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/erp/page-header";
import { RequirePermission } from "@/components/erp/permission-gate";
import { CardsSkeleton, EmptyState, ErrorState, TableSkeleton } from "@/components/erp/states";
import { SectionCard } from "@/components/erp/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Field } from "@/components/erp/form-field";
import {
  useBankAccounts,
  useBankTransactions,
  useRecordBankTransaction,
  useSetReconciled,
} from "@/features/finance/api";
import { useAccounts } from "@/features/accounting/api";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import type { BankTransactionType } from "@/lib/database.types";
import { downloadCsv } from "@/lib/export";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/banking")({
  component: BankingPage,
});

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function BankingPage() {
  return (
    <RequirePermission require={PERMISSIONS.BANKING_VIEW} what="banking">
      <BankingScreen />
    </RequirePermission>
  );
}

function BankingScreen() {
  const { can } = usePermissions();
  const canRecord = can(PERMISSIONS.BANKING_TRANSACTIONS_CREATE);
  const canReconcile = can(PERMISSIONS.BANKING_RECONCILE);
  const canExport = can(PERMISSIONS.REPORTS_EXPORT);

  const accounts = useBankAccounts();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const transactions = useBankTransactions(accountId);
  const setReconciled = useSetReconciled();

  // Default to the account marked default, else the first one.
  useEffect(() => {
    if (accountId || !accounts.data?.length) return;
    setAccountId(accounts.data.find((a) => a.is_default)?.id ?? accounts.data[0]!.id);
  }, [accounts.data, accountId]);

  const account = accounts.data?.find((a) => a.id === accountId) ?? null;
  const rows = useMemo(() => transactions.data ?? [], [transactions.data]);

  /**
   * Book balance is opening plus every movement. The reconciled balance
   * counts only lines ticked off against a statement — the gap between
   * them is what has not yet cleared.
   */
  const balances = useMemo(() => {
    const opening = Number(account?.opening_balance ?? 0);
    const movements = rows.reduce((sum, row) => sum + Number(row.amount), 0);
    const cleared = rows
      .filter((row) => row.reconciled)
      .reduce((sum, row) => sum + Number(row.amount), 0);
    return {
      book: opening + movements,
      reconciled: opening + cleared,
      unreconciled: rows.filter((r) => !r.reconciled).length,
      moneyIn: rows.filter((r) => Number(r.amount) > 0).reduce((s, r) => s + Number(r.amount), 0),
      moneyOut: rows.filter((r) => Number(r.amount) < 0).reduce((s, r) => s + Number(r.amount), 0),
    };
  }, [rows, account]);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportStatement = () => {
    downloadCsv(`Bank statement ${account?.name ?? ""}`, rows, [
      { header: "Reference", value: (t) => t.reference_no },
      { header: "Date", value: (t) => t.transaction_date },
      { header: "Description", value: (t) => t.description },
      { header: "Their reference", value: (t) => t.reference },
      { header: "Type", value: (t) => t.transaction_type },
      { header: "Amount", value: (t) => Number(t.amount).toFixed(2) },
      { header: "Source", value: (t) => t.source_module },
      { header: "Reconciled", value: (t) => (t.reconciled ? "Yes" : "") },
    ]);
    toast.success(`${plural(rows.length, "line")} exported`);
  };

  if (accounts.isLoading) return <CardsSkeleton count={3} />;

  if (accounts.isError) {
    return (
      <>
        <PageHeader title="Banking" breadcrumbs={[{ label: "Finance" }, { label: "Banking" }]} />
        <div className="card-surface">
          <ErrorState error={accounts.error} onRetry={() => void accounts.refetch()} />
        </div>
      </>
    );
  }

  if ((accounts.data?.length ?? 0) === 0) {
    return (
      <>
        <PageHeader
          title="Banking"
          description="Bank accounts, statement lines and reconciliation."
          breadcrumbs={[{ label: "Finance" }, { label: "Banking" }]}
        />
        <div className="card-surface">
          <EmptyState
            icon={<Landmark className="size-5" />}
            title="No bank accounts yet"
            description="A bank account links to a ledger account, so every movement on the statement lands in the general ledger. Add one in Settings."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Banking"
        description="Every line here has a journal behind it. Reconciliation is ticking off what the bank agrees with."
        breadcrumbs={[{ label: "Finance" }, { label: "Banking" }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={accountId ?? ""} onValueChange={setAccountId}>
              <SelectTrigger className="h-9 w-52" aria-label="Bank account">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.data?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} — {a.bank_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canExport && (
              <Button variant="outline" onClick={exportStatement} disabled={rows.length === 0}>
                <Download className="size-4" />
                Export
              </Button>
            )}
            {canRecord && (
              <Button onClick={() => setRecordOpen(true)}>
                <Plus className="size-4" />
                Record transaction
              </Button>
            )}
          </div>
        }
      />

      <section aria-label="Balances" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card-surface p-4">
          <p className="text-xs text-muted-foreground">Balance per books</p>
          <p
            className={cn(
              "num mt-1 text-xl font-semibold",
              balances.book < 0 && "text-destructive",
            )}
          >
            {money(balances.book)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {account?.currency_code} · opening {money(account?.opening_balance)}
          </p>
        </div>
        <div className="card-surface p-4">
          <p className="text-xs text-muted-foreground">Reconciled balance</p>
          <p className="num mt-1 text-xl font-semibold">{money(balances.reconciled)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {balances.unreconciled === 0
              ? "Everything ticked off"
              : `${plural(balances.unreconciled, "line")} not yet cleared`}
          </p>
        </div>
        <div className="card-surface p-4">
          <p className="text-xs text-muted-foreground">Money in</p>
          <p className="num mt-1 text-xl font-semibold text-success">{money(balances.moneyIn)}</p>
        </div>
        <div className="card-surface p-4">
          <p className="text-xs text-muted-foreground">Money out</p>
          <p className="num mt-1 text-xl font-semibold text-destructive">
            {money(Math.abs(balances.moneyOut))}
          </p>
        </div>
      </section>

      {account?.ledger_account && (
        <p className="mt-3 text-xs text-muted-foreground">
          Posting to{" "}
          <span className="num font-medium text-foreground">
            {account.ledger_account.account_code}
          </span>{" "}
          {account.ledger_account.name}.
        </p>
      )}

      <div className="mt-4">
        <SectionCard
          title="Statement lines"
          description="Most recent 200. Lines created by other modules cannot be edited here."
          bodyClassName="p-0"
          actions={
            canReconcile && selected.size > 0 ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setReconciled.mutate({ ids: [...selected], reconciled: true });
                    setSelected(new Set());
                  }}
                  disabled={setReconciled.isPending}
                >
                  <CheckCircle2 className="size-3.5" />
                  Reconcile {selected.size}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </div>
            ) : undefined
          }
        >
          {transactions.isLoading ? (
            <div className="p-4">
              <TableSkeleton columns={5} rows={6} />
            </div>
          ) : transactions.isError ? (
            <ErrorState error={transactions.error} onRetry={() => void transactions.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Landmark className="size-5" />}
              title="No movements yet"
              description="Post an expense from this account, or record a bank charge, and it appears here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((transaction) => {
                const isIn = Number(transaction.amount) > 0;
                return (
                  <li
                    key={transaction.id}
                    className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    {canReconcile && (
                      <Checkbox
                        checked={transaction.reconciled || selected.has(transaction.id)}
                        disabled={transaction.reconciled}
                        onCheckedChange={() => toggle(transaction.id)}
                        aria-label={`Reconcile ${transaction.reference_no}`}
                      />
                    )}
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full",
                        isIn ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive",
                      )}
                      aria-hidden
                    >
                      {isIn ? (
                        <ArrowDownLeft className="size-3.5" />
                      ) : (
                        <ArrowUpRight className="size-3.5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{transaction.description}</p>
                      <p className="num truncate text-[11px] text-muted-foreground">
                        {format(new Date(transaction.transaction_date), "dd MMM yyyy")} ·{" "}
                        {transaction.reference_no}
                        {transaction.reference ? ` · ${transaction.reference}` : ""}
                      </p>
                    </div>
                    {transaction.source_module && transaction.source_module !== "banking" && (
                      <Badge variant="secondary" className="hidden text-[10px] sm:inline-flex">
                        {transaction.source_module}
                      </Badge>
                    )}
                    {transaction.reconciled && (
                      <Badge className="border-0 bg-success/12 text-[10px] text-success">
                        Reconciled
                      </Badge>
                    )}
                    <span
                      className={cn(
                        "num w-28 shrink-0 text-right text-sm font-medium",
                        isIn ? "text-success" : "text-destructive",
                      )}
                    >
                      {isIn ? "+" : "−"}
                      {money(Math.abs(Number(transaction.amount)))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      <RecordTransactionDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
        bankAccountId={accountId}
      />
    </>
  );
}

// ---------------------------------------------------------------------

const TYPE_LABELS: Record<BankTransactionType, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  charge: "Bank charge",
  interest: "Interest received",
  transfer: "Transfer",
  other: "Other",
};

function RecordTransactionDialog({
  open,
  onOpenChange,
  bankAccountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankAccountId: string | null;
}) {
  const record = useRecordBankTransaction();
  const { data: accounts } = useAccounts();

  const [type, setType] = useState<BankTransactionType>("charge");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState(0);
  const [contraAccount, setContraAccount] = useState("6600");
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType("charge");
    setDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setReference("");
    setAmount(0);
    setContraAccount("6600");
    setServerError(null);
  }, [open]);

  // Charges and withdrawals take money out; the sign is derived rather
  // than typed, so a negative cannot be entered by accident.
  const moneyOut = type === "charge" || type === "withdrawal";
  const signedAmount = moneyOut ? -Math.abs(amount) : Math.abs(amount);

  const postable = (accounts ?? []).filter((a) => a.is_postable);

  const onSubmit = async () => {
    setServerError(null);
    if (!bankAccountId) return setServerError("Choose a bank account first.");
    if (description.trim() === "") return setServerError("Give a description.");
    if (amount <= 0) return setServerError("The amount must be more than nil.");
    if (!contraAccount)
      return setServerError("Choose the account for the other side of the entry.");

    try {
      await record.mutateAsync({
        bank_account_id: bankAccountId,
        transaction_date: date,
        description: description.trim(),
        amount: signedAmount,
        transaction_type: type,
        contra_account: contraAccount,
        reference: reference.trim() || null,
      });
      onOpenChange(false);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "It could not be recorded.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record bank transaction</DialogTitle>
          <DialogDescription>
            For charges, interest and other movements that no other module creates. This posts
            straight to the ledger.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {serverError && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive"
            >
              {serverError}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" htmlFor="txn_type" required>
              <Select value={type} onValueChange={(v) => setType(v as BankTransactionType)}>
                <SelectTrigger id="txn_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date" htmlFor="txn_date" required>
              <Input
                id="txn_date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Description" htmlFor="txn_description" required>
            <Input
              id="txn_description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Monthly account maintenance fee"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Amount"
              htmlFor="txn_amount"
              required
              hint={moneyOut ? "Leaves the account." : "Comes into the account."}
            >
              <Input
                id="txn_amount"
                type="number"
                min="0"
                step="0.01"
                className="num text-right"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value || 0))}
              />
            </Field>
            <Field label="Reference" htmlFor="txn_reference">
              <Input
                id="txn_reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Other side of the entry"
            htmlFor="txn_contra"
            required
            hint={
              moneyOut
                ? "This account is debited; the bank is credited."
                : "This account is credited; the bank is debited."
            }
          >
            <Select value={contraAccount} onValueChange={setContraAccount}>
              <SelectTrigger id="txn_contra">
                <SelectValue placeholder="Choose an account" />
              </SelectTrigger>
              <SelectContent>
                {postable.map((account) => (
                  <SelectItem key={account.id} value={account.account_code}>
                    {account.account_code} — {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {amount > 0 && (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              The bank balance will move by{" "}
              <span
                className={cn("num font-semibold", moneyOut ? "text-destructive" : "text-success")}
              >
                {moneyOut ? "−" : "+"}
                {money(Math.abs(amount))}
              </span>
              .
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={record.isPending}>
            {record.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Record and post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
