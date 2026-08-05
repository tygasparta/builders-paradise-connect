import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useSuppliers } from "@/features/suppliers/hooks";
import { useWarehouses } from "@/features/warehouses/hooks";
import { useProducts } from "@/features/products/hooks";
import { useAuth } from "@/lib/auth/auth-context";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import type { PurchaseOrderWithRefs } from "./api";
import {
  documentTotals,
  lineTotals,
  poLineDefaults,
  purchaseOrderDefaults,
  purchaseOrderSchema,
  type PurchaseOrderFormValues,
} from "./schema";
import { useCreatePurchaseOrder, useUpdatePurchaseOrder } from "./hooks";

function money(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PurchaseOrderFormDialog({
  open,
  onOpenChange,
  order,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: PurchaseOrderWithRefs | null | undefined;
}) {
  const isEdit = Boolean(order);
  const { activeBranchId } = useAuth();
  const { can } = usePermissions();
  const createOrder = useCreatePurchaseOrder();
  const updateOrder = useUpdatePurchaseOrder();

  const { data: suppliers } = useSuppliers(false);
  const { data: warehouses } = useWarehouses(null);
  const { data: products } = useProducts({ includeInactive: false });

  const canSeeCost = can(PERMISSIONS.PRODUCTS_COST_PRICE_VIEW);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: purchaseOrderDefaults(today),
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });

  useEffect(() => {
    if (!open) return;
    if (order) {
      form.reset({
        supplier_id: order.supplier_id,
        warehouse_id: order.warehouse_id,
        branch_id: order.branch_id,
        order_date: order.order_date,
        expected_date: order.expected_date ?? "",
        quotation_ref: order.quotation_ref ?? "",
        payment_terms_days: order.payment_terms_days,
        currency_code: order.currency_code,
        notes: order.notes ?? "",
        lines: [...order.purchase_order_lines]
          .sort((a, b) => a.line_no - b.line_no)
          .map((line) => ({
            product_id: line.product_id,
            description: line.description ?? "",
            quantity_ordered: Number(line.quantity_ordered),
            unit_price: Number(line.unit_price),
            discount_percent: Number(line.discount_percent),
            tax_rate: Number(line.tax_rate),
          })),
      });
    } else {
      form.reset({ ...purchaseOrderDefaults(today), branch_id: activeBranchId });
    }
  }, [open, order, form, today, activeBranchId]);

  const watchedLines = form.watch("lines");
  const totals = documentTotals(watchedLines ?? []);
  const submitting = createOrder.isPending || updateOrder.isPending;
  const errors = form.formState.errors;

  /** Choosing a supplier adopts their currency and terms. */
  const onSupplierChange = (supplierId: string) => {
    form.setValue("supplier_id", supplierId, { shouldDirty: true });
    const supplier = suppliers?.find((s) => s.id === supplierId);
    if (supplier) {
      form.setValue("currency_code", supplier.currency_code, { shouldDirty: true });
      form.setValue("payment_terms_days", supplier.payment_terms_days, { shouldDirty: true });
    }
  };

  /** Picking a product pulls its standard cost and tax rate onto the line. */
  const onProductChange = (index: number, productId: string) => {
    form.setValue(`lines.${index}.product_id`, productId, { shouldDirty: true });
    const product = products?.find((p) => p.id === productId);
    if (product) {
      form.setValue(`lines.${index}.unit_price`, Number(product.standard_cost), {
        shouldDirty: true,
      });
      form.setValue(`lines.${index}.tax_rate`, Number(product.tax_rate), { shouldDirty: true });
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (isEdit && order) {
      await updateOrder.mutateAsync({ id: order.id, values });
    } else {
      await createOrder.mutateAsync(values);
    }
    onOpenChange(false);
  });

  const requestClose = (next: boolean) => {
    if (!next && form.formState.isDirty && !submitting) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(next);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? `Edit ${order?.po_no}` : "New purchase order"}</DialogTitle>
            <DialogDescription>
              An order commits nothing until goods are received. Stock and the ledger move at the
              GRN, not here.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Supplier"
                htmlFor="supplier_id"
                required
                error={errors.supplier_id?.message}
              >
                <Select value={form.watch("supplier_id")} onValueChange={onSupplierChange}>
                  <SelectTrigger id="supplier_id">
                    <SelectValue placeholder="Choose a supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers?.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.code} — {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Receive into"
                htmlFor="warehouse_id"
                required
                error={errors.warehouse_id?.message}
              >
                <Select
                  value={form.watch("warehouse_id")}
                  onValueChange={(value) =>
                    form.setValue("warehouse_id", value, { shouldDirty: true })
                  }
                >
                  <SelectTrigger id="warehouse_id">
                    <SelectValue placeholder="Choose a warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses?.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.code} — {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Quotation ref"
                htmlFor="quotation_ref"
                error={errors.quotation_ref?.message}
              >
                <Input id="quotation_ref" {...form.register("quotation_ref")} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <Field
                label="Order date"
                htmlFor="order_date"
                required
                error={errors.order_date?.message}
              >
                <Input id="order_date" type="date" {...form.register("order_date")} />
              </Field>
              <Field
                label="Expected delivery"
                htmlFor="expected_date"
                error={errors.expected_date?.message}
              >
                <Input id="expected_date" type="date" {...form.register("expected_date")} />
              </Field>
              <Field
                label="Payment terms (days)"
                htmlFor="payment_terms_days"
                required
                error={errors.payment_terms_days?.message}
              >
                <Input
                  id="payment_terms_days"
                  type="number"
                  min="0"
                  max="365"
                  className="num"
                  {...form.register("payment_terms_days")}
                />
              </Field>
              <Field
                label="Currency"
                htmlFor="currency_code"
                required
                error={errors.currency_code?.message}
              >
                <Input
                  id="currency_code"
                  maxLength={3}
                  className="uppercase"
                  {...form.register("currency_code")}
                />
              </Field>
            </div>

            {/* Lines */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-td font-semibold">Order lines</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ ...poLineDefaults })}
                >
                  <Plus className="size-3.5" />
                  Add line
                </Button>
              </div>

              {errors.lines?.message && (
                <p className="mb-2 text-helper text-destructive">{errors.lines.message}</p>
              )}

              <div className="table-scroll rounded-lg border border-border">
                <table className="w-full text-td">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-helper uppercase tracking-wider text-muted-foreground">
                      <th className="p-2 text-left font-semibold">Product</th>
                      <th className="w-24 p-2 text-right font-semibold">Qty</th>
                      <th className="w-28 p-2 text-right font-semibold">Unit price</th>
                      <th className="w-20 p-2 text-right font-semibold">Disc %</th>
                      <th className="w-20 p-2 text-right font-semibold">Tax %</th>
                      <th className="w-28 p-2 text-right font-semibold">Line total</th>
                      <th className="w-10 p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const line = watchedLines?.[index];
                      const computed = line
                        ? lineTotals(line)
                        : { total: 0, discount: 0, net: 0, tax: 0, gross: 0 };
                      const lineErrors = errors.lines?.[index];

                      return (
                        <tr key={field.id} className="border-b border-border last:border-0">
                          <td className="p-2">
                            <Select
                              value={form.watch(`lines.${index}.product_id`)}
                              onValueChange={(value) => onProductChange(index, value)}
                            >
                              <SelectTrigger
                                className="h-9"
                                aria-label={`Product for line ${index + 1}`}
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
                            {lineErrors?.product_id && (
                              <p className="mt-1 text-helper text-destructive">
                                {lineErrors.product_id.message}
                              </p>
                            )}
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="num h-9 text-right"
                              aria-label={`Quantity for line ${index + 1}`}
                              {...form.register(`lines.${index}.quantity_ordered`)}
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.0001"
                              min="0"
                              className="num h-9 text-right"
                              disabled={!canSeeCost}
                              aria-label={`Unit price for line ${index + 1}`}
                              {...form.register(`lines.${index}.unit_price`)}
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              className="num h-9 text-right"
                              aria-label={`Discount for line ${index + 1}`}
                              {...form.register(`lines.${index}.discount_percent`)}
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              className="num h-9 text-right"
                              aria-label={`Tax rate for line ${index + 1}`}
                              {...form.register(`lines.${index}.tax_rate`)}
                            />
                          </td>
                          <td className="num p-2 text-right font-medium">
                            {money(computed.total)}
                          </td>
                          <td className="p-2 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Remove line ${index + 1}`}
                              onClick={() => remove(index)}
                              disabled={fields.length === 1}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex justify-end">
                <dl className="w-64 space-y-1 text-td">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="num">{money(totals.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Discount</dt>
                    <dd className="num">−{money(totals.discount_total)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Tax</dt>
                    <dd className="num">{money(totals.tax_total)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1 font-semibold">
                    <dt>Total</dt>
                    <dd className="num">
                      {form.watch("currency_code")} {money(totals.total)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <Field label="Notes" htmlFor="notes" error={errors.notes?.message}>
              <Textarea id="notes" rows={2} {...form.register("notes")} />
            </Field>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => requestClose(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {isEdit ? "Save changes" : "Create order"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this order?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Closing now will lose them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscard(false);
                onOpenChange(false);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
