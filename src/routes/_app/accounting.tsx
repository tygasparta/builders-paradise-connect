import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { AlertTriangle, BookOpen, Download, Landmark, Lock, ScrollText } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/erp/page-header";
import { RequirePermission } from "@/components/erp/permission-gate";
import { CardsSkeleton, EmptyState, ErrorState, TableSkeleton } from "@/components/erp/states";
import { StatCard, SectionCard } from "@/components/erp/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ACCOUNT_TYPE_LABELS,
  buildStatements,
  useAccounts,
  useJournals,
  usePeriods,
  useTrialBalance,
} from "@/features/accounting/api";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import { downloadCsv } from "@/lib/export";
import { plural } from "@/lib/format";

export const Route = createFileRoute("/_app/accounting")({
  component: AccountingPage,
});

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function AccountingPage() {
  return (
    <RequirePermission require={PERMISSIONS.ACCOUNTING_VIEW} what="accounting">
      <AccountingScreen />
    </RequirePermission>
  );
}

function AccountingScreen() {
  const { can } = usePermissions();
  const canExport = can(PERMISSIONS.REPORTS_EXPORT);

  const [asAt, setAsAt] = useState(new Date().toISOString().slice(0, 10));
  const trialBalance = useTrialBalance(asAt);
  const periods = usePeriods();

  const statements = useMemo(() => buildStatements(trialBalance.data ?? []), [trialBalance.data]);

  const totals = useMemo(() => {
    const rows = trialBalance.data ?? [];
    return {
      debit: rows.reduce((sum, r) => sum + Number(r.total_debit), 0),
      credit: rows.reduce((sum, r) => sum + Number(r.total_credit), 0),
    };
  }, [trialBalance.data]);

  const balanced = Math.abs(totals.debit - totals.credit) < 0.005;
  const openPeriod = periods.data?.find((p) => p.status === "open");

  return (
    <>
      <PageHeader
        title="Accounting"
        description="The general ledger. Every figure here is posted by a module — nothing is typed in twice."
        breadcrumbs={[{ label: "Finance" }, { label: "Accounting" }]}
        actions={
          <Input
            type="date"
            value={asAt}
            onChange={(e) => setAsAt(e.target.value)}
            className="h-9 w-40"
            aria-label="Report as at date"
          />
        }
      />

      {trialBalance.isLoading ? (
        <CardsSkeleton count={4} />
      ) : trialBalance.isError ? (
        <div className="card-surface">
          <ErrorState error={trialBalance.error} onRetry={() => void trialBalance.refetch()} />
        </div>
      ) : (
        <section aria-label="Position" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Revenue"
            value={money(statements.income)}
            sub="Net of returns"
            icon={<BookOpen className="size-4" />}
            tone="primary"
          />
          <StatCard
            label="Gross profit"
            value={money(statements.grossProfit)}
            sub={
              statements.income === 0
                ? "No sales yet"
                : `${((statements.grossProfit / statements.income) * 100).toFixed(1)}% margin`
            }
            icon={<BookOpen className="size-4" />}
            tone={statements.grossProfit >= 0 ? "success" : "danger"}
          />
          <StatCard
            label="Net profit"
            value={money(statements.netProfit)}
            sub="After expenses"
            icon={<BookOpen className="size-4" />}
            tone={statements.netProfit >= 0 ? "success" : "danger"}
          />
          <StatCard
            label="Trial balance"
            value={balanced ? "Balanced" : "Out"}
            sub={balanced ? `${money(totals.debit)} each side` : "Investigate immediately"}
            icon={balanced ? <Landmark className="size-4" /> : <AlertTriangle className="size-4" />}
            tone={balanced ? "success" : "danger"}
          />
        </section>
      )}

      {!balanced && !trialBalance.isLoading && (trialBalance.data?.length ?? 0) > 0 && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2.5 text-td text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Debits and credits differ by {money(Math.abs(totals.debit - totals.credit))}. The
            posting service refuses unbalanced journals, so this points at a direct database change
            rather than an application posting.
          </span>
        </p>
      )}

      <div className="mt-4">
        <Tabs defaultValue="trial-balance">
          <TabsList>
            <TabsTrigger value="trial-balance">Trial balance</TabsTrigger>
            <TabsTrigger value="statements">Statements</TabsTrigger>
            <TabsTrigger value="journals">Journals</TabsTrigger>
            <TabsTrigger value="accounts">Chart of accounts</TabsTrigger>
            <TabsTrigger value="periods">Periods</TabsTrigger>
          </TabsList>

          <TabsContent value="trial-balance" className="mt-4">
            <TrialBalanceTab asAt={asAt} canExport={canExport} />
          </TabsContent>
          <TabsContent value="statements" className="mt-4">
            <StatementsTab statements={statements} asAt={asAt} />
          </TabsContent>
          <TabsContent value="journals" className="mt-4">
            <JournalsTab canExport={canExport} />
          </TabsContent>
          <TabsContent value="accounts" className="mt-4">
            <AccountsTab canExport={canExport} />
          </TabsContent>
          <TabsContent value="periods" className="mt-4">
            <PeriodsTab />
          </TabsContent>
        </Tabs>
      </div>

      {openPeriod && (
        <p className="mt-4 text-helper text-muted-foreground">
          Posting into <span className="font-medium">{openPeriod.name}</span>. A closed period
          cannot be reopened — corrections go into the current one.
        </p>
      )}
    </>
  );
}

