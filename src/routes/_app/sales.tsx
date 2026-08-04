import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Plus, Receipt, Users, Wallet } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/erp/topbar";
import { SectionCard, StatCard, StatusPill } from "@/components/erp/ui-kit";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CUSTOMERS, KPIS, SALES_DOCS, money } from "@/lib/erp-data";
import { DemoDataNotice } from "@/components/erp/demo-data-notice";

export const Route = createFileRoute("/_app/sales")({
  head: () => ({
    meta: [
      { title: "Sales — Builders Paradise ERP" },
      {
        name: "description",
        content:
          "Quotations, sales orders, invoices, credit notes, customer aging and receivables for Builders Paradise Hardware.",
      },
      { property: "og:title", content: "Sales — Builders Paradise ERP" },
      {
        property: "og:description",
        content: "Quotations, orders, invoices, credit notes and customer aging analysis.",
      },
    ],
  }),
  component: SalesPage,
});

const DOC_TABS = ["All", "Quotation", "Sales Order", "Invoice", "Credit Note", "Delivery Note"];

function SalesPage() {
  const [tab, setTab] = useState("All");
  const docs = tab === "All" ? SALES_DOCS : SALES_DOCS.filter((d) => d.type === tab);
  const invoiced = SALES_DOCS.filter((d) => d.type === "Invoice").reduce((s, d) => s + d.total, 0);
  const outstanding = SALES_DOCS.reduce((s, d) => s + d.due, 0);

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Sales"
        description="Full order-to-cash cycle: quote, confirm, deliver, invoice and collect — with receivables aging per customer."
        actions={
          <>
            <Button variant="outline" className="rounded-lg" onClick={() => toast.info("Quotation builder")}>
              <FileText className="size-4" />

      <DemoDataNotice phase={3} module="Sales" /> New quotation
            </Button>
            <Button className="rounded-lg" onClick={() => toast.info("Invoice builder")}>
              <Plus className="size-4" /> New invoice
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Invoiced (recent)"
          value={money(invoiced)}
          delta={8.6}
          sub="Across 3 invoices"
          tone="primary"
          icon={<Receipt className="size-4" />}
        />
        <StatCard
          label="Outstanding"
          value={money(outstanding)}
          sub="Unpaid & part-paid"
          tone="warning"
          icon={<Wallet className="size-4" />}
        />
        <StatCard
          label="Receivables book"
          value={money(KPIS.arOutstanding)}
          sub="All customers"
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Active customers"
          value={String(CUSTOMERS.length)}
          sub="2 on credit terms"
          tone="success"
          icon={<Users className="size-4" />}
        />
      </div>

      <SectionCard
        title="Sales documents"
        description={`${docs.length} documents`}
        className="mt-6"
        bodyClassName="p-0"
        actions={
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-9 rounded-lg">
              {DOC_TABS.map((t) => (
                <TabsTrigger key={t} value={t} className="text-xs">
                  {t}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Document</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance due</TableHead>
                <TableHead className="pr-5 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="num pl-5 font-medium">{d.id}</TableCell>
                  <TableCell className="text-muted-foreground">{d.type}</TableCell>
                  <TableCell>{d.customer}</TableCell>
                  <TableCell className="num text-muted-foreground">{d.date}</TableCell>
                  <TableCell className="num text-right">{d.total ? money(d.total) : "—"}</TableCell>
                  <TableCell className="num text-right font-medium">
                    {d.due ? money(d.due) : "—"}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <StatusPill status={d.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <SectionCard
          title="Customer aging"
          description="Receivables by bucket"
          className="xl:col-span-2"
          bodyClassName="p-0"
        >
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Customer</TableHead>
                <TableHead>Terms</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">30 days</TableHead>
                <TableHead className="text-right">60 days</TableHead>
                <TableHead className="text-right">90+ days</TableHead>
                <TableHead className="pr-5 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CUSTOMERS.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-5 font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.terms}</TableCell>
                  <TableCell className="num text-right">{money(c.current)}</TableCell>
                  <TableCell className="num text-right">{money(c.d30)}</TableCell>
                  <TableCell className="num text-right text-warning-foreground">
                    {money(c.d60)}
                  </TableCell>
                  <TableCell className="num text-right text-destructive">{money(c.d90)}</TableCell>
                  <TableCell className="num pr-5 text-right font-semibold">
                    {money(c.balance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard title="Credit utilisation" description="Exposure against approved limits" bodyClassName="space-y-4">
          {CUSTOMERS.filter((c) => c.limit > 0).map((c) => {
            const pct = (c.balance / c.limit) * 100;
            return (
              <div key={c.id}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{c.name}</span>
                  <span className="num shrink-0 text-xs text-muted-foreground">
                    {pct.toFixed(0)}%
                  </span>
                </div>
                <Progress value={Math.min(100, pct)} className="mt-2 h-1.5" />
                <p className="num mt-1 text-xs text-muted-foreground">
                  {money(c.balance)} of {money(c.limit)}
                </p>
              </div>
            );
          })}
        </SectionCard>
      </div>
    </div>
  );
}
