import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { ProductWithRefs } from "./api";
import {
  invalidBarcodes,
  marginPreview,
  parseBarcodes,
  productDefaults,
  productSchema,
  type ProductFormValues,
} from "./schema";
import {
  useBrands,
  useCategories,
  useCreateProduct,
  useUnitsOfMeasure,
  useUpdateProduct,
} from "./hooks";

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductWithRefs | null | undefined;
}) {
  const isEdit = Boolean(product);
  const { can } = usePermissions();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const { data: categories } = useCategories();
  const { data: brands } = useBrands();
  const { data: uoms } = useUnitsOfMeasure();

  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const canSeeCost = can(PERMISSIONS.PRODUCTS_COST_PRICE_VIEW);
  const canSetPrice = can(PERMISSIONS.PRODUCTS_SELLING_PRICE_UPDATE);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: productDefaults,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      product
        ? {
            sku: product.sku,
            stock_code: product.stock_code ?? "",
            name: product.name,
            description: product.description ?? "",
            category_id: product.category_id,
            brand_id: product.brand_id,
            uom_id: product.uom_id,
            standard_cost: Number(product.standard_cost),
            selling_price: Number(product.selling_price),
            tax_rate: Number(product.tax_rate),
            min_stock_level: Number(product.min_stock_level),
            max_stock_level:
              product.max_stock_level === null ? null : Number(product.max_stock_level),
            reorder_level: Number(product.reorder_level),
            image_url: product.image_url ?? "",
            notes: product.notes ?? "",
            track_stock: product.track_stock,
            track_expiry: product.track_expiry,
            status: product.status,
            // Primary first, so re-saving preserves which one is primary.
            barcodes: [...product.product_barcodes]
              .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
              .map((row) => row.barcode)
              .join("\n"),
          }
        : productDefaults,
    );
  }, [open, product, form]);

  const submitting = createProduct.isPending || updateProduct.isPending;
  const errors = form.formState.errors;

  const cost = Number(form.watch("standard_cost") || 0);
  const price = Number(form.watch("selling_price") || 0);
  const margin = marginPreview(price, cost);

  const barcodeText = form.watch("barcodes") ?? "";
  const barcodeList = parseBarcodes(barcodeText);
  const badBarcodes = invalidBarcodes(barcodeList);

  const onSubmit = form.handleSubmit(async (values) => {
    if (badBarcodes.length > 0) {
      form.setError("barcodes", {
        message: `Not a valid barcode: ${badBarcodes.join(", ")}`,
      });
      return;
    }
    if (isEdit && product) {
      await updateProduct.mutateAsync({ id: product.id, values });
    } else {
      await createProduct.mutateAsync(values);
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

  const parents = (categories ?? []).filter((c) => c.parent_id === null);
  const children = (categories ?? []).filter((c) => c.parent_id !== null);

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{isEdit ? `Edit ${product?.name}` : "New product"}</DialogTitle>
            <DialogDescription>
              The catalogue record. Stock levels are set by receipts and adjustments, never here.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate>
            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="pricing">Pricing</TabsTrigger>
                <TabsTrigger value="stock">Stock control</TabsTrigger>
                <TabsTrigger value="codes">Barcodes</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="SKU" htmlFor="sku" required error={errors.sku?.message}>
                    <Input
                      id="sku"
                      className="uppercase"
                      autoFocus={!isEdit}
                      {...form.register("sku")}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field
                      label="Product name"
                      htmlFor="name"
                      required
                      error={errors.name?.message}
                    >
                      <Input id="name" {...form.register("name")} />
                    </Field>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Category" htmlFor="category_id" error={errors.category_id?.message}>
                    <Select
                      value={form.watch("category_id") ?? "none"}
                      onValueChange={(value) =>
                        form.setValue("category_id", value === "none" ? null : value, {
                          shouldDirty: true,
                        })
                      }
                    >
                      <SelectTrigger id="category_id">
                        <SelectValue placeholder="Uncategorised" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Uncategorised</SelectItem>
                        {parents.map((parent) => (
                          <CategoryOptions
                            key={parent.id}
                            parent={parent}
                            subcategories={children.filter((c) => c.parent_id === parent.id)}
                          />
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Brand" htmlFor="brand_id" error={errors.brand_id?.message}>
                    <Select
                      value={form.watch("brand_id") ?? "none"}
                      onValueChange={(value) =>
                        form.setValue("brand_id", value === "none" ? null : value, {
                          shouldDirty: true,
                        })
                      }
                    >
                      <SelectTrigger id="brand_id">
                        <SelectValue placeholder="No brand" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No brand</SelectItem>
                        {brands?.map((brand) => (
                          <SelectItem key={brand.id} value={brand.id}>
                            {brand.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field
                    label="Unit of measure"
                    htmlFor="uom_id"
                    required
                    error={errors.uom_id?.message}
                  >
                    <Select
                      value={form.watch("uom_id")}
                      onValueChange={(value) =>
                        form.setValue("uom_id", value, { shouldDirty: true })
                      }
                    >
                      <SelectTrigger id="uom_id">
                        <SelectValue placeholder="Choose" />
                      </SelectTrigger>
                      <SelectContent>
                        {uoms?.map((uom) => (
                          <SelectItem key={uom.id} value={uom.id}>
                            {uom.code} — {uom.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Field
                  label="Description"
                  htmlFor="description"
                  error={errors.description?.message}
                >
                  <Textarea id="description" rows={2} {...form.register("description")} />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Stock code" htmlFor="stock_code" error={errors.stock_code?.message}>
                    <Input id="stock_code" {...form.register("stock_code")} />
                  </Field>
                  <Field label="Image URL" htmlFor="image_url" error={errors.image_url?.message}>
                    <Input id="image_url" placeholder="https://" {...form.register("image_url")} />
                  </Field>
                </div>

                <Field label="Status" htmlFor="status" required>
                  <Select
                    value={form.watch("status")}
                    onValueChange={(value) =>
                      form.setValue("status", value as ProductFormValues["status"], {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="discontinued">Discontinued</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </TabsContent>

              <TabsContent value="pricing" className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field
                    label="Standard cost"
                    htmlFor="standard_cost"
                    error={errors.standard_cost?.message}
                    hint={
                      canSeeCost
                        ? "Used until the first receipt sets a weighted average."
                        : undefined
                    }
                  >
                    <Input
                      id="standard_cost"
                      type="number"
                      step="0.0001"
                      min="0"
                      className="num"
                      disabled={!canSeeCost}
                      {...form.register("standard_cost")}
                    />
                  </Field>

                  <Field
                    label="Selling price"
                    htmlFor="selling_price"
                    required
                    error={errors.selling_price?.message}
                    hint={canSetPrice ? undefined : "You do not have permission to change prices."}
                  >
                    <Input
                      id="selling_price"
                      type="number"
                      step="0.0001"
                      min="0"
                      className="num"
                      disabled={!canSetPrice}
                      {...form.register("selling_price")}
                    />
                  </Field>

                  <Field label="Tax rate (%)" htmlFor="tax_rate" error={errors.tax_rate?.message}>
                    <Input
                      id="tax_rate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className="num"
                      {...form.register("tax_rate")}
                    />
                  </Field>
                </div>

                {canSeeCost && (
                  <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:grid-cols-3">
                    <MarginStat label="Profit per unit" value={margin.profit.toFixed(2)} />
                    <MarginStat
                      label="Margin"
                      value={`${margin.marginPercent.toFixed(2)}%`}
                      negative={margin.marginPercent < 0}
                    />
                    <MarginStat
                      label="Markup"
                      value={`${margin.markupPercent.toFixed(2)}%`}
                      negative={margin.markupPercent < 0}
                    />
                    <p className="text-xs text-muted-foreground sm:col-span-3">
                      Indicative only. Realised margin uses the weighted average cost at the moment
                      of sale, not this figure.
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="stock" className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field
                    label="Minimum level"
                    htmlFor="min_stock_level"
                    error={errors.min_stock_level?.message}
                  >
                    <Input
                      id="min_stock_level"
                      type="number"
                      step="0.01"
                      min="0"
                      className="num"
                      {...form.register("min_stock_level")}
                    />
                  </Field>
                  <Field
                    label="Reorder level"
                    htmlFor="reorder_level"
                    error={errors.reorder_level?.message}
                    hint="Triggers the low-stock alert."
                  >
                    <Input
                      id="reorder_level"
                      type="number"
                      step="0.01"
                      min="0"
                      className="num"
                      {...form.register("reorder_level")}
                    />
                  </Field>
                  <Field
                    label="Maximum level"
                    htmlFor="max_stock_level"
                    error={errors.max_stock_level?.message}
                    hint="Blank for no ceiling."
                  >
                    <Input
                      id="max_stock_level"
                      type="number"
                      step="0.01"
                      min="0"
                      className="num"
                      value={form.watch("max_stock_level") ?? ""}
                      onChange={(event) =>
                        form.setValue(
                          "max_stock_level",
                          event.target.value === "" ? null : Number(event.target.value),
                          { shouldDirty: true },
                        )
                      }
                    />
                  </Field>
                </div>

                <div className="space-y-3 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Track stock</p>
                      <p className="text-xs text-muted-foreground">
                        Off for services and labour, which have no quantity on hand.
                      </p>
                    </div>
                    <Switch
                      checked={form.watch("track_stock")}
                      onCheckedChange={(checked) =>
                        form.setValue("track_stock", checked, { shouldDirty: true })
                      }
                      aria-label="Track stock"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                    <div>
                      <p className="text-sm font-medium">Track expiry</p>
                      <p className="text-xs text-muted-foreground">
                        For cement, adhesives and paint with a shelf life.
                      </p>
                    </div>
                    <Switch
                      checked={form.watch("track_expiry")}
                      onCheckedChange={(checked) =>
                        form.setValue("track_expiry", checked, { shouldDirty: true })
                      }
                      aria-label="Track expiry"
                    />
                  </div>
                </div>

                <Field label="Notes" htmlFor="notes" error={errors.notes?.message}>
                  <Textarea id="notes" rows={2} {...form.register("notes")} />
                </Field>
              </TabsContent>

              <TabsContent value="codes" className="mt-4 space-y-4">
                <Field
                  label="Barcodes"
                  htmlFor="barcodes"
                  error={errors.barcodes?.message}
                  hint="One per line. The first is the primary, used on shelf labels and at the till."
                >
                  <Textarea
                    id="barcodes"
                    rows={5}
                    className="num"
                    placeholder={"6001234567890\nSUP-REF-4471"}
                    {...form.register("barcodes")}
                  />
                </Field>

                <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
                  {barcodeList.length === 0 ? (
                    <p className="text-muted-foreground">
                      No barcodes yet. The SKU and stock code are always scannable without one.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {barcodeList.map((code, index) => {
                        const bad = !/^[A-Za-z0-9._-]{4,64}$/.test(code);
                        return (
                          <li key={code} className="flex items-center gap-2">
                            <span className={bad ? "num text-destructive" : "num"}>{code}</span>
                            {index === 0 && !bad && (
                              <span className="rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                Primary
                              </span>
                            )}
                            {bad && (
                              <span className="text-[10px] text-destructive">
                                letters, digits, dot, dash or underscore; 4–64 characters
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => requestClose(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {isEdit ? "Save changes" : "Create product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this product. Closing now will lose them.
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

function MarginStat({
  label,
  value,
  negative,
}: {
  label: string;
  value: string;
  negative?: boolean | undefined;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          negative ? "num mt-0.5 font-semibold text-destructive" : "num mt-0.5 font-semibold"
        }
      >
        {value}
      </p>
    </div>
  );
}

/** A parent category followed by its indented subcategories. */
function CategoryOptions({
  parent,
  subcategories,
}: {
  parent: { id: string; name: string };
  subcategories: { id: string; name: string }[];
}) {
  return (
    <>
      <SelectItem value={parent.id}>{parent.name}</SelectItem>
      {subcategories.map((child) => (
        <SelectItem key={child.id} value={child.id} className="pl-8">
          {child.name}
        </SelectItem>
      ))}
    </>
  );
}
