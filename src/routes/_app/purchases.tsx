import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  Ban,
  CheckCircle2,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/erp/page-header";
import { DataTable } from "@/components/erp/data-table";
import { RequirePermission } from "@/components/erp/permission-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PurchaseOrderFormDialog } from "@/features/purchasing/purchase-order-form-dialog";
import { usePurchaseOrders, useSetPurchaseOrderStatus } from "@/features/purchasing/hooks";
import { PO_EDITABLE_STATUSES, PO_STATUS_LABELS } from "@/features/purchasing/schema";
import type { PurchaseOrderWithRefs } from "@/features/purchasing/api";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import type { PurchaseOrderStatus } from "@/lib/database.types";
import { downloadCsv } from "@/lib/export";
import { plural } from "@/lib/format";

export const Route = createFileRoute("/_app/purchases")({
  component: PurchasesPage,
});

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_approval: "bg-warning/20 text-warning-foreground",
  approved: "bg-info/12 text-info",
  partially_received: "bg-warning/20 text-warning-foreground",
  received: "bg-success/12 text-success",
  cancelled: "bg-destructive/12 text-destructive",
  closed: "bg-muted text-muted-foreground",
};

function PurchasesPage() {
  return (
    <RequirePermission require={PERMISSIONS.PURCHASE_ORDERS_VIEW} what="purchase orders">
      <PurchasesScreen />
    </RequirePermission>
  );
}

