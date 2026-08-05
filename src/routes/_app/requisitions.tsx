import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  CheckCircle2,
  ClipboardList,
  Download,
  Loader2,
  MoreHorizontal,
  Plus,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/erp/page-header";
import { DataTable } from "@/components/erp/data-table";
import { RequirePermission } from "@/components/erp/permission-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/erp/form-field";
import {
  REQUISITION_STATUS_LABELS,
  useCreateRequisition,
  useRequisitions,
  useSetRequisitionStatus,
  type RequisitionWithRefs,
} from "@/features/purchasing/requisitions";
import { useProducts } from "@/features/products/hooks";
import { useWarehouses } from "@/features/warehouses/hooks";
import { useAuth } from "@/lib/auth/auth-context";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import type { RequisitionStatus } from "@/lib/database.types";
import { downloadCsv } from "@/lib/export";
import { plural } from "@/lib/format";

export const Route = createFileRoute("/_app/requisitions")({
  component: RequisitionsPage,
});

function money(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-warning/20 text-warning-foreground",
  approved: "bg-success/12 text-success",
  rejected: "bg-destructive/12 text-destructive",
  converted: "bg-info/12 text-info",
  cancelled: "bg-muted text-muted-foreground",
};

function RequisitionsPage() {
  return (
    <RequirePermission require={PERMISSIONS.PURCHASE_REQUISITIONS_VIEW} what="requisitions">
      <RequisitionsScreen />
    </RequirePermission>
  );
}

