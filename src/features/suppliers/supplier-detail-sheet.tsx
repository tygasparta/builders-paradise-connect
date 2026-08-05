import { format } from "date-fns";
import { Download, Landmark, PackageCheck, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/erp/states";
import { downloadCsv } from "@/lib/export";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import { plural } from "@/lib/format";
import type { SupplierRow } from "@/lib/database.types";
import { useSupplierActivity } from "./hooks";
import { paymentTermsLabel } from "./schema";

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function SupplierDetailSheet({
  supplier,
  onOpenChange,
}: {
  supplier: SupplierRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { can, canAny } = usePermissions();
  const canExport = can(PERMISSIONS.REPORTS_EXPORT);
  const canSeeBank = canAny([
    PERMISSIONS.SUPPLIER_PAYMENTS_CREATE,
    PERMISSIONS.SUPPLIER_PAYMENTS_APPROVE,
  ]);

  const activity = useSupplierActivity(supplier?.id ?? null);

  const orders = activity.data?.orders ?? [];
  const grns = activity.data?.grns ?? [];

  const openOrders = orders.filter((o) =>
    ["approved", "partially_received", "pending_approval"].includes(o.status),
  );
  const receivedValue = grns
    .filter((g) => g.status === "posted")
    .reduce((sum, g) => sum + Number(g.total_cost), 0);

  const exportHistory = () => {
    if (!supplier) return;
    downloadCsv(`Supplier history ${supplier.code}`, orders, [
      { header: "PO number", value: (o) => o.po_no },
      { header: "Order date", value: (o) => o.order_date },
      { header: "Expected", value: (o) => o.expected_date },
      { header: "Currency", value: (o) => o.currency_code },
      { header: "Total", value: (o) => Number(o.total).toFixed(2) },
      { header: "Status", value: (o) => o.status },
    ]);
    toast.success(`${plural(orders.length, "order")} exported`);
  };

  return (
    <Sheet open={Boolean(supplier)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{supplier?.name}</SheetTitle>
          <SheetDescription>
            <span className="num">{supplier?.code}</span>
            {supplier?.contact_person ? ` · ${supplier.contact_person}` : ""}
            {supplier?.phone ? ` · ${supplier.phone}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          {supplier?.status === "blocked" && (
            <p
              role="status"
              className="rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-xs text-destructive"
            >
              This supplier is blocked. New purchase orders are refused by the database, not just
              hidden here.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card-surface p-3">
              <p className="text-[11px] text-muted-foreground">Open orders</p>
              <p className="num mt-0.5 text-lg font-semibold">{openOrders.length}</p>
            </div>
            <div className="card-surface p-3">
              <p className="text-[11px] text-muted-foreground">Received to date</p>
              <p className="num mt-0.5 text-lg font-semibold">{money(receivedValue)}</p>
            </div>
            <div className="card-surface p-3">
              <p className="text-[11px] text-muted-foreground">Terms</p>
              <p className="mt-0.5 text-lg font-semibold">
                {paymentTermsLabel(supplier?.payment_terms_days ?? 0)}
              </p>
            </div>
          </div>

          {canSeeBank && supplier?.bank_name && (
            <section className="card-surface p-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold">
                <Landmark className="size-3.5" aria-hidden />
                Payment details
              </h3>
              <dl className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Bank</dt>
                  <dd>{supplier.bank_name}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Account name</dt>
                  <dd className="truncate">{supplier.bank_account_name ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Account number</dt>
                  <dd className="num">{supplier.bank_account_number ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Branch</dt>
                  <dd>{supplier.bank_branch ?? "—"}</dd>
                </div>
              </dl>
            </section>
          )}

          {activity.isError ? (
            <ErrorState error={activity.error} onRetry={() => void activity.refetch()} />
          ) : (
            <Tabs defaultValue="orders">
              <div className="flex items-center justify-between gap-2">
                <TabsList>
                  <TabsTrigger value="orders">Purchase orders</TabsTrigger>
                  <TabsTrigger value="grns">Goods received</TabsTrigger>
                </TabsList>
                {canExport && orders.length > 0 && (
                  <Button variant="outline" size="sm" onClick={exportHistory}>
                    <Download className="size-3.5" />
                    Export
                  </Button>
                )}
              </div>

              <TabsContent value="orders" className="mt-3">
                {activity.isLoading ? (
                  <TableSkeleton columns={4} rows={4} />
                ) : orders.length === 0 ? (
                  <EmptyState
                    icon={<ShoppingCart className="size-5" />}
                    title="No purchase orders yet"
                    description="Orders raised with this supplier appear here."
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {orders.map((order) => (
                      <li key={order.id} className="flex items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="num text-xs font-medium">{order.po_no}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {format(new Date(order.order_date), "dd MMM yyyy")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="num text-sm font-medium">
                            {order.currency_code} {money(order.total)}
                          </p>
                          <Badge variant="secondary" className="mt-0.5 text-[10px]">
                            {order.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="grns" className="mt-3">
                {activity.isLoading ? (
                  <TableSkeleton columns={4} rows={4} />
                ) : grns.length === 0 ? (
                  <EmptyState
                    icon={<PackageCheck className="size-5" />}
                    title="Nothing received yet"
                    description="Goods received from this supplier appear here."
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {grns.map((grn) => (
                      <li key={grn.id} className="flex items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="num text-xs font-medium">{grn.grn_no}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {format(new Date(grn.received_date), "dd MMM yyyy")}
                            {grn.delivery_note_ref ? ` · ${grn.delivery_note_ref}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="num text-sm font-medium">
                            {Number(grn.total_cost) > 0 ? money(grn.total_cost) : "—"}
                          </p>
                          <Badge variant="secondary" className="mt-0.5 text-[10px]">
                            {grn.status}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          )}

          <p className="text-[11px] text-muted-foreground">
            Supplier invoices and payments are not yet built, so payables aging is not shown here
            rather than being estimated from receipts.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
