import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";

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
import { useCustomers } from "@/features/customers/hooks";
import { useWarehouses } from "@/features/warehouses/hooks";
import { useProducts } from "@/features/products/hooks";
import { useStockOnHand } from "@/features/inventory/hooks";
import { useAuth } from "@/lib/auth/auth-context";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import {
  documentTotals,
  dueDateFrom,
  lineTotals,
  salesDocumentDefaults,
  salesDocumentSchema,
  salesLineDefaults,
  type SalesDocumentValues,
} from "./schema";
import { useCreateSalesDocument } from "./hooks";

function money(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function SalesDocumentDialog({
  open,
  onOpenChange,
  kind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "invoice" | "quotation";
}) {
  const { activeBranchId, activeWarehouseId } = useAuth();
  const { can } = usePermissions();
  const createDocument = useCreateSalesDocument();

  const { data: customers } = useCustomers(false);
  const { data: warehouses } = useWarehouses(null);
  const { data: products } = useProducts({ includeInactive: false });

  const canDiscount = can(PERMISSIONS.SALES_DISCOUNT_APPLY);
  const today = new Date().toISOString().slice(0, 10);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<SalesDocumentValues>({
    resolver: zodResolver(salesDocumentSchema),
    defaultValues: salesDocumentDefaults(kind, today),
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    form.reset({
      ...salesDocumentDefaults(kind, today),
      branch_id: activeBranchId,
      warehouse_id: activeWarehouseId ?? "",
    });
  }, [open, kind, today, form, activeBranchId, activeWarehouseId]);

  const watchedLines = form.watch("lines");
  const totals = documentTotals(watchedLines ?? []);
  const customerId = form.watch("customer_id");
  const warehouseId = form.watch("warehouse_id");
  const paymentType = form.watch("payment_type");
  const errors = form.formState.errors;

  // Stock for the chosen warehouse, so an invoice line can warn before it
  // is posted rather than failing at the posting service.
  const stock = useStockOnHand({ warehouseId: warehouseId || null });

  const onCustomerChange = (value: string) => {
    const id = value === "walkin" ? null : value;
    form.setValue("customer_id", id, { shouldDirty: true });
    const customer = customers?.find((c) => c.id === id);
    if (customer) {
      form.setValue("customer_name", "", { shouldDirty: true });
      form.setValue("currency_code", customer.currency_code, { shouldDirty: true });
      if (kind === "invoice") {
        form.setValue(
          "due_date",
          dueDateFrom(form.getValues("document_date"), customer.payment_terms_days),
          { shouldDirty: true },
        );
      }
    } else {
      // A walk-in cannot be sold to on credit; the database refuses it.
      form.setValue("payment_type", "cash", { shouldDirty: true });
    }
  };

  const onProductChange = (index: number, productId: string) => {
    form.setValue(`lines.${index}.product_id`, productId, { shouldDirty: true });
    const product = products?.find((p) => p.id === productId);
    if (product) {
      form.setValue(`lines.${index}.unit_price`, Number(product.selling_price), {
        shouldDirty: true,
      });
      form.setValue(`lines.${index}.tax_rate`, Number(product.tax_rate), { shouldDirty: true });
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await createDocument.mutateAsync(values);
      onOpenChange(false);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "The document could not be saved.");
    }
  });

  const title = kind === "invoice" ? "New invoice" : "New quotation";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {kind === "invoice"
              ? "Saved as a draft. Stock and the ledger move only when it is approved and posted."
              : "A quotation reserves nothing and moves no stock."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {serverError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2.5 text-td text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{serverError}</span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Customer"
              htmlFor="customer_id"
              required
              error={errors.customer_id?.message}
            >
              <Select value={customerId ?? "walkin"} onValueChange={onCustomerChange}>
                <SelectTrigger id="customer_id">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walkin">Walk-in customer</SelectItem>
                  {customers?.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.code} — {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {customerId === null && (
              <Field
                label="Walk-in name"
                htmlFor="customer_name"
                error={errors.customer_name?.message}
              >
                <Input id="customer_name" {...form.register("customer_name")} />
              </Field>
            )}

            <Field
              label={kind === "invoice" ? "Sell from" : "Warehouse"}
              htmlFor="warehouse_id"
              required
              error={errors.warehouse_id?.message}
            >
              <Select
                value={warehouseId}
                onValueChange={(v) => form.setValue("warehouse_id", v, { shouldDirty: true })}
              >
                <SelectTrigger id="warehouse_id">
                  <SelectValue placeholder="Choose a warehouse" />
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
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <Field
              label={kind === "invoice" ? "Invoice date" : "Quotation date"}
              htmlFor="document_date"
              required
              error={errors.document_date?.message}
            >
              <Input id="document_date" type="date" {...form.register("document_date")} />
            </Field>

            {kind === "invoice" ? (
              <>
                <Field label="Due date" htmlFor="due_date" error={errors.due_date?.message}>
                  <Input id="due_date" type="date" {...form.register("due_date")} />
                </Field>
                <Field
                  label="Payment"
                  htmlFor="payment_type"
                  required
                  error={errors.payment_type?.message}
                  hint={customerId === null ? "Walk-ins are cash only." : undefined}
                >
                  <Select
                    value={paymentType}
                    onValueChange={(v) =>
                      form.setValue("payment_type", v as "cash" | "credit", { shouldDirty: true })
                    }
                    disabled={customerId === null}
                  >
                    <SelectTrigger id="payment_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash — settled now</SelectItem>
                      <SelectItem value="credit">Credit — on account</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </>
            ) : (
              <Field label="Valid until" htmlFor="valid_until" error={errors.valid_until?.message}>
                <Input id="valid_until" type="date" {...form.register("valid_until")} />
              </Field>
            )}

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

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-td font-semibold">Lines</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ ...salesLineDefaults })}
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
                    <th className="w-28 p-2 text-right font-semibold">Price</th>
                    <th className="w-20 p-2 text-right font-semibold">Disc %</th>
                    <th className="w-20 p-2 text-right font-semibold">Tax %</th>
                    <th className="w-28 p-2 text-right font-semibold">Total</th>
                    <th className="w-10 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => {
                    const line = watchedLines?.[index];
                    const computed = line
                      ? lineTotals(line)
                      : { total: 0, gross: 0, discount: 0, net: 0, tax: 0 };

                    const onHand = stock.data?.find((row) => row.product_id === line?.product_id);
                    const available = Number(onHand?.quantity ?? 0);
                    const short =
                      kind === "invoice" && line?.product_id && available < (line?.quantity ?? 0);

                    return (
                      <tr key={field.id} className="border-b border-border last:border-0">
                        <td className="p-2">
                          <Select
                            value={form.watch(`lines.${index}.product_id`)}
                            onValueChange={(v) => onProductChange(index, v)}
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
                          {short && (
                            <p className="mt-1 flex items-center gap-1 text-helper text-warning-foreground">
                              <AlertTriangle className="size-3" aria-hidden />
                              Only {available} in this warehouse
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
                            {...form.register(`lines.${index}.quantity`)}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="num h-9 text-right"
                            aria-label={`Price for line ${index + 1}`}
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
                            disabled={!canDiscount}
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
                            aria-label={`Tax for line ${index + 1}`}
                            {...form.register(`lines.${index}.tax_rate`)}
                          />
                        </td>
                        <td className="num p-2 text-right font-medium">{money(computed.total)}</td>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createDocument.isPending}>
              {createDocument.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {kind === "invoice" ? "Create invoice" : "Create quotation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