function RequisitionsScreen() {
  const { can } = usePermissions();
  const canCreate = can(PERMISSIONS.PURCHASE_REQUISITIONS_CREATE);
  const canApprove = can(PERMISSIONS.PURCHASE_REQUISITIONS_APPROVE);
  const canExport = can(PERMISSIONS.REPORTS_EXPORT);

  const [status, setStatus] = useState("all");
  const [formOpen, setFormOpen] = useState(false);

  const requisitions = useRequisitions(status === "all" ? null : (status as RequisitionStatus));
  const setReqStatus = useSetRequisitionStatus();

  const estimated = (requisition: RequisitionWithRefs) =>
    requisition.purchase_requisition_lines.reduce(
      (sum, line) => sum + Number(line.quantity) * Number(line.estimated_unit_price),
      0,
    );

  const exportRequisitions = () => {
    const rows = requisitions.data ?? [];
    downloadCsv("Purchase requisitions", rows, [
      { header: "Number", value: (r) => r.requisition_no },
      { header: "Requested by", value: (r) => r.requester?.full_name },
      { header: "Department", value: (r) => r.department },
      { header: "Warehouse", value: (r) => r.warehouse?.name },
      { header: "Required by", value: (r) => r.required_date },
      { header: "Lines", value: (r) => r.purchase_requisition_lines.length },
      { header: "Estimated value", value: (r) => estimated(r).toFixed(2) },
      { header: "Reason", value: (r) => r.reason },
      { header: "Status", value: (r) => REQUISITION_STATUS_LABELS[r.status] ?? r.status },
    ]);
    toast.success(`${plural(rows.length, "requisition")} exported`);
  };

  const columns = useMemo<ColumnDef<RequisitionWithRefs, unknown>[]>(
    () => [
      {
        accessorKey: "requisition_no",
        header: "Requisition",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="num text-helper font-medium">{row.original.requisition_no}</p>
            <p className="text-helper text-muted-foreground">
              {format(new Date(row.original.created_at), "dd MMM yyyy")}
            </p>
          </div>
        ),
      },
      {
        id: "requester",
        header: "Requested by",
        accessorFn: (row) => row.requester?.full_name ?? "",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-td">{row.original.requester?.full_name ?? "—"}</p>
            <p className="truncate text-helper text-muted-foreground">
              {row.original.department ?? row.original.warehouse?.name ?? ""}
            </p>
          </div>
        ),
      },
      {
        id: "needed",
        header: "Needed by",
        accessorFn: (row) => row.required_date ?? "",
        cell: ({ row }) => (
          <span className="num text-helper text-muted-foreground">
            {row.original.required_date
              ? format(new Date(row.original.required_date), "dd MMM yyyy")
              : "—"}
          </span>
        ),
      },
      {
        id: "lines",
        header: "Lines",
        accessorFn: (row) => row.purchase_requisition_lines.length,
        cell: ({ row }) => (
          <span className="num text-td">{row.original.purchase_requisition_lines.length}</span>
        ),
      },
      {
        id: "estimate",
        header: "Estimated",
        enableSorting: false,
        cell: ({ row }) => (
          <div>
            <span className="num font-medium">{money(estimated(row.original))}</span>
            <p className="text-helper text-muted-foreground">Indicative</p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-helper font-semibold ${
              TONE[row.original.status] ?? "bg-muted text-muted-foreground"
            }`}
          >
            {REQUISITION_STATUS_LABELS[row.original.status] ?? row.original.status}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const requisition = row.original;
          const terminal = ["converted", "cancelled", "rejected"].includes(requisition.status);
          if (terminal) return null;

          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Actions for ${requisition.requisition_no}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {requisition.status === "draft" && (
                    <DropdownMenuItem
                      onSelect={() =>
                        setReqStatus.mutate({ id: requisition.id, status: "submitted" })
                      }
                    >
                      <Send className="size-4" />
                      Submit for approval
                    </DropdownMenuItem>
                  )}
                  {canApprove && ["draft", "submitted"].includes(requisition.status) && (
                    <>
                      <DropdownMenuItem
                        onSelect={() =>
                          setReqStatus.mutate({ id: requisition.id, status: "approved" })
                        }
                      >
                        <CheckCircle2 className="size-4" />
                        Approve
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          setReqStatus.mutate({
                            id: requisition.id,
                            status: "rejected",
                            reason: "Rejected by approver",
                          })
                        }
                      >
                        <XCircle className="size-4" />
                        Reject
                      </DropdownMenuItem>
                    </>
                  )}
                  {requisition.status === "approved" && (
                    <DropdownMenuItem
                      onSelect={() =>
                        setReqStatus.mutate({ id: requisition.id, status: "converted" })
                      }
                    >
                      <CheckCircle2 className="size-4" />
                      Mark as ordered
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() =>
                      setReqStatus.mutate({ id: requisition.id, status: "cancelled" })
                    }
                  >
                    Cancel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [canApprove, setReqStatus],
  );

  return (
    <>
      <PageHeader
        title="Requisitions"
        description="What the branches say they need. An approved requisition becomes a purchase order."
        breadcrumbs={[{ label: "Trade" }, { label: "Purchases" }, { label: "Requisitions" }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {canExport && (
              <Button
                variant="outline"
                onClick={exportRequisitions}
                disabled={!requisitions.data?.length}
              >
                <Download className="size-4" />
                Export
              </Button>
            )}
            {canCreate && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="size-4" />
                New requisition
              </Button>
            )}
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={requisitions.data}
        isLoading={requisitions.isLoading}
        error={requisitions.error}
        onRetry={() => void requisitions.refetch()}
        searchPlaceholder="Search by number, requester or department…"
        emptyTitle="No requisitions yet"
        emptyDescription="Raise one to ask for stock, then approve it and turn it into a purchase order."
        emptyAction={
          canCreate ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="size-4" />
              New requisition
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
              {Object.entries(REQUISITION_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <RequisitionFormDialog open={formOpen} onOpenChange={setFormOpen} />

      <p className="mt-4 flex items-center gap-1.5 text-helper text-muted-foreground">
        <ClipboardList className="size-3.5" aria-hidden />
        Prices here are estimates for approval only. The real cost is set on the purchase order and
        again on the goods received note.
      </p>
    </>
  );
}

// ---------------------------------------------------------------------
// New requisition
// ---------------------------------------------------------------------

type DraftLine = { product_id: string; quantity: number; estimated_unit_price: number };

function RequisitionFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { activeBranchId, activeWarehouseId } = useAuth();
  const createRequisition = useCreateRequisition();
  const { data: products } = useProducts({ includeInactive: false });
  const { data: warehouses } = useWarehouses(null);

  const [warehouseId, setWarehouseId] = useState("");
  const [department, setDepartment] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    { product_id: "", quantity: 1, estimated_unit_price: 0 },
  ]);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setWarehouseId(activeWarehouseId ?? "");
    setDepartment("");
    setRequiredDate("");
    setReason("");
    setNotes("");
    setLines([{ product_id: "", quantity: 1, estimated_unit_price: 0 }]);
    setServerError(null);
  }, [open, activeWarehouseId]);

  const setLine = (index: number, patch: Partial<DraftLine>) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const onProductChange = (index: number, productId: string) => {
    const product = products?.find((p) => p.id === productId);
    setLine(index, {
      product_id: productId,
      // Standard cost is a fair estimate for approval; it is not binding.
      estimated_unit_price: product ? Number(product.standard_cost) : 0,
    });
  };

  const valid = lines.filter((line) => line.product_id && line.quantity > 0);
  const total = valid.reduce((sum, l) => sum + l.quantity * l.estimated_unit_price, 0);

  const onSubmit = async () => {
    setServerError(null);
    if (valid.length === 0) {
      setServerError("Add at least one product with a quantity.");
      return;
    }
    if (reason.trim() === "") {
      setServerError("Give a reason — the approver needs to know why this is needed.");
      return;
    }
    try {
      await createRequisition.mutateAsync({
        warehouse_id: warehouseId || null,
        branch_id: activeBranchId,
        department: department.trim() || null,
        required_date: requiredDate || null,
        reason: reason.trim(),
        notes: notes.trim() || null,
        lines: valid.map((line) => ({
          product_id: line.product_id,
          quantity: line.quantity,
          estimated_unit_price: line.estimated_unit_price,
          notes: null,
        })),
      });
      onOpenChange(false);
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "The requisition could not be saved.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New requisition</DialogTitle>
          <DialogDescription>
            A request, not an order. Nothing is committed to a supplier until it is approved and
            turned into a purchase order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {serverError && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/8 px-3 py-2 text-td text-destructive"
            >
              {serverError}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="For warehouse" htmlFor="req_warehouse">
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger id="req_warehouse">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses?.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Department" htmlFor="req_department">
              <Input
                id="req_department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Yard, workshop, admin…"
              />
            </Field>
            <Field label="Needed by" htmlFor="req_date">
              <Input
                id="req_date"
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Reason" htmlFor="req_reason" required hint="Shown to the approver.">
            <Input
              id="req_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Running low ahead of the Chitungwiza contract"
            />
          </Field>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-td font-semibold">Items</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setLines((current) => [
                    ...current,
                    { product_id: "", quantity: 1, estimated_unit_price: 0 },
                  ])
                }
              >
                <Plus className="size-3.5" />
                Add item
              </Button>
            </div>

            <div className="table-scroll rounded-lg border border-border">
              <table className="w-full text-td">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-helper uppercase tracking-wider text-muted-foreground">
                    <th className="p-2 text-left font-semibold">Product</th>
                    <th className="w-24 p-2 text-right font-semibold">Qty</th>
                    <th className="w-28 p-2 text-right font-semibold">Est. price</th>
                    <th className="w-28 p-2 text-right font-semibold">Estimate</th>
                    <th className="w-10 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={index} className="border-b border-border last:border-0">
                      <td className="p-2">
                        <Select
                          value={line.product_id}
                          onValueChange={(v) => onProductChange(index, v)}
                        >
                          <SelectTrigger
                            className="h-9"
                            aria-label={`Product for item ${index + 1}`}
                          >
                            <SelectValue placeholder="Choose a product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products?.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.sku} — {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="num h-9 text-right"
                          aria-label={`Quantity for item ${index + 1}`}
                          value={line.quantity}
                          onChange={(e) =>
                            setLine(index, { quantity: Number(e.target.value || 0) })
                          }
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="num h-9 text-right"
                          aria-label={`Estimated price for item ${index + 1}`}
                          value={line.estimated_unit_price}
                          onChange={(e) =>
                            setLine(index, { estimated_unit_price: Number(e.target.value || 0) })
                          }
                        />
                      </td>
                      <td className="num p-2 text-right font-medium">
                        {money(line.quantity * line.estimated_unit_price)}
                      </td>
                      <td className="p-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Remove item ${index + 1}`}
                          disabled={lines.length === 1}
                          onClick={() =>
                            setLines((current) => current.filter((_, i) => i !== index))
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex justify-end">
              <dl className="w-56 text-td">
                <div className="flex justify-between border-t border-border pt-2 font-semibold">
                  <dt>Estimated total</dt>
                  <dd className="num">{money(total)}</dd>
                </div>
              </dl>
            </div>
          </div>

          <Field label="Notes" htmlFor="req_notes">
            <Textarea
              id="req_notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={createRequisition.isPending}>
            {createRequisition.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Create requisition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
