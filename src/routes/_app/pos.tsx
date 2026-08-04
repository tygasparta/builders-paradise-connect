import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Minus, Plus, ScanBarcode, Search, Trash2, User, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, COMPANY, CUSTOMERS, PRODUCTS, money, qty } from "@/lib/erp-data";
import { DemoDataNotice } from "@/components/erp/demo-data-notice";

export const Route = createFileRoute("/_app/pos")({
  head: () => ({
    meta: [
      { title: "Point of Sale — Builders Paradise ERP" },
      {
        name: "description",
        content:
          "Touch-friendly hardware counter POS with barcode entry, multi-tender checkout, VAT handling and automatic stock and ledger posting.",
      },
      { property: "og:title", content: "Point of Sale — Builders Paradise ERP" },
      {
        property: "og:description",
        content:
          "Fast counter checkout with barcode entry, multi-tender payment and live stock deduction.",
      },
    ],
  }),
  component: POS,
});

type Line = { id: string; name: string; price: number; cost: number; unit: string; qty: number };

const TENDERS = ["Cash", "Card", "Bank Transfer", "Mobile Money", "Credit Sale"] as const;

function POS() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState(CUSTOMERS[3]!.name);
  const [tender, setTender] = useState<(typeof TENDERS)[number]>("Cash");
  const [discount, setDiscount] = useState(0);

  const catalogue = useMemo(
    () =>
      PRODUCTS.filter((p) => {
        const q = search.trim().toLowerCase();
        return (
          (!q ||
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.barcode.includes(q)) &&
          (category === "all" || p.category === category)
        );
      }),
    [search, category],
  );

  const add = (id: string) => {
    const p = PRODUCTS.find((x) => x.id === id)!;
    setLines((prev) => {
      const found = prev.find((l) => l.id === id);
      if (found) return prev.map((l) => (l.id === id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { id, name: p.name, price: p.price, cost: p.cost, unit: p.unit, qty: 1 }];
    });
  };

  const bump = (id: string, d: number) =>
    setLines((prev) =>
      prev.flatMap((l) => (l.id === id ? (l.qty + d <= 0 ? [] : [{ ...l, qty: l.qty + d }]) : [l])),
    );

  const gross = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const discountValue = gross * (discount / 100);
  const net = gross - discountValue;
  const exVat = net / (1 + COMPANY.vatRate);
  const vat = net - exVat;
  const cost = lines.reduce((s, l) => s + l.qty * l.cost, 0);

  const checkout = () => {
    if (!lines.length) {
      toast.error("Add items before completing the sale");
      return;
    }
    toast.success(`Sale completed — ${money(net)} (${tender})`, {
      description: "Stock deducted, VAT and cost of sales posted to the ledger.",
    });
    setLines([]);
    setDiscount(0);
  };

  return (
    <>
      <DemoDataNotice phase={3} module="Point of Sale" />
      <div className="mx-auto grid max-w-[1560px] gap-4 lg:grid-cols-[1fr_400px]">
        <div className="card-surface flex min-h-[640px] flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
            <div className="relative min-w-[220px] flex-1">
              <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && catalogue[0]) {
                    add(catalogue[0].id);
                    setSearch("");
                  }
                }}
                placeholder="Scan barcode or search product…"
                className="h-11 rounded-lg pl-10 text-sm"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11 w-52 rounded-lg text-sm">
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
          </div>

          <ScrollArea className="flex-1">
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {catalogue.map((p) => (
                <button
                  key={p.id}
                  onClick={() => add(p.id)}
                  disabled={p.onHand - p.reserved <= 0}
                  className="group flex flex-col rounded-xl border border-border bg-card p-4 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised disabled:opacity-40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Badge
                      variant="outline"
                      className="num border-border text-[10px] text-muted-foreground"
                    >
                      {p.sku}
                    </Badge>
                    <span className="num text-[11px] text-muted-foreground">
                      {qty(p.onHand - p.reserved)} {p.unit.toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-medium leading-snug">{p.name}</p>
                  <p className="num mt-auto pt-3 text-lg font-semibold text-primary">
                    {money(p.price)}
                  </p>
                </button>
              ))}
              {!catalogue.length && (
                <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
                  No products match “{search}”.
                </p>
              )}
            </div>
          </ScrollArea>
        </div>

        <aside className="card-surface flex min-h-[640px] flex-col overflow-hidden">
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Current sale</h2>
              <Badge className="num border-0 bg-secondary text-secondary-foreground">
                #POS-33120
              </Badge>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <User className="size-4 shrink-0 text-muted-foreground" />
              <Select value={customer} onValueChange={setCustomer}>
                <SelectTrigger className="h-9 rounded-lg text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMERS.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-2 p-4">
              {!lines.length && (
                <div className="py-20 text-center">
                  <Search className="mx-auto size-8 text-muted-foreground/40" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Scan or tap products to begin
                  </p>
                </div>
              )}
              {lines.map((l) => (
                <div key={l.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{l.name}</p>
                    <button
                      onClick={() => setLines((p) => p.filter((x) => x.id !== l.id))}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-7 rounded-md"
                        onClick={() => bump(l.id, -1)}
                      >
                        <Minus className="size-3" />
                      </Button>
                      <span className="num w-10 text-center text-sm font-semibold">{l.qty}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-7 rounded-md"
                        onClick={() => bump(l.id, 1)}
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                    <span className="num text-sm font-semibold">{money(l.qty * l.price)}</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="space-y-3 border-t border-border p-4">
            <div className="flex items-center gap-2">
              <Lock className="size-3.5 text-muted-foreground" />
              <span className="flex-1 text-xs text-muted-foreground">
                Discount % (needs approval)
              </span>
              <Input
                type="number"
                min={0}
                max={20}
                value={discount}
                onChange={(e) =>
                  setDiscount(Math.min(20, Math.max(0, Number(e.target.value) || 0)))
                }
                className="num h-8 w-20 rounded-md text-right text-sm"
              />
            </div>

            <Separator />

            <div className="num space-y-1.5 text-sm">
              <Row label="Subtotal" value={money(gross)} />
              {discount > 0 && (
                <Row label={`Discount (${discount}%)`} value={`-${money(discountValue)}`} />
              )}
              <Row label="Excl. VAT" value={money(exVat)} muted />
              <Row label={`VAT @ ${COMPANY.vatRate * 100}%`} value={money(vat)} muted />
              <Row label="Cost of sales" value={money(cost)} muted />
              <Separator className="my-2" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Total due</span>
                <span className="num text-2xl font-bold text-primary">{money(net)}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {TENDERS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTender(t)}
                  className={`rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors ${
                    tender === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <Button className="h-12 w-full rounded-lg text-base" onClick={checkout}>
              Complete sale · {money(net)}
            </Button>
          </div>
        </aside>
      </div>
    </>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
