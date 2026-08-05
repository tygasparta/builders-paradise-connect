import { useEffect, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/erp/form-field";
import type { InvoiceWithRefs } from "./api";
import { RETURN_REASONS } from "./schema";
import { useCreateReturn } from "./hooks";

function money(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Raises a credit note against a posted invoice.
 *
 * Quantities default to zero rather than the full invoiced amount: a
 * partial return is the common case, and pre-filling the whole line
 * invites crediting more than came back.
 */
export function CreditNoteDialog({
  open,
  onOpenChange,
  invoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceWithRefs | null;
}) {
  const createReturn = useCreateReturn();
  const [reason, setReason] = useState<string>(RETURN_REASONS[0]);
  const [restock, setRestock] = useState(true);
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason(RETURN_REASONS[0]);
    setRestock(true);
    setNotes("");
    setQuantities({});
    setServerError(null);
  }, [open]);

  const lines = invoice?.sales_invoice_lines ?? [];
  const chosen = lines
    .map((line) => ({ line, quantity: quantities[line.id] ?? 0 }))
    .filter((entry) => entry.quantity > 0);

  const total = chosen.reduce(
    (sum, { line, quantity }) =>
      sum + quantity * Number(line.unit_price) * (1 + Number(line.tax_rate) / 100),
    0,
  );

  const overReturn = lines.some((line) => (quantities[line.id] ?? 0) > Number(line.quantity));

  const onSubmit = async () => {
    if (!invoice || chosen.length === 0) return;
    setServerError(null);
    try {
      await createReturn.mutateAsync({
        invoice,
        reason,
        restock,
        notes: notes.trim() || null,
        lines: chosen.map(({ line, quantity }) => ({
          invoice_line_id: line.id,
          product_id: line.product_id,
          quantity,
          unit_price: Number(line.unit_price),
          tax_rate: Number(line.tax_rate),
        })),
      });
      onOpenChange(false);
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "The credit note could not be saved.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Credit note against {invoice?.invoice_no}</DialogTitle>
          <DialogDescription>
            Enter what actually came back. Saved as a draft — stock and the ledger move only when it
            is approved and posted.
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

          <div className="table-scroll rounded-lg border border-border">
            <table className="w-full text-td">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-helper uppercase tracking-wider text-muted-foreground">
                  <th className="p-2 text-left font-semibold">Product</th>
                  <th className="w-24 p-2 text-right font-semibold">Sold</th>
                  <th className="w-28 p-2 text-right font-semibold">Returning</th>
                  <th className="w-28 p-2 text-right font-semibold">Credit</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const quantity = quantities[line.id] ?? 0;
                  const over = quantity > Number(line.quantity);
                  const credit =
                    quantity * Number(line.unit_price) * (1 + Number(line.tax_rate) / 100);
                  return (
                    <tr key={line.id} className="border-b border-border last:border-0">
                      <td className="p-2">
                        <p className="font-medium">{line.product?.name}</p>
                        <p className="num text-helper text-muted-foreground">{line.product?.sku}</p>
                      </td>
                      <td className="num p-2 text-right">{Number(line.quantity)}</td>
                      <td className="p-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={Number(line.quantity)}
                          className="num h-9 text-right"
                          aria-label={`Quantity returned for ${line.product?.name}`}
                          value={quantity === 0 ? "" : quantity}
                          onChange={(e) =>
                            setQuantities((prev) => ({
                              ...prev,
                              [line.id]: e.target.value === "" ? 0 : Number(e.target.value),
                            }))
                          }
                        />
                        {over && (
                          <p className="mt-1 text-helper text-destructive">
                            More than was sold on this line
                          </p>
                        )}
                      </td>
                      <td className="num p-2 text-right font-medium">{money(credit)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Reason" htmlFor="reason" required>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETURN_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="pr-3">
                <p className="text-td font-medium">Put back into stock</p>
                <p className="text-helper text-muted-foreground">
                  Off for damaged goods: the customer is still credited, but nothing returns to the
                  shelf.
                </p>
              </div>
              <Switch checked={restock} onCheckedChange={setRestock} aria-label="Restock" />
            </div>
          </div>

          <Field label="Notes" htmlFor="return_notes">
            <Textarea
              id="return_notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>

          <div className="flex justify-end">
            <dl className="w-56 text-td">
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <dt>Credit total</dt>
                <dd className="num">
                  {invoice?.currency_code} {money(total)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={chosen.length === 0 || overReturn || createReturn.isPending}
          >
            {createReturn.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Create credit note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
