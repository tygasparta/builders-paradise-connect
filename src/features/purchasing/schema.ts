import { z } from "zod";

// One implementation of the line maths, shared with sales.
import {
  documentTotals as sharedDocumentTotals,
  lineTotals as sharedLineTotals,
  type DocumentTotals,
  type LineTotals,
} from "@/lib/document-math";

/** One editable line on a purchase order. */
export const poLineSchema = z.object({
  product_id: z.string().uuid("Choose a product"),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  quantity_ordered: z.coerce.number().positive("Quantity must be greater than zero"),
  unit_price: z.coerce.number().min(0, "Price cannot be negative"),
  discount_percent: z.coerce.number().min(0).max(100, "Discount cannot exceed 100%"),
  tax_rate: z.coerce.number().min(0).max(100, "Tax cannot exceed 100%"),
});

export type PoLineValues = z.infer<typeof poLineSchema>;

export const purchaseOrderSchema = z.object({
  supplier_id: z.string().uuid("Choose a supplier"),
  warehouse_id: z.string().uuid("Choose a receiving warehouse"),
  branch_id: z.string().uuid().nullable(),
  order_date: z.string().min(1, "Order date is required"),
  expected_date: z.string().optional().or(z.literal("")),
  quotation_ref: z.string().trim().max(60).optional().or(z.literal("")),
  payment_terms_days: z.coerce.number().int().min(0).max(365),
  currency_code: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  lines: z.array(poLineSchema).min(1, "A purchase order needs at least one line"),
});

export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;

export const poLineDefaults: PoLineValues = {
  product_id: "",
  description: "",
  quantity_ordered: 1,
  unit_price: 0,
  discount_percent: 0,
  tax_rate: 0,
};

export function purchaseOrderDefaults(today: string): PurchaseOrderFormValues {
  return {
    supplier_id: "",
    warehouse_id: "",
    branch_id: null,
    order_date: today,
    expected_date: "",
    quotation_ref: "",
    payment_terms_days: 30,
    currency_code: "USD",
    notes: "",
    lines: [{ ...poLineDefaults }],
  };
}

/** Statuses a purchase order can be edited in. */
export const PO_EDITABLE_STATUSES = ["draft", "pending_approval"] as const;

export const PO_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  partially_received: "Partially received",
  received: "Received",
  cancelled: "Cancelled",
  closed: "Closed",
};

export const GRN_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  inspected: "Inspected",
  approved: "Approved",
  posted: "Posted",
  cancelled: "Cancelled",
};

type PoLineLike = {
  quantity_ordered: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
};

const asDocumentLine = (line: PoLineLike) => ({
  quantity: line.quantity_ordered,
  unit_price: line.unit_price,
  discount_percent: line.discount_percent,
  tax_rate: line.tax_rate,
});

export function lineTotals(line: PoLineLike): LineTotals {
  return sharedLineTotals(asDocumentLine(line));
}

export function documentTotals(lines: readonly PoLineLike[]): DocumentTotals {
  return sharedDocumentTotals(lines.map(asDocumentLine));
}
