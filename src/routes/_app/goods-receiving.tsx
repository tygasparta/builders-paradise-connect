import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, PackageCheck, Truck, ArrowRight, FileCheck2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/erp/topbar";
import { SectionCard, StatCard, StatusPill } from "@/components/erp/ui-kit";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GRNS, PURCHASE_ORDERS, money, qty } from "@/lib/erp-data";
import { DemoDataNotice } from "@/components/erp/demo-data-notice";

export const Route = createFileRoute("/_app/goods-receiving")({
  head: () => ({
    meta: [
      { title: "Goods Receiving — Builders Paradise ERP" },
      {
        name: "description",
        content:
          "Goods Received Notes with inspection, variance capture and automatic Dr Inventory / Cr Accounts Payable posting.",
      },
      { property: "og:title", content: "Goods Receiving — Builders Paradise ERP" },
      {
        property: "og:description",
        content: "GRN workflow from purchase order to inspection, posting and supplier balance update.",
      },
    ],
  }),
  component: GoodsReceiving,
});

const STEPS = [
  "Purchase Order",
  "Goods Delivered",
  "Inspection",
  "GRN Posted",
  "Inventory Updated",
  "Supplier Balance",
];

function GoodsReceiving() {
  const [selected, setSelected] = useState(GRNS[1]!);
  const total = selected.lines.reduce((s, l) => s + l.received * l.cost, 0);
  const stepIndex =
    selected.status === "Draft" ? 1 : selected.status === "Inspection" ? 2 : STEPS.length - 1;

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Goods Receiving"
        description="Receive against purchase orders, record inspection variances and post the inventory and payable entries automatically."
        actions={
          <Button className="rounded-lg" onClick={() => toast.info("Select a purchase order to receive")}>
            <PackageCheck className="size-4" />

      <DemoDataNotice phase={2} module="Goods receiving" /> New GRN
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open purchase orders"
          value={qty(PURCHASE_ORDERS.filter((p) => p.status !== "Received").length)}
          sub="Awaiting delivery or approval"
          tone="primary"
          icon={<Truck className="size-4" />}
        />
        <StatCard
          label="Awaiting inspection"
          value={qty(GRNS.filter((g) => g.status === "Inspection").length)}
          sub="Quality check pending"
          tone="warning"
          icon={<ClipboardCheck className="size-4" />}
        />
        <StatCard
          label="Posted this week"
          value={qty(GRNS.filter((g) => g.status === "Posted").length)}
          sub="Inventory and AP updated"
          tone="success"
          icon={<FileCheck2 className="size-4" />}
        />
        <StatCard
          label="Receipt value (MTD)"
          value={money(GRNS.reduce((s, g) => s + g.lines.reduce((a, l) => a + l.received * l.cost, 0), 0))}
          sub="At supplier cost"
          icon={<PackageCheck className="size-4" />}
        />
      </div>

      <SectionCard title="Receiving workflow" description="Every GRN follows this controlled path" className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  i <= stepIndex
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                <span
                  className={`num grid size-5 place-items-center rounded-md text-[10px] ${
                    i <= stepIndex ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {i + 1}
                </span>
                {s}
              </div>
              {i < STEPS.length - 1 && <ArrowRight className="size-3.5 text-muted-foreground/50" />}
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <SectionCard title="Goods Received Notes" description="Select a GRN to review" bodyClassName="p-0" className="xl:col-span-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">GRN</TableHead>
                <TableHead>PO</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="pr-5 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {GRNS.map((g) => (
                <TableRow
                  key={g.id}
                  onClick={() => setSelected(g)}
                  className={`cursor-pointer ${selected.id === g.id ? "bg-primary/5" : ""}`}
                >
                  <TableCell className="num pl-5 font-medium">{g.id}</TableCell>
                  <TableCell className="num text-muted-foreground">{g.po}</TableCell>
                  <TableCell>{g.supplier}</TableCell>
                  <TableCell className="text-muted-foreground">{g.warehouse}</TableCell>
                  <TableCell className="num text-muted-foreground">{g.date}</TableCell>
                  <TableCell className="num text-right font-medium">
                    {money(g.lines.reduce((s, l) => s + l.received * l.cost, 0))}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <StatusPill status={g.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard
          title={`${selected.id} detail`}
          description={`${selected.supplier} · ${selected.po}`}
          bodyClassName="space-y-4"
        >
          <div className="space-y-3">
            {selected.lines.map((l) => {
              const variance = l.received - l.ordered;
              return (
                <div key={l.product} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">{l.product}</p>
                  <div className="num mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Ordered</p>
                      <p className="font-medium">{qty(l.ordered)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Received</p>
                      <p className="font-medium">{qty(l.received)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Variance</p>
                      <p className={variance < 0 ? "font-semibold text-destructive" : "font-medium"}>
                        {variance}
                      </p>
                    </div>
                  </div>
                  <p className="num mt-2 text-xs text-muted-foreground">
                    {qty(l.received)} × {money(l.cost)} = {money(l.received * l.cost)}
                  </p>
                </div>
              );
            })}
          </div>

          <Separator />

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Automatic journal entry
            </p>
            <div className="num mt-2 space-y-1.5 rounded-lg bg-muted/60 p-3 text-xs">
              <div className="flex justify-between">
                <span>Dr 1300 Inventory</span>
                <span className="font-semibold">{money(total)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span className="pl-4">Cr 2000 Accounts Payable</span>
                <span className="font-semibold">{money(total)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1 rounded-lg"
              disabled={selected.status === "Posted"}
              onClick={() => toast.success(`${selected.id} posted — inventory and AP updated`)}
            >
              {selected.status === "Posted" ? "Already posted" : "Post GRN"}
            </Button>
            <Button variant="outline" className="rounded-lg" onClick={() => toast.info("Printing GRN…")}>
              Print
            </Button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
