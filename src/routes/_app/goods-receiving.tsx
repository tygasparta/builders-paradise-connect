import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  MoreHorizontal,
  PackageCheck,
  Plus,
  Upload,
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
import { ChooseOrderDialog, ReceiveGoodsDialog } from "@/features/purchasing/receive-goods-dialog";
import { useGrns, usePostGrn, useSetGrnStatus } from "@/features/purchasing/hooks";
import { GRN_STATUS_LABELS } from "@/features/purchasing/schema";
import type { GrnWithRefs, PurchaseOrderWithRefs } from "@/features/purchasing/api";
import type { GrnStatus } from "@/lib/database.types";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import { downloadCsv } from "@/lib/export";
import { plural } from "@/lib/format";

export const Route = createFileRoute("/_app/goods-receiving")({
  component: GoodsReceivingPage,
});

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  inspected: "bg-info/12 text-info",
  approved: "bg-warning/20 text-warning-foreground",
  posted: "bg-success/12 text-success",
  cancelled: "bg-destructive/12 text-destructive",
};

function GoodsReceivingPage() {
  return (
    <RequirePermission require={PERMISSIONS.GRN_VIEW} what="goods receiving">
      <GoodsReceivingScreen />
    </RequirePermission>
  );
}

function GoodsReceivingScreen() {
  const { can } = usePermissions();
  const canCreate = can(PERMISSIONS.GRN_CREATE);
  const canInspect = can(PERMISSIONS.GRN_INSPECT);
  const canApprove = can(PERMISSIONS.GRN_APPROVE);
  const canPost = can(PERMISSIONS.GRN_POST);
  const canExport = can(PERMISSIONS.REPORTS_EXPORT);
  const canSeeCost = can(PERMISSIONS.PRODUCTS_COST_PRICE_VIEW);

  const [status, setStatus] = useState("all");
  const [chooseOpen, setChooseOpen] = useState(false);
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrderWithRefs | null>(null);
  const [posting, setPosting] = useState<GrnWithRefs | null>(null);

  const grns = useGrns({ status: status === "all" ? null : (status as GrnStatus) });
  const setGrnStatus = useSetGrnStatus();
  const postGrn = usePostGrn();

  const exportGrns = () => {
    const rows = grns.data ?? [];
    downloadCsv("Goods received notes", rows, [
      { header: "GRN", value: (g) => g.grn_no },
      { header: "Date", value: (g) => g.received_date },
      { header: "Supplier", value: (g) => g.supplier?.name },
      { header: "Purchase order", value: (g) => g.purchase_order?.po_no },
      { header: "Warehouse", value: (g) => g.warehouse?.name },
      { header: "Delivery note", value: (g) => g.delivery_note_ref },
      {
        header: "Delivered",
        value: (g) =>
          g.goods_received_note_lines.reduce((s, l) => s + Number(l.quantity_delivered), 0),
      },
      {
        header: "Accepted",
        value: (g) =>
          g.goods_received_note_lines.reduce((s, l) => s + Number(l.quantity_accepted), 0),
      },
      {
        header: "Rejected",
        value: (g) =>
          g.goods_received_note_lines.reduce((s, l) => s + Number(l.quantity_rejected), 0),
      },
      ...(canSeeCost
        ? [{ header: "Value", value: (g: GrnWithRefs) => Number(g.total_cost).toFixed(2) }]
        : []),
      { header: "Status", value: (g) => GRN_STATUS_LABELS[g.status] ?? g.status },
    ]);
    toast.success(`${plural(rows.length, "GRN")} exported`);
  };

  const columns = useMemo<ColumnDef<GrnWithRefs, unknown>[]>(() => {
    const base: ColumnDef<GrnWithRefs, unknown>[] = [
      {
        accessorKey: "grn_no",
        header: "GRN",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="num text-xs font-medium">{row.original.grn_no}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(row.original.received_date), "dd MMM yyyy")}
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
            <p className="num truncate text-xs text-muted-foreground">
              {row.original.purchase_order?.po_no ?? "Direct receipt"}
            </p>
          </div>
        ),
      },
      {
        id: "quantities",
        header: "Delivered / accepted",
        enableSorting: false,
        cell: ({ row }) => {
          const lines = row.original.goods_received_note_lines;
          const delivered = lines.reduce((s, l) => s + Number(l.quantity_delivered), 0);
          const accepted = lines.reduce((s, l) => s + Number(l.quantity_accepted), 0);
          const rejected = lines.reduce((s, l) => s + Number(l.quantity_rejected), 0);
          return (
            <div className="min-w-0">
              <p className="num text-sm">
                {delivered} / {accepted}
              </p>
              {rejected > 0 && (
                <Badge className="mt-0.5 border-0 bg-destructive/12 text-[10px] text-destructive">
                  {rejected} rejected
                </Badge>
              )}
            </div>
          );
        },
      },
    ];

    if (canSeeCost) {
      base.push({
        accessorKey: "total_cost",
        header: "Value",
        cell: ({ row }) =>
          Number(row.original.total_cost) > 0 ? (
            <span className="num font-medium">{money(row.original.total_cost)}</span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      });
    }

    base.push({
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            TONE[row.original.status] ?? "bg-muted text-muted-foreground"
          }`}
        >
          {GRN_STATUS_LABELS[row.original.status] ?? row.original.status}
        </span>
      ),
    });

    base.push({
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const grn = row.original;
        if (grn.status === "posted") {
          return (
            <span className="flex justify-end pr-2 text-[11px] text-muted-foreground">Posted</span>
          );
        }
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Actions for ${grn.grn_no}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {canInspect && grn.status === "draft" && (
                  <DropdownMenuItem
                    onSelect={() => setGrnStatus.mutate({ id: grn.id, status: "inspected" })}
                  >
                    <ClipboardCheck className="size-4" />
                    Mark inspected
                  </DropdownMenuItem>
                )}
                {canApprove && ["draft", "inspected"].includes(grn.status) && (
                  <DropdownMenuItem
                    onSelect={() => setGrnStatus.mutate({ id: grn.id, status: "approved" })}
                  >
                    <CheckCircle2 className="size-4" />
                    Approve
                  </DropdownMenuItem>
                )}
                {canPost && grn.status === "approved" && (
                  <DropdownMenuItem onSelect={() => setPosting(grn)}>
                    <Upload className="size-4" />
                    Post to stock &amp; ledger
                  </DropdownMenuItem>
                )}
                {canApprove && grn.status !== "cancelled" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setGrnStatus.mutate({ id: grn.id, status: "cancelled" })}
                    >
                      Cancel GRN
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    });

    return base;
  }, [canInspect, canApprove, canPost, canSeeCost, setGrnStatus]);

  return (
    <>
      <PageHeader
        title="Goods receiving"
        description="What actually arrived, what passed inspection, and what did not. Posting turns accepted goods into stock and a supplier liability."
        breadcrumbs={[{ label: "Trade" }, { label: "Goods receiving" }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {canExport && (
              <Button variant="outline" onClick={exportGrns} disabled={!grns.data?.length}>
                <Download className="size-4" />
                Export
              </Button>
            )}
            {canCreate && (
              <Button onClick={() => setChooseOpen(true)}>
                <Plus className="size-4" />
                Receive goods
              </Button>
            )}
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={grns.data}
        isLoading={grns.isLoading}
        error={grns.error}
        onRetry={() => void grns.refetch()}
        searchPlaceholder="Search by GRN, supplier or purchase order…"
        emptyTitle={status === "all" ? "Nothing received yet" : "No GRNs with that status"}
        emptyDescription={
          status === "all"
            ? "Approve a purchase order, then receive the delivery against it."
            : "Try a different status filter."
        }
        emptyAction={
          canCreate && status === "all" ? (
            <Button onClick={() => setChooseOpen(true)}>
              <Plus className="size-4" />
              Receive goods
            </Button>
          ) : undefined
        }
        pageSize={25}
        toolbar={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-44" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(GRN_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <ChooseOrderDialog
        open={chooseOpen}
        onOpenChange={setChooseOpen}
        onChoose={(order) => setReceivingOrder(order)}
      />

      <ReceiveGoodsDialog
        open={Boolean(receivingOrder)}
        onOpenChange={(open) => !open && setReceivingOrder(null)}
        order={receivingOrder}
      />

      <AlertDialog open={Boolean(posting)} onOpenChange={(open) => !open && setPosting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post {posting?.grn_no}?</AlertDialogTitle>
            <AlertDialogDescription>
              The accepted quantities become stock at the cost on this note, which recalculates the
              weighted average for that warehouse. The same transaction debits Inventory and credits
              Accounts Payable, and rolls the received quantities onto the purchase order. A posted
              GRN cannot be edited — a mistake is corrected with a supplier return.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (posting) postGrn.mutate(posting.id);
                setPosting(null);
              }}
            >
              Post GRN
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <PackageCheck className="size-3.5" aria-hidden />
        Only accepted quantities become stock. Rejected goods stay off the books and need a reason
        recorded on the note.
      </p>
    </>
  );
}
