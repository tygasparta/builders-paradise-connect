import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Minus,
  PauseCircle,
  Plus,
  ScanBarcode,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { RequirePermission } from "@/components/erp/permission-gate";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/erp/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useCategories, useProducts } from "@/features/products/hooks";
import { useCustomers } from "@/features/customers/hooks";
import { useStockOnHand } from "@/features/inventory/hooks";
import {
  useCloseTill,
  useCompleteSale,
  useHeldSales,
  useHoldSale,
  useOpenSession,
  useOpenTill,
  useSessionTakings,
} from "@/features/pos/hooks";
import { scanProduct, type CartLine } from "@/features/pos/api";
import { documentTotals, lineTotals } from "@/lib/document-math";
import { useAuth } from "@/lib/auth/auth-context";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import { plural } from "@/lib/format";

export const Route = createFileRoute("/_app/pos")({
  component: PosPage,
});

function money(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PosPage() {
  return (
    <RequirePermission require={PERMISSIONS.POS_OPERATE} what="the point of sale">
      <PosScreen />
    </RequirePermission>
  );
}

function PosScreen() {
  const { activeWarehouseId, activeBranchId, profile } = useAuth();
  const { can } = usePermissions();

  const session = useOpenSession(activeWarehouseId);

  if (!activeWarehouseId) {
    return (
      <div className="card-surface">
        <EmptyState
          icon={<ScanBarcode className="size-5" />}
          title="Choose a warehouse first"
          description="The till sells from a specific warehouse. Pick one in the top bar."
        />
      </div>
    );
  }

  if (session.isLoading) return <CardsSkeleton count={3} />;
  if (session.isError) {
    return (
      <div className="card-surface">
        <ErrorState error={session.error} onRetry={() => void session.refetch()} />
      </div>
    );
  }

  if (!session.data) {
    return (
      <OpenTillPanel
        warehouseId={activeWarehouseId}
        branchId={activeBranchId}
        canOpen={can(PERMISSIONS.POS_SESSION_OPEN)}
        cashierName={profile?.full_name ?? ""}
      />
    );
  }

  return <Till sessionId={session.data.id} sessionNo={session.data.session_no} />;
}

// ---------------------------------------------------------------------
// Opening the till
// ---------------------------------------------------------------------

function OpenTillPanel({
  warehouseId,
  branchId,
  canOpen,
  cashierName,
}: {
  warehouseId: string;
  branchId: string | null;
  canOpen: boolean;
  cashierName: string;
}) {
  const openTill = useOpenTill();
  const [float, setFloat] = useState("0");

  if (!canOpen) {
    return (
      <div className="card-surface">
        <EmptyState
          icon={<LockKeyhole className="size-5" />}
          title="No till is open"
          description="Opening a till needs the “Open POS session” permission. Ask a supervisor to open one."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card-surface p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/12 text-primary">
            <Banknote className="size-5" />
          </span>
          <div>
            <h1 className="text-section font-semibold">Open the till</h1>
            <p className="text-helper text-muted-foreground">{cashierName}</p>
          </div>
        </div>

        <Field
          label="Opening float"
          htmlFor="float"
          required
          hint="Cash already in the drawer. It is counted back at close."
        >
          <Input
            id="float"
            type="number"
            step="0.01"
            min="0"
            className="num"
            value={float}
            onChange={(e) => setFloat(e.target.value)}
            autoFocus
          />
        </Field>

        <Button
          className="mt-4 w-full"
          disabled={openTill.isPending}
          onClick={() =>
            openTill.mutate({
              warehouseId,
              branchId,
              openingFloat: Number(float || 0),
            })
          }
        >
          {openTill.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Open till
        </Button>

        <p className="mt-3 text-center text-helper text-muted-foreground">
          Every sale is attached to this shift, and the drawer is reconciled against it at close.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// The till
// ---------------------------------------------------------------------

function Till({ sessionId, sessionNo }: { sessionId: string; sessionNo: string }) {
  const { activeWarehouseId, activeBranchId } = useAuth();
  const { can } = usePermissions();
  const canDiscount = can(PERMISSIONS.SALES_DISCOUNT_APPLY);
  const canCredit = can(PERMISSIONS.SALES_CREDIT_SALE_APPROVE);

  const { data: products } = useProducts({ includeInactive: false });
  const { data: categories } = useCategories();
  const { data: customers } = useCustomers(false);
  const stock = useStockOnHand({ warehouseId: activeWarehouseId });
  const takings = useSessionTakings(sessionId);
  const held = useHeldSales(sessionId);

  const completeSale = useCompleteSale();
  const holdSale = useHoldSale();

  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [customerId, setCustomerId] = useState<string>("walkin");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [lastSale, setLastSale] = useState<{
    invoiceNo: string;
    total: number;
    change: number;
  } | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const stockFor = (productId: string) =>
    Number(stock.data?.find((row) => row.product_id === productId)?.quantity ?? 0);

  const addToCart = (product: {
    id: string;
    sku: string;
    name: string;
    selling_price: number;
    tax_rate: number;
    uom?: { code: string } | null;
  }) => {
    setCart((current) => {
      const existing = current.find((line) => line.product_id === product.id);
      if (existing) {
        return current.map((line) =>
          line.product_id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [
        ...current,
        {
          product_id: product.id,
          sku: product.sku,
          name: product.name,
          uom: product.uom?.code ?? "",
          quantity: 1,
          unit_price: Number(product.selling_price),
          discount_percent: 0,
          tax_rate: Number(product.tax_rate),
          available: stockFor(product.id),
        },
      ];
    });
  };

  const onScan = async (code: string) => {
    if (!code.trim()) return;
    try {
      const found = await scanProduct(code);
      if (!found) {
        toast.error(`Nothing matches “${code}”`);
        return;
      }
      const full = products?.find((p) => p.id === found.product_id);
      addToCart({
        id: found.product_id,
        sku: found.sku,
        name: found.name,
        selling_price: Number(found.selling_price),
        tax_rate: Number(found.tax_rate),
        uom: full?.uom ?? { code: found.uom_code },
      });
      setSearch("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Scan failed");
    }
  };

  const setQuantity = (productId: string, quantity: number) => {
    setCart((current) =>
      quantity <= 0
        ? current.filter((line) => line.product_id !== productId)
        : current.map((line) => (line.product_id === productId ? { ...line, quantity } : line)),
    );
  };

  const totals = documentTotals(cart);
  const oversold = cart.filter((line) => line.quantity > stockFor(line.product_id));

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (products ?? [])
      .filter((p) => (categoryId === "all" ? true : p.category_id === categoryId))
      .filter(
        (p) =>
          term === "" || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term),
      )
      .slice(0, 60);
  }, [products, search, categoryId]);

  const parents = (categories ?? []).filter((c) => c.parent_id === null);

  const resetSale = () => {
    setCart([]);
    setCustomerId("walkin");
    scanRef.current?.focus();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      {/* Left: catalogue */}
      <div className="min-w-0 space-y-3">
        <div className="card-surface flex flex-wrap items-center gap-2 p-3">
          <div className="relative min-w-0 flex-1">
            <ScanBarcode
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary"
              aria-hidden
            />
            <Input
              ref={scanRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onScan(search);
                }
              }}
              placeholder="Scan barcode or search product…"
              className="pl-9"
              autoFocus
              aria-label="Scan barcode or search product"
            />
          </div>

          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="h-9 w-44" aria-label="Filter by category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {parents.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Badge variant="secondary" className="num text-helper">
            {sessionNo}
          </Badge>
        </div>

        {visibleProducts.length === 0 ? (
          <div className="card-surface">
            <EmptyState
              icon={<Search className="size-5" />}
              title={search ? "No product matches" : "No products yet"}
              description={
                search
                  ? "Try a different code or name."
                  : "Add products in the Products screen before selling."
              }
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleProducts.map((product) => {
              const available = stockFor(product.id);
              const out = product.track_stock && available <= 0;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addToCart(product)}
                  className="card-surface p-4 text-left transition-shadow hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="num rounded bg-muted px-1.5 py-0.5 text-helper font-medium text-muted-foreground">
                      {product.sku}
                    </span>
                    <span
                      className={
                        out
                          ? "num text-helper font-semibold text-destructive"
                          : "num text-helper text-muted-foreground"
                      }
                    >
                      {available} {product.uom?.code}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-td font-medium">{product.name}</p>
                  <p className="num mt-2 text-section font-semibold text-primary">
                    {money(Number(product.selling_price))}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: the sale */}
      <div className="card-surface flex max-h-[calc(100vh-8rem)] flex-col lg:sticky lg:top-20">
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-td font-semibold">Current sale</h2>
            <Button variant="ghost" size="sm" onClick={() => setCloseOpen(true)}>
              <LockKeyhole className="size-3.5" />
              Close till
            </Button>
          </div>

          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger className="mt-3 h-9" aria-label="Customer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="walkin">Walk-in customer</SelectItem>
              {customers?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="grid h-full min-h-40 place-items-center p-6 text-center">
              <div>
                <Search className="mx-auto size-8 text-muted-foreground/40" aria-hidden />
                <p className="mt-2 text-td text-muted-foreground">Scan or tap products to begin</p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {cart.map((line) => {
                const available = stockFor(line.product_id);
                const short = line.quantity > available;
                return (
                  <li key={line.product_id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-td font-medium">{line.name}</p>
                        <p className="num text-helper text-muted-foreground">
                          {money(line.unit_price)} × {line.quantity} {line.uom}
                        </p>
                      </div>
                      <span className="num text-td font-semibold">
                        {money(lineTotals(line).total)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7"
                        aria-label={`Reduce ${line.name}`}
                        onClick={() => setQuantity(line.product_id, line.quantity - 1)}
                      >
                        <Minus className="size-3" />
                      </Button>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="num h-7 w-16 text-center"
                        aria-label={`Quantity of ${line.name}`}
                        value={line.quantity}
                        onChange={(e) => setQuantity(line.product_id, Number(e.target.value))}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7"
                        aria-label={`Add another ${line.name}`}
                        onClick={() => setQuantity(line.product_id, line.quantity + 1)}
                      >
                        <Plus className="size-3" />
                      </Button>

                      {canDiscount && (
                        <div className="ml-auto flex items-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            className="num h-7 w-14 text-right"
                            aria-label={`Discount on ${line.name}`}
                            value={line.discount_percent}
                            onChange={(e) =>
                              setCart((current) =>
                                current.map((l) =>
                                  l.product_id === line.product_id
                                    ? { ...l, discount_percent: Number(e.target.value) }
                                    : l,
                                ),
                              )
                            }
                          />
                          <span className="text-helper text-muted-foreground">%</span>
                        </div>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground"
                        aria-label={`Remove ${line.name}`}
                        onClick={() => setQuantity(line.product_id, 0)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>

                    {short && (
                      <p className="mt-1.5 flex items-center gap-1 text-helper text-warning-foreground">
                        <AlertTriangle className="size-3" aria-hidden />
                        Only {available} in stock
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border p-4">
          {!canDiscount && (
            <p className="mb-2 flex items-center gap-1.5 text-helper text-muted-foreground">
              <LockKeyhole className="size-3" aria-hidden />
              Discounts need approval
            </p>
          )}
          <dl className="space-y-1 text-td">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="num">{money(totals.subtotal)}</dd>
            </div>
            {totals.discount_total > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Discount</dt>
                <dd className="num">−{money(totals.discount_total)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="num">{money(totals.tax_total)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 text-td font-semibold">
              <dt>Total</dt>
              <dd className="num">{money(totals.total)}</dd>
            </div>
          </dl>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              disabled={cart.length === 0 || holdSale.isPending}
              onClick={() =>
                holdSale.mutate(
                  {
                    sessionId,
                    warehouseId: activeWarehouseId as string,
                    branchId: activeBranchId,
                    customerId: customerId === "walkin" ? null : customerId,
                    customerName: customerId === "walkin" ? "Walk-in" : null,
                    paymentType: "cash",
                    lines: cart,
                    notes: null,
                  },
                  { onSuccess: resetSale },
                )
              }
            >
              <PauseCircle className="size-4" />
              Hold
            </Button>
            <Button disabled={cart.length === 0} onClick={() => setPaymentOpen(true)}>
              <Banknote className="size-4" />
              Pay
            </Button>
          </div>

          {(held.data?.length ?? 0) > 0 && (
            <p className="mt-2 text-center text-helper text-muted-foreground">
              {plural(held.data?.length ?? 0, "held sale")} on this till
            </p>
          )}
        </div>
      </div>

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        total={totals.total}
        oversold={oversold.length > 0}
        canCredit={canCredit && customerId !== "walkin"}
        pending={completeSale.isPending}
        onConfirm={(paymentType, tendered) => {
          completeSale.mutate(
            {
              sessionId,
              warehouseId: activeWarehouseId as string,
              branchId: activeBranchId,
              customerId: customerId === "walkin" ? null : customerId,
              customerName: customerId === "walkin" ? "Walk-in" : null,
              paymentType,
              lines: cart,
              notes: null,
            },
            {
              onSuccess: (result) => {
                setPaymentOpen(false);
                setLastSale({
                  invoiceNo: result.invoiceNo,
                  total: result.total,
                  change: paymentType === "cash" ? Math.max(0, tendered - result.total) : 0,
                });
                resetSale();
              },
            },
          );
        }}
      />

      <CloseTillDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        sessionId={sessionId}
        sessionNo={sessionNo}
        takings={takings.data}
      />

      <SaleCompleteDialog sale={lastSale} onClose={() => setLastSale(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------

function PaymentDialog({
  open,
  onOpenChange,
  total,
  oversold,
  canCredit,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  oversold: boolean;
  canCredit: boolean;
  pending: boolean;
  onConfirm: (paymentType: "cash" | "credit", tendered: number) => void;
}) {
  const [tendered, setTendered] = useState("");
  const [paymentType, setPaymentType] = useState<"cash" | "credit">("cash");

  useEffect(() => {
    if (!open) return;
    setTendered("");
    setPaymentType("cash");
  }, [open]);

  const paid = Number(tendered || 0);
  const change = paid - total;
  const shortPaid = paymentType === "cash" && paid < total;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Take payment</DialogTitle>
          <DialogDescription>
            Completing the sale deducts stock and records the revenue and cost of sales. It cannot
            be undone — a mistake is corrected with a credit note.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {oversold && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-helper text-warning-foreground"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                A line exceeds the stock on hand. The sale will be refused unless this warehouse
                allows negative stock and you hold the override.
              </span>
            </div>
          )}

          <div className="rounded-xl bg-primary px-4 py-3 text-primary-foreground">
            <p className="text-helper font-semibold uppercase tracking-widest text-white/75">
              Amount due
            </p>
            <p className="num mt-1 text-page-title font-semibold">{money(total)}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={paymentType === "cash" ? "default" : "outline"}
              onClick={() => setPaymentType("cash")}
            >
              Cash
            </Button>
            <Button
              type="button"
              variant={paymentType === "credit" ? "default" : "outline"}
              onClick={() => setPaymentType("credit")}
              disabled={!canCredit}
              title={canCredit ? undefined : "Credit needs a customer account and approval rights"}
            >
              On account
            </Button>
          </div>

          {paymentType === "cash" && (
            <>
              <Field label="Cash tendered" htmlFor="tendered">
                <Input
                  id="tendered"
                  type="number"
                  step="0.01"
                  min="0"
                  className="num text-section"
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                  autoFocus
                />
              </Field>

              <div className="flex flex-wrap gap-1.5">
                {[total, 5, 10, 20, 50, 100].map((amount, index) => (
                  <Button
                    key={`${amount}-${index}`}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="num"
                    onClick={() => setTendered(String(index === 0 ? total : amount))}
                  >
                    {index === 0 ? "Exact" : money(amount)}
                  </Button>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <span className="text-td text-muted-foreground">Change</span>
                <span
                  className={
                    change < 0
                      ? "num text-section font-semibold text-destructive"
                      : "num text-section font-semibold"
                  }
                >
                  {money(Math.max(0, change))}
                </span>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={pending || shortPaid} onClick={() => onConfirm(paymentType, paid)}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {shortPaid ? "Not enough tendered" : "Complete sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Receipt confirmation
// ---------------------------------------------------------------------

function SaleCompleteDialog({
  sale,
  onClose,
}: {
  sale: { invoiceNo: string; total: number; change: number } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(sale)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-success" aria-hidden />
            Sale complete
          </DialogTitle>
          <DialogDescription className="num">{sale?.invoiceNo}</DialogDescription>
        </DialogHeader>

        <dl className="space-y-2">
          <div className="flex justify-between text-td">
            <dt className="text-muted-foreground">Total</dt>
            <dd className="num font-medium">{money(sale?.total ?? 0)}</dd>
          </div>
          {(sale?.change ?? 0) > 0 && (
            <div className="flex justify-between rounded-lg bg-success/10 px-3 py-2">
              <dt className="text-td font-medium text-success">Change due</dt>
              <dd className="num text-section font-semibold text-success">
                {money(sale?.change ?? 0)}
              </dd>
            </div>
          )}
        </dl>

        <p className="text-helper text-muted-foreground">
          Stock has been deducted and the sale recorded in the ledger.
        </p>

        <DialogFooter>
          <Button className="w-full" onClick={onClose} autoFocus>
            Next sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Closing the till
// ---------------------------------------------------------------------

function CloseTillDialog({
  open,
  onOpenChange,
  sessionId,
  sessionNo,
  takings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  sessionNo: string;
  takings: { cash: number; credit: number; count: number } | undefined;
}) {
  const closeTill = useCloseTill();
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setCounted("");
    setNotes("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Close {sessionNo}</DialogTitle>
          <DialogDescription>
            Count the drawer and enter what is actually there. The variance is recorded against the
            shift, and a closed till cannot be reopened.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <dl className="space-y-1.5 rounded-lg border border-border p-3 text-td">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Cash sales</dt>
              <dd className="num">{money(takings?.cash ?? 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">On account</dt>
              <dd className="num">{money(takings?.credit ?? 0)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5">
              <dt className="text-muted-foreground">Sales on this shift</dt>
              <dd className="num">{takings?.count ?? 0}</dd>
            </div>
          </dl>

          <Field
            label="Cash counted"
            htmlFor="counted"
            required
            hint="Including the opening float."
          >
            <Input
              id="counted"
              type="number"
              step="0.01"
              min="0"
              className="num text-section"
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              autoFocus
            />
          </Field>

          <Field label="Notes" htmlFor="close_notes">
            <Input
              id="close_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything to explain a difference"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
            Not yet
          </Button>
          <Button
            disabled={counted === "" || closeTill.isPending}
            onClick={() =>
              closeTill.mutate(
                { sessionId, countedCash: Number(counted), notes: notes.trim() || null },
                { onSuccess: () => onOpenChange(false) },
              )
            }
          >
            {closeTill.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Close till
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