function PurchasesScreen() {
  const { can } = usePermissions();
  const canCreate = can(PERMISSIONS.PURCHASE_ORDERS_CREATE);
  const canApprove = can(PERMISSIONS.PURCHASE_ORDERS_APPROVE);
  const canCancel = can(PERMISSIONS.PURCHASE_ORDERS_CANCEL);
  const canExport = can(PERMISSIONS.REPORTS_EXPORT);

  const [status, setStatus] = useState<string>("all");
  const [editing, setEditing] = useState<PurchaseOrderWithRefs | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [cancelling, setCancelling] = useState<PurchaseOrderWithRefs | null>(null);

  const orders = usePurchaseOrders({
    status: status === "all" ? null : (status as PurchaseOrderStatus),
  });
  const setOrderStatus = useSetPurchaseOrderStatus();

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const exportOrders = () => {
    const rows = orders.data ?? [];
    downloadCsv("Purchase orders", rows, [
      { header: "PO number", value: (o) => o.po_no },
      { header: "Supplier", value: (o) => o.supplier?.name },
      { header: "Order date", value: (o) => o.order_date },
      { header: "Expected", value: (o) => o.expected_date },
      { header: "Warehouse", value: (o) => o.warehouse?.name },
      { header: "Lines", value: (o) => o.purchase_order_lines.length },
      { header: "Currency", value: (o) => o.currency_code },
      { header: "Subtotal", value: (o) => Number(o.subtotal).toFixed(2) },
      { header: "Discount", value: (o) => Number(o.discount_total).toFixed(2) },
      { header: "Tax", value: (o) => Number(o.tax_total).toFixed(2) },
      { header: "Total", value: (o) => Number(o.total).toFixed(2) },
      { header: "Status", value: (o) => PO_STATUS_LABELS[o.status] ?? o.status },
    ]);
    toast.success(`${plural(rows.length, "purchase order")} exported`);
  };

  const columns = useMemo<ColumnDef<PurchaseOrderWithRefs, unknown>[]>(() => {
    const base: ColumnDef<PurchaseOrderWithRefs, unknown>[] = [
      {
        accessorKey: "po_no",
        header: "PO",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="num text-xs font-medium">{row.original.po_no}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(row.original.order_date), "dd MMM yyyy")}
            </p>
          </div>
        ),
      },
      {
        id: "supplier",
        header: "Supplier",
        accessorFn: (row) => row.supplier?.name ?? "",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.supplier?.name ?? "—"}</p>
            <p className="truncate text-xs text-muted-foreground">{row.original.warehouse?.name}</p>
          </div>
        ),
      },
      {
        id: "lines",
        header: "Lines",
        accessorFn: (row) => row.purchase_order_lines.length,
        cell: ({ row }) => (
          <span className="num text-sm">{row.original.purchase_order_lines.length}</span>
        ),
      },
      {
        id: "received",
        header: "Received",
        enableSorting: false,
        cell: ({ row }) => {
          const lines = row.original.purchase_order_lines;
          const ordered = lines.reduce((sum, l) => sum + Number(l.quantity_ordered), 0);
          const received = lines.reduce((sum, l) => sum + Number(l.quantity_received), 0);
          const percent = ordered === 0 ? 0 : Math.round((received / ordered) * 100);
          return (
            <div className="min-w-24">
              <p className="num text-xs">
                {received} / {ordered}
              </p>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={percent >= 100 ? "h-full bg-success" : "h-full bg-primary"}
                  style={{ width: `${Math.min(percent, 100)}%` }}
                />
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "total",
        header: "Total",
        cell: ({ row }) => (
          <span className="num font-medium">
            {row.original.currency_code} {money(row.original.total)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              STATUS_TONE[row.original.status] ?? "bg-muted text-muted-foreground"
            }`}
          >
            {PO_STATUS_LABELS[row.original.status] ?? row.original.status}
          </span>
        ),
      },
    ];

    if (canCreate || canApprove || canCancel) {
      base.push({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const order = row.original;
          const editable = (PO_EDITABLE_STATUSES as readonly string[]).includes(order.status);
          const cancellable = ["draft", "pending_approval", "approved"].includes(order.status);

          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Actions for ${order.po_no}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {canCreate && editable && (
                    <DropdownMenuItem
                      onSelect={() => {
                        setEditing(order);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                      Edit order
                    </DropdownMenuItem>
                  )}
                  {canCreate && order.status === "draft" && (
                    <DropdownMenuItem
                      onSelect={() =>
                        setOrderStatus.mutate({ id: order.id, status: "pending_approval" })
                      }
                    >
                      <Send className="size-4" />
                      Send for approval
                    </DropdownMenuItem>
                  )}
                  {canApprove && ["draft", "pending_approval"].includes(order.status) && (
                    <DropdownMenuItem
                      onSelect={() => setOrderStatus.mutate({ id: order.id, status: "approved" })}
                    >
                      <CheckCircle2 className="size-4" />
                      Approve order
                    </DropdownMenuItem>
                  )}
                  {canCancel && cancellable && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setCancelling(order)}>
                        <Ban className="size-4" />
                        Cancel order
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      });
    }

    return base;
  }, [canCreate, canApprove, canCancel, setOrderStatus]);

  return (
    <>
      <PageHeader
        title="Purchases"
        description="Orders to suppliers. Nothing moves until goods are received against them."
        breadcrumbs={[{ label: "Trade" }, { label: "Purchases" }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {canExport && (
              <Button variant="outline" onClick={exportOrders} disabled={!orders.data?.length}>
                <Download className="size-4" />
                Export
              </Button>
            )}
            {canCreate && (
              <Button onClick={openNew}>
                <Plus className="size-4" />
                New order
              </Button>
            )}
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={orders.data}
        isLoading={orders.isLoading}
        error={orders.error}
        onRetry={() => void orders.refetch()}
        searchPlaceholder="Search by PO number or supplier…"
        emptyTitle={status === "all" ? "No purchase orders yet" : "No orders with that status"}
        emptyDescription={
          status === "all"
            ? "Raise an order against a supplier, approve it, then receive the goods."
            : "Try a different status filter."
        }
        emptyAction={
          canCreate && status === "all" ? (
            <Button onClick={openNew}>
              <Plus className="size-4" />
              New order
            </Button>
          ) : undefined
        }
        pageSize={25}
        toolbar={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-48" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(PO_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <PurchaseOrderFormDialog open={formOpen} onOpenChange={setFormOpen} order={editing} />

      <AlertDialog open={Boolean(cancelling)} onOpenChange={(open) => !open && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {cancelling?.po_no}?</AlertDialogTitle>
            <AlertDialogDescription>
              The order is closed to further receipts. Anything already received against it stays in
              stock and on the ledger — cancelling an order never reverses goods that have already
              arrived.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancelling) {
                  setOrderStatus.mutate({ id: cancelling.id, status: "cancelled" });
                }
                setCancelling(null);
              }}
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShoppingCart className="size-3.5" aria-hidden />
        An approved order can be received on the Goods Receiving screen, which is where stock and
        Accounts Payable are updated.
      </p>
    </>
  );
}
