import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { useProducts } from "@/features/products/hooks";
import { useWarehouses } from "@/features/warehouses/hooks";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import { applyIssue, applyReceipt, canIssue } from "./costing";
import { ADJUSTMENT_REASONS } from "./api";
import { usePostAdjustment } from "./hooks";
import type { StockOnHandRow } from "./api";

const adjustmentSchema = z.object({
  product_id: z.string().uuid("Choose a product"),
  warehouse_id: z.string().uuid("Choose a warehouse"),
  direction: z.enum(["increase", "decrease"]),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  unit_cost: z.coerce.number().min(0).nullable(),
  reason: z.string().min(1, "Choose a reason"),
  explanation: z.string().trim().min(5, "Explain what happened — this is auditable"),
});

type AdjustmentValues = z.infer<typeof adjustmentSchema>;

export function AdjustmentDialog({
  open,
  onOpenChange,
  prefill,
  stock,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: StockOnHandRow | null | undefined;
  stock: StockOnHandRow[];
}) {
  const { can } = usePermissions();
  const postAdjustment = usePostAdjustment();
  const { data: products } = useProducts({ includeInactive: false });
  const { data: warehouses } = useWarehouses(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const mayGoNegative = can(PERMISSIONS.INVENTORY_NEGATIVE_STOCK_ALLOW);
  const maySeeCost = can(PERMISSIONS.PRODUCTS_COST_PRICE_VIEW);

  const form = useForm<AdjustmentValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      product_id: "",
      warehouse_id: "",
      direction: "decrease",
      quantity: 1,
      unit_cost: null,
      reason: "",
      explanation: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    form.reset({
      product_id: prefill?.product_id ?? "",
      warehouse_id: prefill?.warehouse_id ?? "",
      direction: "decrease",
      quantity: 1,
      unit_cost: null,
      reason: "",
      explanation: "",
    });
  }, [open, prefill, form]);

  const productId = form.watch("product_id");
  const warehouseId = form.watch("warehouse_id");
  const direction = form.watch("direction");
  const quantity = Number(form.watch("quantity") || 0);
  const unitCost = form.watch("unit_cost");

  const currentBalance = useMemo(() => {
    const match = stock.find(
      (row) => row.product_id === productId && row.warehouse_id === warehouseId,
    );
    return {
      quantity: Number(match?.quantity ?? 0),
      averageCost: Number(match?.average_cost ?? 0),
      totalValue: Number(match?.total_value ?? 0),
    };
  }, [stock, productId, warehouseId]);

  const warehouse = warehouses?.find((w) => w.id === warehouseId);

  /** Preview of what this posting will do, computed with the same rule the database uses. */
  const preview = useMemo(() => {
    if (!productId || !warehouseId || quantity <= 0) return null;
    try {
      if (direction === "increase") {
        const cost = unitCost ?? currentBalance.averageCost;
        return {
          after: applyReceipt(currentBalance, quantity, cost),
          blocked: null as string | null,
        };
      }
      const check = canIssue(currentBalance, quantity, {
        warehouseAllowsNegative: warehouse?.allow_negative_stock ?? false,
        userMayGoNegative: mayGoNegative,
      });
      const issue = applyIssue(currentBalance, quantity);
      return { after: issue.balance, blocked: check.allowed ? null : (check.reason ?? null) };
    } catch {
      return null;
    }
  }, [
    productId,
    warehouseId,
    quantity,
    direction,
    unitCost,
    currentBalance,
    warehouse,
    mayGoNegative,
  ]);

  const reasons = ADJUSTMENT_REASONS.filter(
    (reason) => reason.direction === "both" || reason.direction === direction,
  );

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await postAdjustment.mutateAsync({
        productId: values.product_id,
        warehouseId: values.warehouse_id,
        direction: values.direction,
        quantity: values.quantity,
        reason: values.reason,
        explanation: values.explanation,
        unitCost: values.direction === "increase" ? values.unit_cost : null,
      });
      onOpenChange(false);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "The adjustment was refused.");
    }
  });

  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Post a stock adjustment</DialogTitle>
          <DialogDescription>
            This writes an immutable movement and moves the balance immediately. It cannot be edited
            afterwards — a mistake is corrected with a second, opposite adjustment.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {serverError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2.5 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{serverError}</span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product" htmlFor="product_id" required error={errors.product_id?.message}>
              <Select
                value={productId}
                onValueChange={(value) => form.setValue("product_id", value, { shouldDirty: true })}
              >
                <SelectTrigger id="product_id">
                  <SelectValue placeholder="Choose a product" />
                </SelectTrigger>
                <SelectContent>
                  {products
                    ?.filter((product) => product.track_stock)
                    .map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.sku} — {product.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Warehouse"
              htmlFor="warehouse_id"
              required
              error={errors.warehouse_id?.message}
            >
              <Select
                value={warehouseId}
                onValueChange={(value) =>
                  form.setValue("warehouse_id", value, { shouldDirty: true })
                }
              >
                <SelectTrigger id="warehouse_id">
                  <SelectValue placeholder="Choose a warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses?.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.code} — {wh.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Direction" htmlFor="direction" required>
              <Select
                value={direction}
                onValueChange={(value) => {
                  form.setValue("direction", value as "increase" | "decrease", {
                    shouldDirty: true,
                  });
                  form.setValue("reason", "");
                }}
              >
                <SelectTrigger id="direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="decrease">Decrease stock</SelectItem>
                  <SelectItem value="increase">Increase stock</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Quantity" htmlFor="quantity" required error={errors.quantity?.message}>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0"
                className="num"
                {...form.register("quantity")}
              />
            </Field>

            {direction === "increase" && maySeeCost && (
              <Field
                label="Unit cost"
                htmlFor="unit_cost"
                error={errors.unit_cost?.message}
                hint="Blank uses the current average."
              >
                <Input
                  id="unit_cost"
                  type="number"
                  step="0.0001"
                  min="0"
                  className="num"
                  value={unitCost ?? ""}
                  onChange={(event) =>
                    form.setValue(
                      "unit_cost",
                      event.target.value === "" ? null : Number(event.target.value),
                      { shouldDirty: true },
                    )
                  }
                />
              </Field>
            )}
          </div>

          <Field label="Reason" htmlFor="reason" required error={errors.reason?.message}>
            <Select
              value={form.watch("reason")}
              onValueChange={(value) => form.setValue("reason", value, { shouldDirty: true })}
            >
              <SelectTrigger id="reason">
                <SelectValue placeholder="Why is stock changing?" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Explanation"
            htmlFor="explanation"
            required
            error={errors.explanation?.message}
            hint="Recorded against the movement and shown in the audit trail."
          >
            <Textarea id="explanation" rows={2} {...form.register("explanation")} />
          </Field>

          {preview && (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Effect of this posting
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <PreviewStat
                  label="Quantity"
                  before={currentBalance.quantity}
                  after={preview.after.quantity}
                />
                {maySeeCost && (
                  <>
                    <PreviewStat
                      label="Average cost"
                      before={currentBalance.averageCost}
                      after={preview.after.averageCost}
                      decimals={4}
                    />
                    <PreviewStat
                      label="Stock value"
                      before={currentBalance.totalValue}
                      after={preview.after.totalValue}
                    />
                  </>
                )}
              </div>
              {preview.blocked && (
                <p className="mt-2.5 flex items-start gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {preview.blocked}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={postAdjustment.isPending || Boolean(preview?.blocked)}>
              {postAdjustment.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Post adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PreviewStat({
  label,
  before,
  after,
  decimals = 2,
}: {
  label: string;
  before: number;
  after: number;
  decimals?: number;
}) {
  const changed = before !== after;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="num mt-0.5 text-sm">
        <span className="text-muted-foreground">{before.toFixed(decimals)}</span>
        <span className="mx-1.5 text-muted-foreground">→</span>
        <span className={changed ? "font-semibold text-foreground" : "text-muted-foreground"}>
          {after.toFixed(decimals)}
        </span>
      </p>
    </div>
  );
}
