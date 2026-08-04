import { db, unwrap } from "@/lib/supabase";
import type {
  BrandRow,
  ProductBarcodeRow,
  ProductCategoryRow,
  ProductRow,
  UnitOfMeasureRow,
} from "@/lib/database.types";
import { parseBarcodes, toProductPayload, type ProductFormValues } from "./schema";

export type ProductWithRefs = ProductRow & {
  category: { id: string; name: string; parent_id: string | null } | null;
  brand: { id: string; name: string } | null;
  uom: { id: string; code: string; name: string; allow_decimal: boolean } | null;
  product_barcodes: { id: string; barcode: string; is_primary: boolean }[];
};

const SELECT_WITH_REFS = `
  *,
  category:product_categories!products_category_id_fkey(id, name, parent_id),
  brand:brands!products_brand_id_fkey(id, name),
  uom:units_of_measure!products_uom_id_fkey(id, code, name, allow_decimal),
  product_barcodes(id, barcode, is_primary)
`;

export async function listProducts(options: {
  includeInactive?: boolean;
  categoryId?: string | null;
  brandId?: string | null;
}): Promise<ProductWithRefs[]> {
  let query = db.from("products").select(SELECT_WITH_REFS).order("name");

  if (!options.includeInactive) query = query.eq("status", "active");
  if (options.categoryId) query = query.eq("category_id", options.categoryId);
  if (options.brandId) query = query.eq("brand_id", options.brandId);

  return unwrap(await query) as unknown as ProductWithRefs[];
}

export async function listCategories(): Promise<ProductCategoryRow[]> {
  return unwrap(
    await db.from("product_categories").select("*").eq("status", "active").order("name"),
  ) as ProductCategoryRow[];
}

export async function listBrands(): Promise<BrandRow[]> {
  return unwrap(
    await db.from("brands").select("*").eq("status", "active").order("name"),
  ) as BrandRow[];
}

export async function listUnitsOfMeasure(): Promise<UnitOfMeasureRow[]> {
  return unwrap(
    await db.from("units_of_measure").select("*").eq("status", "active").order("code"),
  ) as UnitOfMeasureRow[];
}

/**
 * Replaces a product's barcodes.
 *
 * There is no bulk "set" in PostgREST, so this deletes the ones that went
 * and inserts the ones that arrived, leaving untouched codes alone — which
 * keeps their created_at and avoids a pointless audit entry per save.
 */
async function syncBarcodes(productId: string, codes: string[]): Promise<void> {
  const existing = unwrap(
    await db.from("product_barcodes").select("id, barcode, is_primary").eq("product_id", productId),
  ) as Pick<ProductBarcodeRow, "id" | "barcode" | "is_primary">[];

  const wanted = new Map(codes.map((code, index) => [code.toLowerCase(), { code, index }]));
  const removals = existing.filter((row) => !wanted.has(row.barcode.toLowerCase()));

  if (removals.length > 0) {
    const { error } = await db
      .from("product_barcodes")
      .delete()
      .in(
        "id",
        removals.map((row) => row.id),
      );
    if (error) throw new Error(error.message);
  }

  const existingCodes = new Set(existing.map((row) => row.barcode.toLowerCase()));
  const additions = codes.filter((code) => !existingCodes.has(code.toLowerCase()));

  if (additions.length > 0) {
    unwrap(
      await db
        .from("product_barcodes")
        .insert(additions.map((code) => ({ product_id: productId, barcode: code })))
        .select("id"),
    );
  }

  // Exactly one primary, and it is the first code the user listed.
  const primary = codes[0];
  if (primary) {
    const { error: clearError } = await db
      .from("product_barcodes")
      .update({ is_primary: false })
      .eq("product_id", productId)
      .neq("barcode", primary);
    if (clearError) throw new Error(clearError.message);

    const { error: setError } = await db
      .from("product_barcodes")
      .update({ is_primary: true })
      .eq("product_id", productId)
      .eq("barcode", primary);
    if (setError) throw new Error(setError.message);
  }
}

export async function createProduct(values: ProductFormValues): Promise<ProductRow> {
  const rows = unwrap(
    await db.from("products").insert(toProductPayload(values)).select("*"),
  ) as ProductRow[];
  const created = rows[0];
  if (!created) throw new Error("The product was not created.");

  const codes = parseBarcodes(values.barcodes);
  if (codes.length > 0) await syncBarcodes(created.id, codes);

  return created;
}

export async function updateProduct(id: string, values: ProductFormValues): Promise<ProductRow> {
  const rows = unwrap(
    await db.from("products").update(toProductPayload(values)).eq("id", id).select("*"),
  ) as ProductRow[];
  const updated = rows[0];
  if (!updated) {
    throw new Error("The product could not be saved. You may not have permission.");
  }

  await syncBarcodes(id, parseBarcodes(values.barcodes));
  return updated;
}

/** Products are discontinued, never deleted — movements reference them forever. */
export async function setProductStatus(
  id: string,
  status: "active" | "inactive" | "discontinued",
): Promise<void> {
  const rows = unwrap(await db.from("products").update({ status }).eq("id", id).select("id")) as {
    id: string;
  }[];
  if (rows.length === 0) {
    throw new Error("The product status could not be changed. You may not have permission.");
  }
}

/** Resolves a scanned code — barcode, SKU or stock code — to one product. */
export async function findProductByScan(code: string) {
  const { data, error } = await db.rpc("find_product_by_scan", { p_code: code });
  if (error) throw new Error(error.message);
  return (data ?? [])[0] ?? null;
}
