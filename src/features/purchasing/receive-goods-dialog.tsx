import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/erp/form-field";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import { applyReceipt } from "@/features/inventory/costing";
import { useStockOnHand } from "@/features/inventory/hooks";
import type { PurchaseOrderWithRefs } from "./api";
import { useCreateGrn, usePurchaseOrders } from "./hooks";

function money(value: number, decimals = 2): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

type LineEntry = {
  delivered: number;
  accepted: number;
  rejectionReason: string;
};

/**
 * Receives goods against an approved purchase order.
 *
 * Delivered, accepted and rejected are captured separately because they
 * are genuinely different facts: what arrived, what passed inspection,
 * and what did not. Only the accepted quantity becomes stock — the
 * database enforces accepted + rejected = delivered.
 */
export function ReceiveGoodsDialog({
  open,
  onOpenChange,
  order,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PurchaseOrderWithRefs | null;
}) {
  const { can } = usePermissions();
  const createGrn = useCreateGrn();
  const canSeeCost = can(PERMISSIONS.PRODUCTS_COST_PRICE_VIEW);

  const [entries, setEntries] = useState<Record<string, LineEntry>>({});
  const [costs, setCosts] = useState<Record<string, number>>({});
  const [deliveryNote, setDeliveryNote] = useState("");
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  const stock = useStockOnHand({ warehouseId: order?.warehouse_id ?? null });

  useEffect(() => {
    if (!open || !order) return;
    setServerError(null);
    setDeliveryNote("");
    setNotes("");
    setReceivedDate(new Date().toISOString().slice(0, 10));

    // Default to the quantity still outstanding, all accepted. That is
    // the ordinary case; anything rejected is typed in deliberately.
    const nextEntries: Record<string, LineEntry> = {};
    const nextCosts: Record<string, number> = {};
    for (const line of order.purchase_order_lines) {
      const outstanding = Math.max(
        0,
        Number(line.quantity_ordered) - Number(line.quantity_received),
      );
      nextEntries[line.id] = { delivered: outstanding, accepted: outstanding, rejectionReason: "" };
      nextCosts[line.id] = Number(line.unit_price);
    }
    setEntries(nextEntries);
    setCosts(nextCosts);
  }, [open, order]);

  // A fresh [] each render would defeat the useMemo below it.
  const lines = useMemo(() => order?.purchase_order_lines ?? [], [order]);

  const summary = useMemo(() => {
    let acceptedValue = 0;
    let acceptedLines = 0;
    let invalid = false;

    for (const line of lines) {
      const entry = entries[line.id];
      if (!entry) continue;
      const rejected = entry.delivered - entry.accepted;
      if (rejected < 0) invalid = true;
      if (rejected > 0 && entry.rejectionReason.trim() === "") invalid = true;
      if (entry.accepted > 0) {
        acceptedLines += 1;
        acceptedValue += entry.accepted * (costs[line.id] ?? 0);
      }
    }
    return { acceptedValue, acceptedLines, invalid };
  }, [lines, entries, costs]);

  const setEntry = (lineId: string, patch: Partial<LineEntry>) =>
    setEntries((current) => ({
      ...current,
      [lineId]: {
        ...(current[lineId] ?? { delivered: 0, accepted: 0, rejectionReason: "" }),
        ...patch,
      },
    }));

  const onSubmit = async () => {
    if (!order) return;
    setServerError(null);

    const payloadLines = lines
      .map((line) => {
        const entry = entries[line.id];
        if (!entry || entry.delivered <= 0) return null;
        const rejected = entry.delivered - entry.accepted;
        return {
          purchase_order_line_id: line.id,
          product_id: line.product_id,
          quantity_ordered: Number(line.quantity_ordered),
          quantity_delivered: entry.delivered,
          quantity_accepted: entry.accepted,
          quantity_rejected: rejected,
          unit_cost: costs[line.id] ?? Number(line.unit_price),
          rejection_reason: rejected > 0 ? entry.rejectionReason.trim() : null,
          notes: null,
        };
      })
      .filter((line): line is NonNullable<typeof line> => line !== null);

    if (payloadLines.length === 0) {
      setServerError("Enter what was delivered on at least one line.");
      return;
    }

    try {
      await createGrn.mutateAsync({
        purchase_order_id: order.id,
        supplier_id: order.supplier_id,
        warehouse_id: order.warehouse_id,
        branch_id: order.branch_id,
        received_date: receivedDate,
        delivery_note_ref: deliveryNote.trim() || null,
        notes: notes.trim() || null,
        lines: payloadLines,
      });
      onOpenChange(false);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "The receipt could not be saved.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive against {order?.po_no}</DialogTitle>
          <DialogDescription>
            {order?.supplier?.name} · into {order?.warehouse?.name}. Saved as a draft GRN — stock
            and Accounts Payable move only when it is approved and posted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {serverError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2.5 text-td text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{serverError}</span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Delivery note reference" htmlFor="delivery_note">
              <Input
                id="delivery_note"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                placeholder="Supplier's delivery note"
              />
            </Field>
            <Field label="Date received" htmlFor="received_date" required>
              <Input
                id="received_date"
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
              />
            </Field>
          </div>

          <div className="table-scroll rounded-lg border border-border">
            <table className="w-full text-td">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-helper uppercase tracking-wider text-muted-foreground">
                  <th className="p-2 text-left font-semibold">Product</th>
                  <th className="w-20 p-2 text-right font-semibold">Outstanding</th>
                  <th className="w-24 p-2 text-right font-semibold">Delivered</th>
                  <th className="w-24 p-2 text-right font-semibold">Accepted</th>
                  <th className="w-20 p-2 text-right font-semibold">Rejected</th>
                  {canSeeCost && <th className="w-28 p-2 text-right font-semibold">Unit cost</th>}
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const entry = entries[line.id] ?? {
                    delivered: 0,
                    accepted: 0,
                    rejectionReason: "",
                  };
                  const outstanding = Math.max(
                    0,
                    Number(line.quantity_ordered) - Number(line.quantity_received),
                  );
                  const rejected = entry.delivered - entry.accepted;
                  const needsReason = rejected > 0 && entry.rejectionReason.trim() === "";
                  const negative = rejected < 0;

                  const balance = stock.data?.find((row) => row.product_id === line.product_id);
                  const before = {
                    quantity: Number(balance?.quantity ?? 0),
                    averageCost: Number(balance?.average_cost ?? 0),
                    totalValue: Number(balance?.total_value ?? 0),
                  };
                  const after =
                    entry.accepted > 0
                      ? applyReceipt(before, entry.accepted, costs[line.id] ?? 0)
                      : null;
                  const costMoved =
                    after !== null && Math.abs(after.averageCost - before.averageCost) > 0.00005;

                  return (
                    <tr key={line.id} className="border-b border-border align-top last:border-0">
                      <td className="p-2">
                        <p className="font-medium">{line.product?.name}</p>
                        <p className="num text-helper text-muted-foreground">
                          {line.product?.sku} · {line.product?.uom?.code}
                        </p>
                        {canSeeCost && costMoved && (
                          <p className="mt-1 text-helper text-muted-foreground">
                            Average cost {money(before.averageCost, 4)} →{" "}
                            <span className="font-medium text-foreground">
                              {money(after.averageCost, 4)}
                            </span>
                          </p>
                        )}
                        {needsReason && (
                          <Input
                            className="mt-1.5 h-8 text-helper"
                            placeholder="Why was it rejected?"
                            aria-label={`Rejection reason for ${line.product?.name}`}
                            value={entry.rejectionReason}
                            onChange={(e) => setEntry(line.id, { rejectionReason: e.target.value })}
                          />
                        )}
                      </td>
                      <td className="num p-2 text-right text-muted-foreground">{outstanding}</td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="num h-9 text-right"
                          aria-label={`Delivered quantity for ${line.product?.name}`}
                          value={entry.delivered}
                          onChange={(e) => {
                            const delivered = Number(e.target.value || 0);
                            setEntry(line.id, {
                              delivered,
                              // Keep accepted sane as delivered changes.
                              accepted: Math.min(entry.accepted, delivered),
                            });
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          max={entry.delivered}
                          className="num h-9 text-right"
                          aria-label={`Accepted quantity for ${line.product?.name}`}
                          value={entry.accepted}
                          onChange={(e) =>
                            setEntry(line.id, { accepted: Number(e.target.value || 0) })
                          }
                        />
                      </td>
                      <td
                        className={
                          negative
                            ? "num p-2 text-right font-semibold text-destructive"
                            : rejected > 0
                              ? "num p-2 text-right font-semibold text-warning-foreground"
                              : "num p-2 text-right text-muted-foreground"
                        }
                      >
                        {rejected}
                      </td>
                      {canSeeCost && (
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.0001"
                            className="num h-9 text-right"
                            aria-label={`Unit cost for ${line.product?.name}`}
                            value={costs[line.id] ?? 0}
                            onChange={(e) =>
                              setCosts((current) => ({
                                ...current,
                                [line.id]: Number(e.target.value || 0),
                              }))
                            }
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Field label="Inspection notes" htmlFor="grn_notes">
            <Textarea
              id="grn_notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Condition on arrival, discrepancies, who checked it"
            />
          </Field>

          {canSeeCost && (
            <div className="flex justify-end">
              <dl className="w-64 text-td">
                <div className="flex justify-between border-t border-border pt-2 font-semibold">
                  <dt>Value to be received</dt>
                  <dd className="num">{money(summary.acceptedValue)}</dd>
                </div>
                <p className="mt-1 text-right text-helper font-normal text-muted-foreground">
                  Accepted quantities only
                </p>
              </dl>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={summary.invalid || summary.acceptedLines === 0 || createGrn.isPending}
            title={
              summary.invalid
                ? "A rejected quantity needs a reason, and accepted cannot exceed delivered"
                : undefined
            }
          >
            {createGrn.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Create GRN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Picks which approved order is being received against. */
export function ChooseOrderDialog({
  open,
  onOpenChange,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (order: PurchaseOrderWithRefs) => void;
}) {
  const orders = usePurchaseOrders({ status: null });

  const receivable = (orders.data ?? []).filter((order) =>
    ["approved", "partially_received"].includes(order.status),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Receive goods</DialogTitle>
          <DialogDescription>
            Choose the approved purchase order the delivery is against.
          </DialogDescription>
        </DialogHeader>

        {orders.isLoading ? (
          <p className="py-8 text-center text-td text-muted-foreground">Loading orders…</p>
        ) : receivable.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-td font-medium">No orders are awaiting delivery</p>
            <p className="mt-1 text-helper text-muted-foreground">
              An order must be approved before goods can be received against it.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {receivable.map((order) => {
              const outstanding = order.purchase_order_lines.reduce(
                (sum, line) =>
                  sum + Math.max(0, Number(line.quantity_ordered) - Number(line.quantity_received)),
                0,
              );
              return (
                <li key={order.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-1 py-3 text-left transition-colors hover:bg-muted/60"
                    onClick={() => {
                      onChoose(order);
                      onOpenChange(false);
                    }}
                  >
                    <div className="min-w-0">
                      <p className="num text-helper font-medium">{order.po_no}</p>
                      <p className="truncate text-td">{order.supplier?.name}</p>
                      <p className="text-helper text-muted-foreground">
                        {order.warehouse?.name} · {outstanding} outstanding
                      </p>
                    </div>
                    <span className="num text-td font-medium">
                      {order.currency_code} {money(Number(order.total))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
