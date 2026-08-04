import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpenCheck, Landmark, Scale, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/erp/topbar";
import { SectionCard, StatCard } from "@/components/erp/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CHART_OF_ACCOUNTS, JOURNALS, KPIS, money } from "@/lib/erp-data";

export const Route = createFileRoute("/accounting")({
  head: () => ({
    meta: [
      { title: "Accounting — Builders Paradise ERP" },
      {
        name: "description",
        content:
          "Chart of accounts, trial balance, income statement, balance sheet and system-generated journals for Builders Paradise Hardware.",
      },
      { property: "og:title", content: "Accounting — Builders Paradise ERP" },
      {
        property: "og:description",
        content: "Trial balance, income statement, balance sheet and automated journal entries.",
      },
    ],
  }),
  component: Accounting,
});

const sum = (type: string, side: "debit" | "credit") =>
  CHART_OF_ACCOUNTS.filter((a) => a.type === type).reduce((s, a) => s + a[side], 0);

function Accounting() {
  const [selected, setSelected] = useState(JOURNALS[0]!);

  const totalDebit = CHART_OF_ACCOUNTS.reduce((s, a) => s + a.debit, 0);
  const totalCredit = CHART_OF_ACCOUNTS.reduce((s, a) => s + a.credit, 0);

  const revenue = sum("Income", "credit");
  const expenses = sum("Expense", "debit");
  const netProfit = revenue - expenses;
  const assets = sum("Asset", "debit");
  const liabilities = sum("Liability", "credit");
  const equity = sum("Equity", "credit");

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Accounting"
        badge="Period: Aug 2026"
        description="Double-entry ledger fed automatically by sales, POS, purchasing, inventory and payroll. Transaction-generated entries are locked from manual edits."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue (YTD)"
          value={money(revenue)}
          delta={9.2}
          tone="primary"
          icon={<Landmark className="size-4" />}
        />
        <StatCard
          label="Net profit (YTD)"
          value={money(netProfit)}
          sub={`${((netProfit / revenue) * 100).toFixed(1)}% net margin`}
          tone="success"
          icon={<Scale className="size-4" />}
        />
        <StatCard
          label="Cash & bank"
          value={money(KPIS.cashBalance + KPIS.bankBalance)}
          sub="Across 1 bank, 4 tills"
          icon={<Landmark className="size-4" />}
        />
        <StatCard
          label="Trial balance"
          value={totalDebit.toFixed(2) === totalCredit.toFixed(2) ? "Balanced" : "Out of balance"}
          sub={`${money(totalDebit)} Dr / ${money(totalCredit)} Cr`}
          tone={totalDebit.toFixed(2) === totalCredit.toFixed(2) ? "success" : "danger"}
          icon={<ShieldCheck className="size-4" />}
        />
      </div>

      <Tabs defaultValue="trial" className="mt-6">
        <TabsList className="rounded-lg">
          <TabsTrigger value="trial">Trial balance</TabsTrigger>
          <TabsTrigger value="pl">Income statement</TabsTrigger>
          <TabsTrigger value="bs">Balance sheet</TabsTrigger>
          <TabsTrigger value="journals">Journals</TabsTrigger>
        </TabsList>

        <TabsContent value="trial" className="mt-4">
          <SectionCard
            title="Trial balance"
            description="All accounts as at 4 August 2026"
            bodyClassName="p-0"
          >
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Code</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="pr-5 text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CHART_OF_ACCOUNTS.map((a) => (
                  <TableRow key={a.code}>
                    <TableCell className="num pl-5 text-muted-foreground">{a.code}</TableCell>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-border text-[11px] text-muted-foreground">
                        {a.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="num text-right">{a.debit ? money(a.debit) : "—"}</TableCell>
                    <TableCell className="num pr-5 text-right">
                      {a.credit ? money(a.credit) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableCell colSpan={3} className="pl-5 font-semibold">
                    Totals
                  </TableCell>
                  <TableCell className="num text-right font-semibold">{money(totalDebit)}</TableCell>
                  <TableCell className="num pr-5 text-right font-semibold">
                    {money(totalCredit)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="pl" className="mt-4">
          <SectionCard title="Income statement" description="Year to date" bodyClassName="max-w-2xl space-y-1">
            <StatementHeading>Revenue</StatementHeading>
            {CHART_OF_ACCOUNTS.filter((a) => a.type === "Income").map((a) => (
              <StatementRow key={a.code} label={`${a.code} ${a.name}`} value={a.credit} />
            ))}
            <StatementRow label="Total revenue" value={revenue} bold />

            <StatementHeading>Expenses</StatementHeading>
            {CHART_OF_ACCOUNTS.filter((a) => a.type === "Expense").map((a) => (
              <StatementRow key={a.code} label={`${a.code} ${a.name}`} value={a.debit} />
            ))}
            <StatementRow label="Total expenses" value={expenses} bold />

            <div className="mt-4 flex items-center justify-between rounded-lg bg-primary/10 px-4 py-3">
              <span className="text-sm font-semibold text-primary">Net profit</span>
              <span className="num text-lg font-bold text-primary">{money(netProfit)}</span>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="bs" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Assets" description="What the business owns" bodyClassName="space-y-1">
              {CHART_OF_ACCOUNTS.filter((a) => a.type === "Asset").map((a) => (
                <StatementRow key={a.code} label={`${a.code} ${a.name}`} value={a.debit} />
              ))}
              <StatementRow label="Total assets" value={assets} bold />
            </SectionCard>
            <SectionCard
              title="Liabilities & equity"
              description="What the business owes and retains"
              bodyClassName="space-y-1"
            >
              {CHART_OF_ACCOUNTS.filter((a) => a.type === "Liability" || a.type === "Equity").map(
                (a) => (
                  <StatementRow key={a.code} label={`${a.code} ${a.name}`} value={a.credit} />
                ),
              )}
              <StatementRow label="Retained profit (current)" value={netProfit} />
              <StatementRow
                label="Total liabilities & equity"
                value={liabilities + equity + netProfit}
                bold
              />
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="journals" className="mt-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <SectionCard
              title="Journal register"
              description="System-generated entries"
              className="xl:col-span-2"
              bodyClassName="p-0"
            >
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">Entry</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="pr-5 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {JOURNALS.map((j) => (
                    <TableRow
                      key={j.id}
                      onClick={() => setSelected(j)}
                      className={`cursor-pointer ${selected.id === j.id ? "bg-primary/5" : ""}`}
                    >
                      <TableCell className="num pl-5 font-medium">{j.id}</TableCell>
                      <TableCell className="num text-muted-foreground">{j.date}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-border text-[11px]">
                          {j.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="num text-muted-foreground">{j.ref}</TableCell>
                      <TableCell className="num pr-5 text-right font-medium">
                        {money(j.lines.reduce((s, l) => s + l.debit, 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SectionCard>

            <SectionCard
              title={selected.id}
              description={selected.memo}
              bodyClassName="space-y-3"
              actions={
                <Badge className="border-0 bg-muted text-[11px] text-muted-foreground">
                  <BookOpenCheck className="mr-1 size-3" /> Locked
                </Badge>
              }
            >
              <div className="num space-y-1.5 text-xs">
                {selected.lines.map((l, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-3 rounded-md bg-muted/50 px-3 py-2"
                  >
                    <span className={l.credit ? "pl-4 text-muted-foreground" : "font-medium"}>
                      {l.credit ? "Cr" : "Dr"} {l.account}
                    </span>
                    <span className="shrink-0 font-semibold">{money(l.debit || l.credit)}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Generated automatically by the {selected.source} module. Transaction-sourced entries
                cannot be edited — reverse the source document instead.
              </p>
            </SectionCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatementHeading({ children }: { children: string }) {
  return (
    <p className="pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function StatementRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between border-b border-border/70 py-2 text-sm ${
        bold ? "font-semibold" : "text-muted-foreground"
      }`}
    >
      <span>{label}</span>
      <span className="num text-foreground">{money(value)}</span>
    </div>
  );
}
