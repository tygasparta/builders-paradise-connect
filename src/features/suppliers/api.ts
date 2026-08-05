import { db, unwrap } from "@/lib/supabase";
import type { SupplierRow } from "@/lib/database.types";
import { toSupplierPayload, type SupplierFormValues } from "./schema";

/**
 * Reads go through `suppliers_directory`, which nulls the bank columns for
 * users without a supplier-payment permission. Writes go to the table.
 */
export async function listSuppliers(includeInactive = false): Promise<SupplierRow[]> {
  let query = db.from("suppliers_directory").select("*").order("name");
  if (!includeInactive) query = query.eq("status", "active");
  return unwrap(await query) as unknown as SupplierRow[];
}

export async function createSupplier(values: SupplierFormValues): Promise<SupplierRow> {
  const rows = unwrap(
    await db.from("suppliers").insert(toSupplierPayload(values)).select("*"),
  ) as SupplierRow[];
  const created = rows[0];
  if (!created) throw new Error("The supplier was not created.");
  return created;
}

export async function updateSupplier(id: string, values: SupplierFormValues): Promise<SupplierRow> {
  const rows = unwrap(
    await db.from("suppliers").update(toSupplierPayload(values)).eq("id", id).select("*"),
  ) as SupplierRow[];
  const updated = rows[0];
  if (!updated) {
    throw new Error("The supplier could not be saved. You may not have permission.");
  }
  return updated;
}

/** Suppliers are archived or blocked, never deleted — orders reference them. */
export async function setSupplierStatus(
  id: string,
  status: "active" | "inactive" | "blocked",
): Promise<void> {
  const rows = unwrap(await db.from("suppliers").update({ status }).eq("id", id).select("id")) as {
    id: string;
  }[];
  if (rows.length === 0) {
    throw new Error("The supplier status could not be changed. You may not have permission.");
  }
}

/** Products for which this supplier is the default source. */
export async function listSupplierProducts(supplierId: string) {
  return unwrap(
    await db
      .from("products")
      .select("id, sku, name, standard_cost, status")
      .eq("default_supplier_id", supplierId)
      .order("name"),
  ) as { id: string; sku: string; name: string; standard_cost: number; status: string }[];
}

// ---------------------------------------------------------------------
// Account activity — what a supplier detail view needs
// ---------------------------------------------------------------------

export type SupplierOrderRow = {
  id: string;
  po_no: string;
  order_date: string;
  expected_date: string | null;
  currency_code: string;
  total: number;
  status: string;
};

export type SupplierGrnRow = {
  id: string;
  grn_no: string;
  received_date: string;
  delivery_note_ref: string | null;
  total_cost: number;
  status: string;
};

export type SupplierActivity = {
  orders: SupplierOrderRow[];
  grns: SupplierGrnRow[];
};

/** Purchase orders and goods receipts for one supplier. */
export async function fetchSupplierActivity(supplierId: string): Promise<SupplierActivity> {
  const [orders, grns] = await Promise.all([
    db
      .from("purchase_orders")
      .select("id, po_no, order_date, expected_date, currency_code, total, status")
      .eq("supplier_id", supplierId)
      .order("order_date", { ascending: false }),
    db
      .from("goods_received_notes")
      .select("id, grn_no, received_date, delivery_note_ref, total_cost, status")
      .eq("supplier_id", supplierId)
      .order("received_date", { ascending: false }),
  ]);

  return {
    orders: unwrap(orders) as unknown as SupplierOrderRow[],
    grns: unwrap(grns) as unknown as SupplierGrnRow[],
  };
}
