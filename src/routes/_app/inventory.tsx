import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Plus, Search, Boxes, Layers, AlertTriangle, DollarSign } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/erp/topbar";
import { SectionCard, StatCard } from "@/components/erp/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CATEGORIES,
  PRODUCTS,
  WAREHOUSES,
  inventoryValue,
  lowStock,
  money,
  qty,
  retailValue,
} from "@/lib/erp-data";
import { DemoDataNotice } from "@/components/erp/demo-data-notice";

export const Route = createFileRoute("/_app/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — Builders Paradise ERP" },
      {
        name: "description",
        content:
          "Stock levels, valuation, reorder alerts, warehouse balances and movement analysis for Builders Paradise Hardware.",
      },
      { property: "og:title", content: "Inventory — Builders Paradise ERP" },
      {
        property: "og:description",
        content: "Stock levels, valuation, reorder alerts and warehouse balances.",
      },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [warehouse, setWarehouse] = useState("all");

  const rows = useMemo(
    () =>
      PRODUCTS.filter((p) => {
        const q = search.trim().toLowerCase();
        const matches =
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q);
        return (
          matches &&
          (category === "all" || p.category === category) &&
          (warehouse === "all" || p.warehouse === warehouse)
        );
      }),
    [search, category, warehouse],
  );

  const byWarehouse = WAREHOUSES.map((w) => {
    const items = PRODUCTS.filter((p) => p.warehouse === w.name);
    return {
      ...w,
      skus: items.length,
      value: items.reduce((s, p) => s + p.onHand * p.cost, 0),
    };
  });

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Inventory"
        description="Perpetual stock control with weighted-average costing, reorder policy and warehouse-level valuation."
        actions={
          <>
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => toast.success("Inventory export queued (CSV)")}
            >
              <Download className="size-4" />

      <DemoDataNotice phase={2} module="Inventory" /> Export
            </Button>
            <Button className="rounded-lg" onClick={() => toast.info("Product form opens here")}>
              <Plus className="size-4" /> New product
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Stock value at cost"
          value={money(inventoryValue)}
          sub="Weighted average"
          tone="primary"
          icon={<DollarSign className="size-4" />}
        />
        <StatCard
          label="Retail value"
          value={money(retailValue)}
          sub={`${(((retailValue - inventoryValue) / retailValue) * 100).toFixed(1)}% potential margin`}
          tone="success"
          icon={<Layers className="size-4" />}
        />
        <StatCard
          label="Active SKUs"
          value={qty(PRODUCTS.length)}
          sub={`${CATEGORIES.length} categories`}
          icon={<Boxes className="size-4" />}
        />
        <StatCard
          label="Below reorder level"
          value={qty(lowStock.length)}
          sub="Requires purchase requisition"
          tone="danger"
          icon={<AlertTriangle className="size-4" />}
        />
      </div>

      <Tabs defaultValue="products" className="mt-6">
        <TabsList className="rounded-lg">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
          <TabsTrigger value="movement">Movement analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <SectionCard
            title="Stock ledger"
            description={`${rows.length} of ${PRODUCTS.length} products`}
            bodyClassName="p-0"
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="SKU, name or barcode"
                    className="h-9 w-56 rounded-lg pl-8 text-sm"
                  />
                </div>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-9 w-48 rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={warehouse} onValueChange={setWarehouse}>
                  <SelectTrigger className="h-9 w-44 rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All warehouses</SelectItem>
                    {WAREHOUSES.map((w) => (
                      <SelectItem key={w.id} value={w.name}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="pr-5 text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => {
                    const low = p.onHand <= p.reorder;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="num pl-5 text-xs text-muted-foreground">
                          {p.sku}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.brand} · per {p.unit}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.category}</TableCell>
                        <TableCell className="text-muted-foreground">{p.warehouse}</TableCell>
                        <TableCell className="num text-right">
                          <span className={low ? "font-semibold text-destructive" : ""}>
                            {qty(p.onHand)}
                          </span>
                          {low && (
                            <Badge className="ml-2 h-5 border-0 bg-destructive/12 px-1.5 text-[10px] text-destructive">
                              Low
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="num text-right text-muted-foreground">
                          {qty(p.reserved)}
                        </TableCell>
                        <TableCell className="num text-right font-medium">
                          {qty(p.onHand - p.reserved)}
                        </TableCell>
                        <TableCell className="num text-right text-muted-foreground">
                          {money(p.cost)}
                        </TableCell>
                        <TableCell className="num text-right">{money(p.price)}</TableCell>
                        <TableCell className="num pr-5 text-right font-semibold">
                          {money(p.onHand * p.cost)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="warehouses" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {byWarehouse.map((w) => (
              <SectionCard key={w.id} title={w.name} description={`${w.skus} SKUs held`}>
                <p className="num text-2xl font-semibold">{money(w.value)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Valuation at cost</p>
                <div className="mt-4 space-y-2 border-t border-border pt-4 text-xs">
                  {PRODUCTS.filter((p) => p.warehouse === w.name)
                    .slice(0, 4)
                    .map((p) => (
                      <div key={p.id} className="flex justify-between gap-2">
                        <span className="truncate text-muted-foreground">{p.name}</span>
                        <span className="num shrink-0">{qty(p.onHand)}</span>
                      </div>
                    ))}
                </div>
              </SectionCard>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="movement" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {(["fast", "medium", "slow"] as const).map((m) => (
              <SectionCard
                key={m}
                title={`${m[0]!.toUpperCase()}${m.slice(1)} moving`}
                description={
                  m === "fast"
                    ? "High turnover — keep buffer stock"
                    : m === "medium"
                      ? "Steady demand"
                      : "Review pricing or discontinue"
                }
                bodyClassName="space-y-3"
              >
                {PRODUCTS.filter((p) => p.movement === m).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="num text-xs text-muted-foreground">{p.sku}</p>
                    </div>
                    <span className="num shrink-0 text-sm">{qty(p.onHand)}</span>
                  </div>
                ))}
              </SectionCard>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
