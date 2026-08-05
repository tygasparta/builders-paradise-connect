import { db, unwrap } from "@/lib/supabase";
import type {
  GoodsReceivedNoteLineRow,
  GoodsReceivedNoteRow,
  GrnStatus,
  PurchaseOrderLineRow,
  PurchaseOrderRow,
  PurchaseOrderStatus,
} from "@/lib/database.types";
import { documentTotals, lineTotals, type PurchaseOrderFormValues } from "./schema";

export type PurchaseOrderWithRefs = PurchaseOrderRow & {
  supplier: { id: string; name: string; code: string; currency_code: string } | null;
  warehouse: { id: string; name: string; code: string } | null;
  purchase_order_lines: (PurchaseOrderLineRow & {
    product: { sku: string; name: string; uom: { code: string } | null } | null;
  })[];
};

const PO_SELECT: string = `
  *,
  supplier:suppliers!purchase_orders_supplier_id_fkey(id, name, code, currency_code),
  warehouse:warehouses!purchase_orders_warehouse_id_fkey(id, name, code),
  purchase_order_lines(
    *,
    product:products!purchase_order_lines_product_id_fkey(
      sku, name, uom:units_of_measure!products_uom_id_fkey(code)
    )
  )
`;

export async function listPurchaseOrders(filters: {
  status?: PurchaseOrderStatus | null;
  supplierId?: string | null;
}): Promise<PurchaseOrderWithRefs[]> {
  let query = db
    .from("purchase_orders")
    .select(PO_SELECT)
    .order("order_date", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);
  return unwrap(await query) as unknown as PurchaseOrderWithRefs[];
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrderWithRefs> {
  const rows = unwrap(
    await db.from("purchase_orders").select(PO_SELECT).eq("id", id),
  ) as unknown as PurchaseOrderWithRefs[];
  const order = rows[0];
  if (!order) throw new Error("That purchase order could not be found.");
  return order;
}

async function nextNumber(docType: string): Promise<string> {
  const { data, error } = await db.rpc("next_document_number", { p_doc_type: docType });
  if (error) throw new Error(error.message);
  return data as unknown as string;
}

/**
 * Creates a purchase order and its lines.
 *
 * PostgREST has no multi-table transaction, so the header goes in first
 * and the lines follow. If the lines fail the header is deleted, because
 * a draft order with no lines is worse than none — it would sit in the
 * list looking real. A draft has moved no stock and no money, so removing
 * it destroys nothing.
 */
export async function createPurchaseOrder(
  values: PurchaseOrderFormValues,
): Promise<PurchaseOrderRow> {
  const totals = documentTotals(values.lines);
  const poNo = await nextNumber("purchase_order");

  const headers = unwrap(
    await db
      .from("purchase_orders")
      .insert({
        po_no: poNo,
        supplier_id: values.supplier_id,
        warehouse_id: values.warehouse_id,
        branch_id: values.branch_id,
        order_date: values.order_date,
        expected_date: values.expected_date || null,
        quotation_ref: values.quotation_ref?.trim() || null,
        payment_terms_days: values.payment_terms_days,
        currency_code: values.currency_code.toUpperCase(),
        subtotal: totals.subtotal,
        discount_total: totals.discount_total,
        tax_total: totals.tax_total,
        total: totals.total,
        notes: values.notes?.trim() || null,
        status: "draft",
      })
      .select("*"),
  ) as PurchaseOrderRow[];

  const order = headers[0];
  if (!order) throw new Error("The purchase order was not created.");

  try {
    unwrap(
      await db
        .from("purchase_order_lines")
        .insert(
          values.lines.map((line, index) => ({
            purchase_order_id: order.id,
            line_no: index + 1,
            product_id: line.product_id,
            description: line.description?.trim() || null,
            quantity_ordered: line.quantity_ordered,
            unit_price: line.unit_price,
            discount_percent: line.discount_percent,
            tax_rate: line.tax_rate,
            line_total: lineTotals(line).total,
          })),
        )
        .select("id"),
    );
  } catch (error) {
    await db.from("purchase_orders").delete().eq("id", order.id);
    throw error;
  }

  return order;
}

/** Replaces the lines of a draft order and recomputes the totals. */
export async function updatePurchaseOrder(
  id: string,
  values: PurchaseOrderFormValues,
): Promise<PurchaseOrderRow> {
  const totals = documentTotals(values.lines);

  const rows = unwrap(
    await db
      .from("purchase_orders")
      .update({
        supplier_id: values.supplier_id,
        warehouse_id: values.warehouse_id,
        branch_id: values.branch_id,
        order_date: values.order_date,
        expected_date: values.expected_date || null,
        quotation_ref: values.quotation_ref?.trim() || null,
        payment_terms_days: values.payment_terms_days,
        currency_code: values.currency_code.toUpperCase(),
        subtotal: totals.subtotal,
        discount_total: totals.discount_total,
        tax_total: totals.tax_total,
        total: totals.total,
        notes: values.notes?.trim() || null,
      })
      .eq("id", id)
      .select("*"),
  ) as PurchaseOrderRow[];

  const order = rows[0];
  if (!order)
    throw new Error("The purchase order could not be saved. It may no longer be a draft.");

  const { error: deleteError } = await db
    .from("purchase_order_lines")
    .delete()
    .eq("purchase_order_id", id);
  if (deleteError) throw new Error(deleteError.message);

  unwrap(
    await db
      .from("purchase_order_lines")
      .insert(
        values.lines.map((line, index) => ({
          purchase_order_id: id,
          line_no: index + 1,
          product_id: line.product_id,
          description: line.description?.trim() || null,
          quantity_ordered: line.quantity_ordered,
          unit_price: line.unit_price,
          discount_percent: line.discount_percent,
          tax_rate: line.tax_rate,
          line_total: lineTotals(line).total,
        })),
      )
      .select("id"),
  );

  return order;
}

export async function setPurchaseOrderStatus(
  id: string,
  status: PurchaseOrderRow["status"],
  extra: { cancelled_reason?: string } = {},
): Promise<void> {
  const patch: {
    status: PurchaseOrderStatus;
    approved_at?: string;
    cancelled_reason?: string;
  } = {
    status,
    ...(status === "approved" ? { approved_at: new Date().toISOString() } : {}),
    ...(extra.cancelled_reason ? { cancelled_reason: extra.cancelled_reason } : {}),
  };

  const rows = unwrap(await db.from("purchase_orders").update(patch).eq("id", id).select("id")) as {
    id: string;
  }[];
  if (rows.length === 0) {
    throw new Error("The purchase order status could not be changed. You may not have permission.");
  }
}

// ---------------------------------------------------------------------
// Goods received notes
// ---------------------------------------------------------------------

export type GrnWithRefs = GoodsReceivedNoteRow & {
  supplier: { id: string; name: string; code: string } | null;
  warehouse: { id: string; name: string; code: string } | null;
  purchase_order: { id: string; po_no: string } | null;
  goods_received_note_lines: (GoodsReceivedNoteLineRow & {
    product: { sku: string; name: string; uom: { code: string } | null } | null;
  })[];
};

const GRN_SELECT: string = `
  *,
  supplier:suppliers!goods_received_notes_supplier_id_fkey(id, name, code),
  warehouse:warehouses!goods_received_notes_warehouse_id_fkey(id, name, code),
  purchase_order:purchase_orders!goods_received_notes_purchase_order_id_fkey(id, po_no),
  goods_received_note_lines(
    *,
    product:products!goods_received_note_lines_product_id_fkey(
      sku, name, uom:units_of_measure!products_uom_id_fkey(code)
    )
  )
`;

export async function listGrns(filters: { status?: GrnStatus | null }): Promise<GrnWithRefs[]> {
  let query = db
    .from("goods_received_notes")
    .select(GRN_SELECT)
    .order("received_date", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  return unwrap(await query) as unknown as GrnWithRefs[];
}

export type GrnDraftLine = {
  purchase_order_line_id: string | null;
  product_id: string;
  quantity_ordered: number;
  quantity_delivered: number;
  quantity_accepted: number;
  quantity_rejected: number;
  unit_cost: number;
  rejection_reason: string | null;
  notes: string | null;
};

/** Creates a GRN against a purchase order, in draft. */
export async function createGrn(input: {
  purchase_order_id: string | null;
  supplier_id: string;
  warehouse_id: string;
  branch_id: string | null;
  received_date: string;
  delivery_note_ref: string | null;
  notes: string | null;
  lines: GrnDraftLine[];
}): Promise<GoodsReceivedNoteRow> {
  const grnNo = await nextNumber("goods_received_note");

  const headers = unwrap(
    await db
      .from("goods_received_notes")
      .insert({
        grn_no: grnNo,
        purchase_order_id: input.purchase_order_id,
        supplier_id: input.supplier_id,
        warehouse_id: input.warehouse_id,
        branch_id: input.branch_id,
        received_date: input.received_date,
        delivery_note_ref: input.delivery_note_ref,
        notes: input.notes,
        status: "draft",
      })
      .select("*"),
  ) as GoodsReceivedNoteRow[];

  const grn = headers[0];
  if (!grn) throw new Error("The goods received note was not created.");

  try {
    unwrap(
      await db
        .from("goods_received_note_lines")
        .insert(
          input.lines.map((line, index) => ({
            grn_id: grn.id,
            line_no: index + 1,
            purchase_order_line_id: line.purchase_order_line_id,
            product_id: line.product_id,
            quantity_ordered: line.quantity_ordered,
            quantity_delivered: line.quantity_delivered,
            quantity_accepted: line.quantity_accepted,
            quantity_rejected: line.quantity_rejected,
            unit_cost: line.unit_cost,
            rejection_reason: line.rejection_reason,
            notes: line.notes,
          })),
        )
        .select("id"),
    );
  } catch (error) {
    await db.from("goods_received_notes").delete().eq("id", grn.id);
    throw error;
  }

  return grn;
}

export async function setGrnStatus(
  id: string,
  status: "inspected" | "approved" | "cancelled",
): Promise<void> {
  const patch: { status: GrnStatus; approved_at?: string } = {
    status,
    ...(status === "approved" ? { approved_at: new Date().toISOString() } : {}),
  };

  const rows = unwrap(
    await db.from("goods_received_notes").update(patch).eq("id", id).select("id"),
  ) as { id: string }[];
  if (rows.length === 0) {
    throw new Error("The GRN status could not be changed. You may not have permission.");
  }
}

/**
 * Posts the GRN. One database call, one transaction: stock moves, the
 * Dr Inventory / Cr Accounts Payable journal is written, the purchase
 * order is updated and the GRN is sealed — or none of it happens.
 */
export async function postGrn(id: string): Promise<string> {
  const { data, error } = await db.rpc("post_goods_received_note", { p_grn_id: id });
  if (error) throw new Error(error.message);
  return data as unknown as string;
}
