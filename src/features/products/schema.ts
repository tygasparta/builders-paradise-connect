import { z } from "zod";

/**
 * Mirrors the database CHECK constraints so the user is corrected in the
 * form rather than by a Postgres error after pressing Save.
 */
export const productSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .min(2, "SKU must be at least 2 characters")
      .max(40, "SKU must be 40 characters or fewer"),
    stock_code: z.string().trim().max(40).optional().or(z.literal("")),
    name: z.string().trim().min(2, "Product name is required").max(160, "Name is too long"),
    description: z.string().trim().max(2000).optional().or(z.literal("")),

    category_id: z.string().uuid().nullable(),
    brand_id: z.string().uuid().nullable(),
    uom_id: z.string().uuid("Choose a unit of measure"),

    standard_cost: z.coerce.number().min(0, "Cost cannot be negative"),
    selling_price: z.coerce.number().min(0, "Selling price cannot be negative"),
    tax_rate: z.coerce
      .number()
      .min(0, "Tax rate cannot be negative")
      .max(100, "Tax rate cannot exceed 100%"),

    min_stock_level: z.coerce.number().min(0, "Cannot be negative"),
    max_stock_level: z.coerce.number().min(0, "Cannot be negative").nullable(),
    reorder_level: z.coerce.number().min(0, "Cannot be negative"),

    image_url: z.string().trim().url("Enter a full URL").optional().or(z.literal("")),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),

    track_stock: z.boolean(),
    track_expiry: z.boolean(),
    status: z.enum(["active", "inactive", "discontinued"]),

    /** Free-text field on the form; split into product_barcodes on save. */
    barcodes: z.string().trim().max(600).optional().or(z.literal("")),
  })
  .refine(
    (values) => values.max_stock_level === null || values.max_stock_level >= values.min_stock_level,
    { message: "Maximum must be at least the minimum", path: ["max_stock_level"] },
  );

export type ProductFormValues = z.infer<typeof productSchema>;

export const productDefaults: ProductFormValues = {
  sku: "",
  stock_code: "",
  name: "",
  description: "",
  category_id: null,
  brand_id: null,
  uom_id: "",
  standard_cost: 0,
  selling_price: 0,
  tax_rate: 0,
  min_stock_level: 0,
  max_stock_level: null,
  reorder_level: 0,
  image_url: "",
  notes: "",
  track_stock: true,
  track_expiry: false,
  status: "active",
  barcodes: "",
};

const blankToNull = (value: string | undefined | null) =>
  value === undefined || value === null || value.trim() === "" ? null : value.trim();

export function toProductPayload(values: ProductFormValues) {
  return {
    sku: values.sku.trim().toUpperCase(),
    stock_code: blankToNull(values.stock_code),
    name: values.name.trim(),
    description: blankToNull(values.description),
    category_id: values.category_id,
    brand_id: values.brand_id,
    uom_id: values.uom_id,
    standard_cost: values.standard_cost,
    selling_price: values.selling_price,
    tax_rate: values.tax_rate,
    min_stock_level: values.min_stock_level,
    max_stock_level: values.max_stock_level,
    reorder_level: values.reorder_level,
    image_url: blankToNull(values.image_url),
    notes: blankToNull(values.notes),
    track_stock: values.track_stock,
    track_expiry: values.track_expiry,
    status: values.status,
  };
}

/**
 * Barcodes are entered as one line each. The first becomes the primary,
 * which is what shelf labels and "add by scan" use.
 */
export function parseBarcodes(input: string | undefined): string[] {
  if (!input) return [];
  const seen = new Set<string>();
  return input
    .split(/[\n,]/)
    .map((code) => code.trim())
    .filter((code) => {
      if (code === "" || seen.has(code.toLowerCase())) return false;
      seen.add(code.toLowerCase());
      return true;
    });
}

/** Matches product_barcodes_format in the migration. */
export const BARCODE_PATTERN = /^[A-Za-z0-9._-]{4,64}$/;

export function invalidBarcodes(codes: string[]): string[] {
  return codes.filter((code) => !BARCODE_PATTERN.test(code));
}

/**
 * Margin preview for the product form. Uses standard cost, which is what
 * the catalogue knows; realised margin comes from the weighted average at
 * the moment of sale.
 */
export function marginPreview(sellingPrice: number, cost: number) {
  const profit = sellingPrice - cost;
  const marginPercent = sellingPrice === 0 ? 0 : (profit / sellingPrice) * 100;
  const markupPercent = cost === 0 ? 0 : (profit / cost) * 100;
  return {
    profit: Math.round(profit * 1e4) / 1e4,
    marginPercent: Math.round(marginPercent * 100) / 100,
    markupPercent: Math.round(markupPercent * 100) / 100,
  };
}