// ---------------------------------------------------------------------

function TrialBalanceTab({ asAt, canExport }: { asAt: string; canExport: boolean }) {
  const trialBalance = useTrialBalance(asAt);
  const rows = trialBalance.data ?? [];

  const exportRows = () => {
    downloadCsv(`Trial balance ${asAt}`, rows, [
      { header: "Account", value: (r) => r.account_code },
      { header: "Name", value: (r) => r.account_name },
      { header: "Type", value: (r) => ACCOUNT_TYPE_LABELS[r.account_type] ?? r.account_type },
      { header: "Debit", value: (r) => Number(r.total_debit).toFixed(2) },
      { header: "Credit", value: (r) => Number(r.total_credit).toFixed(2) },
      { header: "Balance", value: (r) => Number(r.balance).toFixed(2) },
    ]);
    toast.success("Trial balance exported");
  };

  if (trialBalance.isLoading) return <TableSkeleton columns={5} rows={8} />;
  if (rows.length === 0) {
    return (
      <div className="card-surface">
        <EmptyState
          icon={<ScrollText className="size-5" />}
          title="Nothing posted yet"
          description="Post a goods receipt, a sale or an expense and the ledger fills itself."
        />
      </div>
    );
  }

  const totalDebit = rows.reduce((s, r) => s + Number(r.total_debit), 0);
  const totalCredit = rows.reduce((s, r) => s + Number(r.total_credit), 0);

  return (
    <SectionCard
      title="Trial balance"
      description={`As at ${format(new Date(asAt), "dd MMMM yyyy")}`}
      bodyClassName="p-0"
      actions={
        canExport ? (
          <Button variant="outline" size="sm" onClick={exportRows}>
            <Download className="size-3.5" />
            Export
          </Button>
        ) : undefined
      }
    >
      <div className="table-scroll">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 text-helper uppercase tracking-wider">Account</TableHead>
              <TableHead className="h-10 text-helper uppercase tracking-wider">Type</TableHead>
              <TableHead className="h-10 text-right text-helper uppercase tracking-wider">
                Debit
              </TableHead>
              <TableHead className="h-10 text-right text-helper uppercase tracking-wider">
                Credit
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.account_code}>
                <TableCell className="py-2.5">
                  <span className="num text-helper text-muted-foreground">{row.account_code}</span>
                  <span className="ml-2 text-td">{row.account_name}</span>
                </TableCell>
                <TableCell className="py-2.5 text-helper text-muted-foreground">
                  {ACCOUNT_TYPE_LABELS[row.account_type] ?? row.account_type}
                </TableCell>
                <TableCell className="num py-2.5 text-right text-td">
                  {Number(row.total_debit) === 0 ? "" : money(row.total_debit)}
                </TableCell>
                <TableCell className="num py-2.5 text-right text-td">
                  {Number(row.total_credit) === 0 ? "" : money(row.total_credit)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 border-border font-semibold hover:bg-transparent">
              <TableCell className="py-2.5" colSpan={2}>
                Total
              </TableCell>
              <TableCell className="num py-2.5 text-right">{money(totalDebit)}</TableCell>
              <TableCell className="num py-2.5 text-right">{money(totalCredit)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}

function StatementsTab({
  statements,
  asAt,
}: {
  statements: ReturnType<typeof buildStatements>;
  asAt: string;
}) {
  const line = (label: string, value: number, emphasis = false) => (
    <div
      className={
        emphasis
          ? "flex justify-between border-t border-border pt-2 text-td font-semibold"
          : "flex justify-between text-td"
      }
    >
      <dt className={emphasis ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className="num">{money(value)}</dd>
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard
        title="Income statement"
        description={`To ${format(new Date(asAt), "dd MMMM yyyy")}`}
      >
        <dl className="space-y-2">
          {line("Revenue", statements.income)}
          {line("Cost of sales", statements.costOfSales)}
          {line("Gross profit", statements.grossProfit, true)}
          {line("Expenses", statements.expenses)}
          {line("Net profit", statements.netProfit, true)}
        </dl>
      </SectionCard>

      <SectionCard
        title="Statement of financial position"
        description={`As at ${format(new Date(asAt), "dd MMMM yyyy")}`}
      >
        <dl className="space-y-2">
          {line("Assets", statements.assets)}
          {line("Liabilities", statements.liabilities)}
          {line("Equity", statements.equity)}
          {line("Profit for the period", statements.netProfit)}
          {line(
            "Liabilities + equity + profit",
            statements.liabilities + statements.equity + statements.netProfit,
            true,
          )}
        </dl>

        {Math.abs(statements.balanceCheck) >= 0.005 && (
          <p className="mt-3 flex items-start gap-1.5 text-helper text-destructive">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Assets differ from liabilities, equity and profit by{" "}
            {money(Math.abs(statements.balanceCheck))}.
          </p>
        )}
      </SectionCard>
    </div>
  );
}

function JournalsTab({ canExport }: { canExport: boolean }) {
  const journals = useJournals(50);
  const rows = journals.data ?? [];

  const exportRows = () => {
    const flat = rows.flatMap((journal) =>
      journal.journal_entry_lines.map((line) => ({
        reference: journal.reference,
        date: journal.journal_date,
        description: journal.description,
        module: journal.source_module ?? "",
        account: line.account?.account_code ?? "",
        accountName: line.account?.name ?? "",
        debit: Number(line.debit),
        credit: Number(line.credit),
        status: journal.status,
      })),
    );
    downloadCsv("Journal entries", flat, [
      { header: "Journal", value: (r) => r.reference },
      { header: "Date", value: (r) => r.date },
      { header: "Description", value: (r) => r.description },
      { header: "Module", value: (r) => r.module },
      { header: "Account", value: (r) => r.account },
      { header: "Account name", value: (r) => r.accountName },
      { header: "Debit", value: (r) => (r.debit === 0 ? "" : r.debit.toFixed(2)) },
      { header: "Credit", value: (r) => (r.credit === 0 ? "" : r.credit.toFixed(2)) },
      { header: "Status", value: (r) => r.status },
    ]);
    toast.success(`${plural(rows.length, "journal")} exported`);
  };

  if (journals.isLoading) return <TableSkeleton columns={4} rows={6} />;
  if (journals.isError) {
    return <ErrorState error={journals.error} onRetry={() => void journals.refetch()} />;
  }
  if (rows.length === 0) {
    return (
      <div className="card-surface">
        <EmptyState
          icon={<ScrollText className="size-5" />}
          title="No journals yet"
          description="Every posting from stock, sales, purchasing and expenses lands here automatically."
        />
      </div>
    );
  }

  return (
    <SectionCard
      title="Journal entries"
      description="Most recent 50. Posted journals are immutable — corrections are reversals."
      bodyClassName="p-0"
      actions={
        canExport ? (
          <Button variant="outline" size="sm" onClick={exportRows}>
            <Download className="size-3.5" />
            Export
          </Button>
        ) : undefined
      }
    >
      <ul className="divide-y divide-border">
        {rows.map((journal) => (
          <li key={journal.id} className="px-5 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="num text-helper font-medium">
                  {journal.reference}
                  {journal.status === "reversed" && (
                    <Badge className="ml-2 border-0 bg-destructive/12 text-helper text-destructive">
                      Reversed
                    </Badge>
                  )}
                  {journal.is_system && (
                    <Badge variant="secondary" className="ml-2 text-helper">
                      {journal.source_module ?? "system"}
                    </Badge>
                  )}
                </p>
                <p className="truncate text-td">{journal.description}</p>
                <p className="text-helper text-muted-foreground">
                  {format(new Date(journal.journal_date), "dd MMM yyyy")}
                </p>
              </div>
              <span className="num text-td font-medium">{money(journal.total_debit)}</span>
            </div>

            <ul className="mt-2 space-y-0.5">
              {[...journal.journal_entry_lines]
                .sort((a, b) => a.line_no - b.line_no)
                .map((line) => (
                  <li key={line.id} className="flex items-center gap-2 text-helper">
                    <span className="num w-12 shrink-0 text-muted-foreground">
                      {line.account?.account_code}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {line.account?.name}
                    </span>
                    <span className="num w-24 text-right">
                      {Number(line.debit) > 0 ? money(line.debit) : ""}
                    </span>
                    <span className="num w-24 text-right text-muted-foreground">
                      {Number(line.credit) > 0 ? money(line.credit) : ""}
                    </span>
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function AccountsTab({ canExport }: { canExport: boolean }) {
  const accounts = useAccounts();
  const rows = useMemo(() => accounts.data ?? [], [accounts.data]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const account of rows) {
      const list = map.get(account.account_type) ?? [];
      list.push(account);
      map.set(account.account_type, list);
    }
    return [...map.entries()];
  }, [rows]);

  if (accounts.isLoading) return <TableSkeleton columns={3} rows={8} />;
  if (accounts.isError) {
    return <ErrorState error={accounts.error} onRetry={() => void accounts.refetch()} />;
  }

  return (
    <SectionCard
      title="Chart of accounts"
      description={`${plural(rows.length, "account")} · headings cannot be posted to`}
      bodyClassName="p-0"
      actions={
        canExport ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              downloadCsv("Chart of accounts", rows, [
                { header: "Code", value: (a) => a.account_code },
                { header: "Name", value: (a) => a.name },
                {
                  header: "Type",
                  value: (a) => ACCOUNT_TYPE_LABELS[a.account_type] ?? a.account_type,
                },
                { header: "Postable", value: (a) => (a.is_postable ? "Yes" : "Heading") },
                { header: "System", value: (a) => (a.is_system ? "Yes" : "") },
                { header: "Status", value: (a) => a.status },
              ]);
              toast.success("Chart of accounts exported");
            }}
          >
            <Download className="size-3.5" />
            Export
          </Button>
        ) : undefined
      }
    >
      <div className="divide-y divide-border">
        {grouped.map(([type, list]) => (
          <div key={type} className="px-5 py-3">
            <h4 className="text-helper font-semibold uppercase tracking-wider text-muted-foreground">
              {ACCOUNT_TYPE_LABELS[type] ?? type}
            </h4>
            <ul className="mt-1.5 space-y-1">
              {list.map((account) => (
                <li key={account.id} className="flex items-center gap-2 text-td">
                  <span className="num w-12 shrink-0 text-helper text-muted-foreground">
                    {account.account_code}
                  </span>
                  <span
                    className={
                      account.is_postable
                        ? "min-w-0 flex-1 truncate"
                        : "min-w-0 flex-1 truncate font-semibold"
                    }
                  >
                    {account.name}
                  </span>
                  {!account.is_postable && (
                    <Badge variant="secondary" className="text-helper">
                      Heading
                    </Badge>
                  )}
                  {account.is_system && (
                    <Badge className="border-0 bg-primary/12 text-helper text-primary">
                      System
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function PeriodsTab() {
  const periods = usePeriods();
  const rows = periods.data ?? [];

  if (periods.isLoading) return <TableSkeleton columns={4} rows={6} />;
  if (periods.isError) {
    return <ErrorState error={periods.error} onRetry={() => void periods.refetch()} />;
  }

  return (
    <SectionCard
      title="Accounting periods"
      description="Posting is refused outside an open period."
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-border">
        {rows.map((period) => (
          <li key={period.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
            <div className="min-w-0">
              <p className="text-td font-medium">{period.name}</p>
              <p className="num text-helper text-muted-foreground">
                {format(new Date(period.start_date), "dd MMM")} –{" "}
                {format(new Date(period.end_date), "dd MMM yyyy")}
              </p>
            </div>
            {period.status === "open" ? (
              <Badge className="border-0 bg-success/12 text-helper text-success">Open</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 text-helper">
                <Lock className="size-2.5" aria-hidden />
                {period.status}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
