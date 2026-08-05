import { z } from "zod";

import { documentTotals, lineTotals } from "@/lib/document-math";

export { documentTotals, lineTotals };

export const salesLineSchema = z.object({
  product_id: z.string().uuid("Choose a product"),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  unit_price: z.coerce.number().min(0, "Price cannot be negative"),
  discount_percent: z.coerce.number().min(0).max(100, "Discount cannot exceed 100%"),
  tax_rate: z.coerce.number().min(0).max(100, "Tax cannot exceed 100%"),
});

export type SalesLineValues = z.infer<typeof salesLineSchema>;

export const salesLineDefaults: SalesLineValues = {
  product_id: "",
  description: "",
  quantity: 1,
  unit_price: 0,
  discount_percent: 0,
  tax_rate: 0,
};

export const salesDocumentSchema = z
  .object({
    kind: z.enum(["invoice", "quotation"]),
    customer_id: z.string().uuid().nullable(),
    customer_name: z.string().trim().max(160).optional().or(z.literal("")),
    warehouse_id: z.string().uuid("Choose a warehouse"),
    branch_id: z.string().uuid().nullable(),
    document_date: z.string().min(1, "Date is required"),
    due_date: z.string().optional().or(z.literal("")),
    valid_until: z.string().optional().or(z.literal("")),
    payment_type: z.enum(["cash", "credit"]),
    currency_code: z
      .string()
      .trim()
      .length(3)
      .regex(/^[A-Z]{3}$/, "3-letter code"),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
    lines: z.array(salesLineSchema).min(1, "Add at least one line"),
  })
  .refine((v) => v.customer_id !== null || (v.customer_name ?? "").trim().length > 0, {
    message: "Choose a customer, or type a name for a walk-in",
    path: ["customer_id"],
  })
  // The database enforces this too; catching it here explains why.
  .refine((v) => v.payment_type === "cash" || v.customer_id !== null, {
    message: "A credit sale must be to a customer account, not a walk-in",
    path: ["payment_type"],
  });

export type SalesDocumentValues = z.infer<typeof salesDocumentSchema>;

export function salesDocumentDefaults(
  kind: "invoice" | "quotation",
  today: string,
): SalesDocumentValues {
  return {
    kind,
    customer_id: null,
    customer_name: "",
    warehouse_id: "",
    branch_id: null,
    document_date: today,
    due_date: "",
    valid_until: "",
    payment_type: "cash",
    currency_code: "USD",
    notes: "",
    lines: [{ ...salesLineDefaults }],
  };
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  posted: "Posted",
  partially_paid: "Part paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export const QUOTATION_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  converted: "Converted",
  cancelled: "Cancelled",
};

export const RETURN_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  posted: "Posted",
  cancelled: "Cancelled",
};

export const RETURN_REASONS = [
  "Damaged in transit",
  "Wrong item supplied",
  "Not required",
  "Faulty goods",
  "Over-supplied",
  "Other",
] as const;

/** Due date from the customer's terms. */
export function dueDateFrom(invoiceDate: string, termsDays: number): string {
  const date = new Date(invoiceDate);
  date.setDate(date.getDate() + termsDays);
  return date.toISOString().slice(0, 10);
}
