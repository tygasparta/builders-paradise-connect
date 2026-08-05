import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Lock, Package, Users } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/erp/page-header";
import { RequirePermission } from "@/components/erp/permission-gate";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/erp/states";
import { SectionCard } from "@/components/erp/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  groupSum,
  monthRange,
  useExpenseSummary,
  usePayrollSummary,
  usePurchaseSummary,
  useSalesSummary,
  useStockValuation,
  type DateRange,
} from "@/features/reports/api";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import { downloadCsv } from "@/lib/export";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsPage,
});

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function ReportsPage() {
  return (
    <RequirePermission require={PERMISSIONS.REPORTS_VIEW} what="reports">
      <ReportsScreen />
    </RequirePermission>
  );
}

function ReportsScreen() {
  const [range, setRange] = useState<DateRange>(() => monthRange());

  return (
    <>
      <PageHeader
        title="Reports"
        description="Read straight from the same records the screens use, so a report cannot disagree with the document behind it."
        breadcrumbs={[{ label: "Control" }, { label: "Reports" }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={range.from}
              onChange={(e) => setRange((c) => ({ ...c, from: e.target.value }))}
              className="h-9 w-40"
              aria-label="Report from date"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="date"
              value={range.to}
              min={range.from}
              onChange={(e) => setRange((c) => ({ ...c, to: e.target.value }))}
              className="h-9 w-40"
              aria-label="Report to date"
            />
            <Button variant="outline" size="sm" onClick={() => setRange(monthRange())}>
              This month
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-4">
          <SalesReport range={range} />
        </TabsContent>
        <TabsContent value="purchases" className="mt-4">
          <PurchasesReport range={range} />
        </TabsContent>
        <TabsContent value="stock" className="mt-4">
          <StockReport />
        </TabsContent>
        <TabsContent value="expenses" className="mt-4">
          <ExpensesReport range={range} />
        </TabsContent>
        <TabsContent value="payroll" className="mt-4">
          <PayrollReport />
        </TabsContent>
      </Tabs>
    </>
  );
}

/** A simple proportional bar list — no chart library needed for this. */
function BreakdownBars({
  rows,
  total,
  emptyLabel,
}: {
  rows: { key: string; value: number; count: number }[];
  total: number;
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="px-5 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-2.5 px-5 py-4">
      {rows.slice(0, 12).map((row) => {
        const share = total > 0 ? (row.value / total) * 100 : 0;
        return (
          <li key={row.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{row.key}</span>
              <span className="num shrink-0 font-medium">{money(row.value)}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${Math.max(1, share)}%` }} />
              </div>
              <span className="num w-20 shrink-0 text-right text-[11px] text-muted-foreground">
                {share.toFixed(1)}% · {row.count}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Totals({
  items,
}: {
  items: { label: string; value: string; tone?: string | undefined }[];
}) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="card-surface p-4">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className={cn("num mt-1 text-xl font-semibold", item.tone)}>{item.value}</p>
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------

function SalesReport({ range }: { range: DateRange }) {
  const { can } = usePermissions();
  const canExport = can(PERMISSIONS.REPORTS_EXPORT);
  const canSeeProfit = can(PERMISSIONS.REPORTS_GROSS_PROFIT_VIEW);
  const sales = useSalesSummary(range);
  const rows = useMemo(() => sales.data ?? [], [sales.data]);

  const totals = useMemo(() => {
    const net = rows.reduce((s, r) => s + Number(r.subtotal), 0);
    const tax = rows.reduce((s, r) => s + Number(r.tax_total), 0);
    const gross = rows.reduce((s, r) => s + Number(r.total), 0);
    const paid = rows.reduce((s, r) => s + Number(r.amount_paid), 0);
    // Cost is stamped on the invoice at posting, so margin is what was
    // actually earned then — not today's cost re-applied to old sales.
    const cost = rows.reduce((s, r) => s + Number(r.cost_of_sales), 0);
    return {
      net,
      tax,
      gross,
      outstanding: gross - paid,
      cost,
      profit: net - cost,
      margin: net > 0 ? ((net - cost) / net) * 100 : 0,
    };
  }, [rows]);

  const byCustomer = useMemo(
    () =>
      groupSum(
        rows,
        (r) => r.customer_name,
        (r) => Number(r.total),
      ),
    [rows],
  );
  const byType = useMemo(
    () =>
      groupSum(
        rows,
        (r) => r.payment_type,
        (r) => Number(r.total),
      ),
    [rows],
  );

  if (sales.isLoading) return <TableSkeleton columns={5} rows={6} />;
  if (sales.isError) return <ErrorState error={sales.error} onRetry={() => void sales.refetch()} />;

  return (
    <div className="space-y-4">
      <Totals
        items={[
          { label: "Invoices", value: String(rows.length) },
          { label: "Net of tax", value: money(totals.net) },
          { label: "Total billed", value: money(totals.gross) },
          {
            label: "Still owing",
            value: money(totals.outstanding),
            tone: totals.outstanding > 0 ? "text-destructive" : undefined,
          },
        ]}
      />

      {canSeeProfit && (
        <Totals
          items={[
            { label: "Cost of sales", value: money(totals.cost) },
            {
              label: "Gross profit",
              value: money(totals.profit),
              tone: totals.profit >= 0 ? "text-success" : "text-destructive",
            },
            {
              label: "Margin",
              value: totals.net > 0 ? `${totals.margin.toFixed(1)}%` : "—",
              tone: totals.margin >= 0 ? undefined : "text-destructive",
            },
            {
              label: "Average invoice",
              value: money(rows.length > 0 ? totals.gross / rows.length : 0),
            },
          ]}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="By customer"
          description="Top 12 by value"
          bodyClassName="p-0"
          actions={
            canExport && rows.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  downloadCsv(`Sales ${range.from} to ${range.to}`, rows, [
                    { header: "Invoice", value: (r) => r.invoice_no },
                    { header: "Date", value: (r) => r.invoice_date },
                    { header: "Customer", value: (r) => r.customer_name },
                    { header: "Type", value: (r) => r.payment_type },
                    { header: "Net", value: (r) => Number(r.subtotal).toFixed(2) },
                    { header: "Discount", value: (r) => Number(r.discount_total).toFixed(2) },
                    { header: "Tax", value: (r) => Number(r.tax_total).toFixed(2) },
                    { header: "Total", value: (r) => Number(r.total).toFixed(2) },
                    { header: "Paid", value: (r) => Number(r.amount_paid).toFixed(2) },
                    ...(canSeeProfit
                      ? [
                          {
                            header: "Cost of sales",
                            value: (r: (typeof rows)[number]) => Number(r.cost_of_sales).toFixed(2),
                          },
                        ]
                      : []),
                    { header: "Status", value: (r) => r.status },
                  ]);
                  toast.success(`${plural(rows.length, "invoice")} exported`);
                }}
              >
                <Download className="size-3.5" />
                Export
              </Button>
            ) : undefined
          }
        >
          <BreakdownBars
            rows={byCustomer}
            total={totals.gross}
            emptyLabel="No sales in this period."
          />
        </SectionCard>

        <SectionCard title="Cash against credit" bodyClassName="p-0">
          <BreakdownBars rows={byType} total={totals.gross} emptyLabel="No sales in this period." />
        </SectionCard>
      </div>
    </div>
  );
}

function PurchasesReport({ range }: { range: DateRange }) {
  const { can } = usePermissions();
  const canExport = can(PERMISSIONS.REPORTS_EXPORT);
  const purchases = usePurchaseSummary(range);
  const rows = useMemo(() => purchases.data ?? [], [purchases.data]);

  const total = rows.reduce((s, r) => s + Number(r.total), 0);
  const bySupplier = useMemo(
    () =>
      groupSum(
        rows,
        (r) => r.supplier_name,
        (r) => Number(r.total),
      ),
    [rows],
  );

  if (purchases.isLoading) return <TableSkeleton columns={4} rows={6} />;
  if (purchases.isError) {
    return <ErrorState error={purchases.error} onRetry={() => void purchases.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <Totals
        items={[
          { label: "Orders", value: String(rows.length) },
          { label: "Committed", value: money(total) },
          { label: "Suppliers used", value: String(bySupplier.length) },
          {
            label: "Average order",
            value: money(rows.length > 0 ? total / rows.length : 0),
          },
        ]}
      />

      <SectionCard
        title="By supplier"
        description="Ordered in this period, excluding drafts and cancellations"
        bodyClassName="p-0"
        actions={
          canExport && rows.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                downloadCsv(`Purchases ${range.from} to ${range.to}`, rows, [
                  { header: "Order", value: (r) => r.po_no },
                  { header: "Date", value: (r) => r.order_date },
                  { header: "Supplier", value: (r) => r.supplier_name },
                  { header: "Currency", value: (r) => r.currency_code },
                  { header: "Total", value: (r) => Number(r.total).toFixed(2) },
                  { header: "Status", value: (r) => r.status },
                ]);
                toast.success(`${plural(rows.length, "order")} exported`);
              }}
            >
              <Download className="size-3.5" />
              Export
            </Button>
          ) : undefined
        }
      >
        <BreakdownBars
          rows={bySupplier}
          total={total}
          emptyLabel="No purchase orders in this period."
        />
      </SectionCard>
    </div>
  );
}

function StockReport() {
  const { can } = usePermissions();
  const canSeeCost = can(PERMISSIONS.PRODUCTS_COST_PRICE_VIEW);
  const canExport = can(PERMISSIONS.REPORTS_EXPORT);
  const stock = useStockValuation(canSeeCost);

  if (!canSeeCost) {
    return (
      <div className="card-surface">
        <EmptyState
          icon={<Lock className="size-5" />}
          title="Valuation needs the cost price permission"
          description="Stock value is derived from buying cost, so it is behind the same permission that hides cost elsewhere."
        />
      </div>
    );
  }

  if (stock.isLoading) return <TableSkeleton columns={4} rows={6} />;
  if (stock.isError) return <ErrorState error={stock.error} onRetry={() => void stock.refetch()} />;

  const rows = stock.data ?? [];
  const total = rows.reduce((s, r) => s + r.total_value, 0);
  const byWarehouse = groupSum(
    rows,
    (r) => r.warehouse_name,
    (r) => r.total_value,
  );
  const topItems = [...rows].sort((a, b) => b.total_value - a.total_value).slice(0, 12);

  return (
    <div className="space-y-4">
      <Totals
        items={[
          { label: "Lines held", value: String(rows.length) },
          { label: "Total value", value: money(total) },
          { label: "Warehouses", value: String(byWarehouse.length) },
          {
            label: "Units on hand",
            value: rows.reduce((s, r) => s + r.quantity, 0).toLocaleString(),
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="By warehouse" bodyClassName="p-0">
          <BreakdownBars rows={byWarehouse} total={total} emptyLabel="Nothing in stock." />
        </SectionCard>

        <SectionCard
          title="Largest holdings"
          description="At weighted average cost"
          bodyClassName="p-0"
          actions={
            canExport && rows.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  downloadCsv("Stock valuation", rows, [
                    { header: "SKU", value: (r) => r.sku },
                    { header: "Product", value: (r) => r.name },
                    { header: "Warehouse", value: (r) => r.warehouse_name },
                    { header: "Quantity", value: (r) => r.quantity },
                    { header: "Average cost", value: (r) => r.average_cost.toFixed(4) },
                    { header: "Value", value: (r) => r.total_value.toFixed(2) },
                  ]);
                  toast.success("Stock valuation exported");
                }}
              >
                <Download className="size-3.5" />
                Export
              </Button>
            ) : undefined
          }
        >
          {topItems.length === 0 ? (
            <EmptyState
              icon={<Package className="size-5" />}
              title="Nothing in stock"
              description="Post a goods receipt and it appears here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {topItems.map((item) => (
                <li
                  key={`${item.sku}-${item.warehouse_name}`}
                  className="flex items-center justify-between gap-3 px-5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{item.name}</p>
                    <p className="num truncate text-[11px] text-muted-foreground">
                      {item.sku} · {item.quantity} @ {money(item.average_cost)}
                    </p>
                  </div>
                  <span className="num text-sm font-medium">{money(item.total_value)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function ExpensesReport({ range }: { range: DateRange }) {
  const { can } = usePermissions();
  const canExport = can(PERMISSIONS.REPORTS_EXPORT);
  const expenses = useExpenseSummary(range);
  const rows = useMemo(() => expenses.data ?? [], [expenses.data]);

  const total = rows.reduce((s, r) => s + Number(r.total), 0);
  const tax = rows.reduce((s, r) => s + Number(r.tax_amount), 0);
  const byCategory = useMemo(
    () =>
      groupSum(
        rows,
        (r) => r.category_name,
        (r) => Number(r.total),
      ),
    [rows],
  );

  if (expenses.isLoading) return <TableSkeleton columns={4} rows={6} />;
  if (expenses.isError) {
    return <ErrorState error={expenses.error} onRetry={() => void expenses.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <Totals
        items={[
          { label: "Posted expenses", value: String(rows.length) },
          { label: "Total spent", value: money(total) },
          { label: "Recoverable tax", value: money(tax) },
          { label: "Categories used", value: String(byCategory.length) },
        ]}
      />

      <SectionCard
        title="By category"
        description="Posted only — drafts and unapproved expenses are excluded"
        bodyClassName="p-0"
        actions={
          canExport && rows.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                downloadCsv(`Expenses ${range.from} to ${range.to}`, rows, [
                  { header: "Number", value: (r) => r.expense_no },
                  { header: "Date", value: (r) => r.expense_date },
                  { header: "Category", value: (r) => r.category_name },
                  { header: "Description", value: (r) => r.description },
                  { header: "Net", value: (r) => Number(r.amount).toFixed(2) },
                  { header: "Tax", value: (r) => Number(r.tax_amount).toFixed(2) },
                  { header: "Total", value: (r) => Number(r.total).toFixed(2) },
                ]);
                toast.success(`${plural(rows.length, "expense")} exported`);
              }}
            >
              <Download className="size-3.5" />
              Export
            </Button>
          ) : undefined
        }
      >
        <BreakdownBars
          rows={byCategory}
          total={total}
          emptyLabel="No posted expenses in this period."
        />
      </SectionCard>
    </div>
  );
}

function PayrollReport() {
  const { can } = usePermissions();
  const canSee = can(PERMISSIONS.PAYROLL_VIEW);
  const canExport = can(PERMISSIONS.REPORTS_EXPORT);
  const payroll = usePayrollSummary(canSee);

  if (!canSee) {
    return (
      <div className="card-surface">
        <EmptyState
          icon={<Lock className="size-5" />}
          title="Payroll figures need the payroll permission"
          description="Wage totals are restricted in the same way the payroll module itself is."
        />
      </div>
    );
  }

  if (payroll.isLoading) return <TableSkeleton columns={5} rows={4} />;
  if (payroll.isError) {
    return <ErrorState error={payroll.error} onRetry={() => void payroll.refetch()} />;
  }

  const rows = payroll.data ?? [];
  const gross = rows.reduce((s, r) => s + Number(r.total_gross), 0);
  const paye = rows.reduce((s, r) => s + Number(r.total_paye), 0);
  const net = rows.reduce((s, r) => s + Number(r.total_net), 0);

  return (
    <div className="space-y-4">
      <Totals
        items={[
          { label: "Runs posted", value: String(rows.length) },
          { label: "Gross pay", value: money(gross) },
          { label: "PAYE withheld", value: money(paye) },
          { label: "Net paid", value: money(net) },
        ]}
      />

      <SectionCard
        title="Posted payroll runs"
        description="Draft and unapproved runs are excluded — they are not a cost yet"
        bodyClassName="p-0"
        actions={
          canExport && rows.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                downloadCsv("Payroll summary", rows, [
                  { header: "Run", value: (r) => r.run_no },
                  { header: "Period", value: (r) => r.period_name },
                  { header: "Employees", value: (r) => r.employee_count },
                  { header: "Gross", value: (r) => Number(r.total_gross).toFixed(2) },
                  { header: "PAYE", value: (r) => Number(r.total_paye).toFixed(2) },
                  { header: "Statutory", value: (r) => Number(r.total_statutory).toFixed(2) },
                  { header: "Net", value: (r) => Number(r.total_net).toFixed(2) },
                  { header: "Status", value: (r) => r.status },
                ]);
                toast.success(`${plural(rows.length, "run")} exported`);
              }}
            >
              <Download className="size-3.5" />
              Export
            </Button>
          ) : undefined
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="No posted payroll yet"
            description="Runs appear here once they are posted to the ledger."
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((run) => (
              <li key={run.run_no} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{run.period_name}</p>
                  <p className="num truncate text-[11px] text-muted-foreground">
                    {run.run_no} · {plural(run.employee_count, "employee")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="num text-sm font-medium">{money(run.total_net)}</p>
                  <p className="num text-[11px] text-muted-foreground">
                    gross {money(run.total_gross)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
