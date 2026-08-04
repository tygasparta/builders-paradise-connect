import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Banknote,
  Boxes,
  CreditCard,
  Landmark,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";

import { PageHeader } from "@/components/erp/topbar";
import { SectionCard, StatCard, StatusPill } from "@/components/erp/ui-kit";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  KPIS,
  MONTHLY,
  PURCHASE_ORDERS,
  RECENT_TRANSACTIONS,
  TOP_PRODUCTS,
  compact,
  inventoryValue,
  lowStock,
  money,
  qty,
} from "@/lib/erp-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Builders Paradise ERP" },
      {
        name: "description",
        content:
          "Live trading overview for Builders Paradise Hardware: sales, purchases, cash, inventory value and gross profit.",
      },
      { property: "og:title", content: "Dashboard — Builders Paradise ERP" },
      {
        property: "og:description",
        content: "Live trading overview for Builders Paradise Hardware: sales, purchases, cash, inventory value and gross profit.",
      },
    ],
  }),
  component: Dashboard,
});

const axis = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-float">
      <p className="mb-1 text-xs font-semibold">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="num text-xs text-muted-foreground">
          <span className="mr-2 inline-block size-2 rounded-sm" style={{ background: p.color }} />
          {p.name}: {money(p.value)}
        </p>
      ))}
    </div>
  );
}

function Dashboard() {
  const pendingPOs = PURCHASE_ORDERS.filter((p) => p.status === "Pending Approval");

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Dashboard"
        badge="Live"
        description="Tuesday, 4 August 2026 — trading position across all branches."
        actions={
          <>
            <Button variant="outline" className="rounded-lg">
              Export
            </Button>
            <Button className="rounded-lg">New sale</Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today's sales"
          value={money(KPIS.todaySales)}
          delta={12.4}
          sub="vs yesterday"
          tone="primary"
          icon={<ReceiptText className="size-4" />}
        />
        <StatCard
          label="Today's purchases"
          value={money(KPIS.todayPurchases)}
          delta={-4.2}
          sub="3 goods receipts"
          icon={<ShoppingCart className="size-4" />}
        />
        <StatCard
          label="Gross profit (MTD)"
          value={money(KPIS.grossProfitMtd)}
          delta={3.1}
          sub={`${KPIS.grossMarginPct}% margin`}
          tone="success"
          icon={<TrendingUp className="size-4" />}
        />
        <StatCard
          label="Inventory value (cost)"
          value={money(inventoryValue)}
          sub={`${PRODUCT_COUNT} active SKUs`}
          icon={<Boxes className="size-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Cash on hand"
          value={money(KPIS.cashBalance)}
          sub="4 tills reconciled"
          icon={<Banknote className="size-4" />}
        />
        <StatCard
          label="Bank balance"
          value={money(KPIS.bankBalance)}
          sub="CBZ current account"
          icon={<Landmark className="size-4" />}
        />
        <StatCard
          label="Customer balances"
          value={money(KPIS.arOutstanding)}
          sub="Receivable outstanding"
          tone="warning"
          icon={<CreditCard className="size-4" />}
        />
        <StatCard
          label="Supplier balances"
          value={money(KPIS.apOutstanding)}
          sub="Payable outstanding"
          tone="danger"
          icon={<CreditCard className="size-4" />}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="Sales vs purchases"
          description="Rolling 7 months, all branches"
          className="xl:col-span-2"
          bodyClassName="pt-2"
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={MONTHLY} margin={{ left: -12, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gPur" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="month" {...axis} />
              <YAxis {...axis} tickFormatter={(v) => compact(v as number)} width={52} />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="sales"
                name="Sales"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                fill="url(#gSales)"
              />
              <Area
                type="monotone"
                dataKey="purchases"
                name="Purchases"
                stroke="var(--color-chart-2)"
                strokeWidth={2}
                fill="url(#gPur)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Income vs expenses" description="Monthly comparison" bodyClassName="pt-2">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={MONTHLY} margin={{ left: -18, right: 8, top: 8 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="month" {...axis} />
              <YAxis {...axis} tickFormatter={(v) => compact(v as number)} width={52} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)" }} />
              <Bar dataKey="sales" name="Income" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              <Bar
                dataKey="expenses"
                name="Expenses"
                fill="var(--color-chart-2)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="Recent transactions"
          description="Posted across POS, sales, purchasing and finance"
          className="xl:col-span-2"
          bodyClassName="p-0"
          actions={
            <Button variant="ghost" size="sm" className="text-primary">
              View all
            </Button>
          }
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Reference</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Party</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="pr-5 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RECENT_TRANSACTIONS.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="num pl-5 font-medium">{t.id}</TableCell>
                  <TableCell className="text-muted-foreground">{t.type}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{t.party}</TableCell>
                  <TableCell className="num text-right font-medium">{money(t.amount)}</TableCell>
                  <TableCell className="pr-5 text-right">
                    <StatusPill status={t.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>

        <div className="flex flex-col gap-4">
          <SectionCard
            title="Low stock alerts"
            description={`${lowStock.length} items at or below reorder level`}
            bodyClassName="space-y-4"
          >
            {lowStock.slice(0, 5).map((p) => (
              <div key={p.id}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="num shrink-0 text-xs text-muted-foreground">
                    {qty(p.onHand)} / {qty(p.reorder)}
                  </span>
                </div>
                <Progress
                  value={Math.min(100, (p.onHand / Math.max(p.reorder, 1)) * 100)}
                  className="mt-2 h-1.5"
                />
              </div>
            ))}
            <div className="flex items-center gap-2 rounded-lg bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
              <TriangleAlert className="size-3.5 shrink-0" />
              Raise requisitions before the weekend build rush.
            </div>
          </SectionCard>

          <SectionCard
            title="Pending purchase approvals"
            description={`${pendingPOs.length} orders awaiting sign-off`}
            bodyClassName="space-y-3"
          >
            {pendingPOs.map((po) => (
              <div
                key={po.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="num text-sm font-medium">{po.id}</p>
                  <p className="truncate text-xs text-muted-foreground">{po.supplier}</p>
                </div>
                <div className="text-right">
                  <p className="num text-sm font-semibold">{money(po.total)}</p>
                  <button className="text-[11px] font-semibold text-primary hover:underline">
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </SectionCard>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <SectionCard title="Top selling products" description="By revenue, month to date">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={TOP_PRODUCTS} layout="vertical" margin={{ left: 60, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" {...axis} tickFormatter={(v) => compact(v as number)} />
              <YAxis type="category" dataKey="name" {...axis} width={150} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)" }} />
              <Bar dataKey="revenue" name="Revenue" radius={[0, 6, 6, 0]}>
                {TOP_PRODUCTS.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? "var(--color-primary)" : "var(--color-chart-3)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Gross profit trend" description="Sales less cost of sales">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={MONTHLY.map((m) => ({ month: m.month, profit: m.sales - m.purchases }))}
              margin={{ left: -12, right: 8, top: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="month" {...axis} />
              <YAxis {...axis} tickFormatter={(v) => compact(v as number)} width={52} />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="profit"
                name="Gross profit"
                stroke="var(--color-success)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--color-success)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>
    </div>
  );
}

const PRODUCT_COUNT = 15;
