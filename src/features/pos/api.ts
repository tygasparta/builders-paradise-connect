import { db, unwrap } from "@/lib/supabase";
import type { PosSessionRow } from "@/lib/database.types";
import { documentTotals, lineTotals } from "@/lib/document-math";

export type CartLine = {
  product_id: string;
  sku: string;
  name: string;
  uom: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
  available: number;
};

export async function findOpenSession(warehouseId: string): Promise<PosSessionRow | null> {
  const rows = unwrap(
    await db
      .from("pos_sessions")
      .select("*")
      .eq("warehouse_id", warehouseId)
      .eq("status", "open")
      .limit(1),
  ) as PosSessionRow[];
  return rows[0] ?? null;
}

export async function openSession(input: {
  warehouseId: string;
  branchId: string | null;
  openingFloat: number;
}): Promise<string> {
  const { data, error } = await db.rpc("open_pos_session", {
    p_warehouse_id: input.warehouseId,
    p_branch_id: input.branchId,
    p_opening_float: input.openingFloat,
  });
  if (error) throw new Error(error.message);
  return data as unknown as string;
}

export async function closeSession(input: {
  sessionId: string;
  countedCash: number;
  notes: string | null;
}): Promise<number> {
  const { data, error } = await db.rpc("close_pos_session", {
    p_session_id: input.sessionId,
    p_counted_cash: input.countedCash,
    p_notes: input.notes,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

/** Cash takings so far on the open till, for the close-out screen. */
export async function sessionTakings(sessionId: string) {
  const rows = unwrap(
    await db
      .from("sales_invoices")
      .select("total, payment_type, status")
      .eq("pos_session_id", sessionId)
      .in("status", ["posted", "paid", "partially_paid"]),
  ) as { total: number; payment_type: string; status: string }[];

  const cash = rows
    .filter((r) => r.payment_type === "cash")
    .reduce((sum, r) => sum + Number(r.total), 0);
  const credit = rows
    .filter((r) => r.payment_type === "credit")
    .reduce((sum, r) => sum + Number(r.total), 0);

  return { cash, credit, count: rows.length };
}

/** Resolves a scanned or typed code to a product. */
export async function scanProduct(code: string) {
  const { data, error } = await db.rpc("find_product_by_scan", { p_code: code.trim() });
  if (error) throw new Error(error.message);
  return (data ?? [])[0] ?? null;
}

async function nextInvoiceNumber(): Promise<string> {
  const { data, error } = await db.rpc("next_document_number", { p_doc_type: "sales_invoice" });
  if (error) throw new Error(error.message);
  return data as unknown as string;
}

/**
 * Completes a till sale.
 *
 * Creates the invoice, approves it, then posts it. Posting is the same
 * service the Sales screen uses, so a till sale and a counter invoice
 * hit stock, revenue and cost of sales identically — there is no second
 * code path that could drift.
 *
 * If posting fails the invoice is left as an approved draft rather than
 * deleted: the customer may already have paid, and a record of the
 * attempt is worth more than a clean list.
 */
export async function completeSale(input: {
  sessionId: string;
  warehouseId: string;
  branchId: string | null;
  customerId: string | null;
  customerName: string | null;
  paymentType: "cash" | "credit";
  lines: CartLine[];
  notes: string | null;
}): Promise<{ invoiceId: string; invoiceNo: string; total: number }> {
  const totals = documentTotals(
    input.lines.map((l) => ({
      quantity: l.quantity,
      unit_price: l.unit_price,
      discount_percent: l.discount_percent,
      tax_rate: l.tax_rate,
    })),
  );

  const invoiceNo = await nextInvoiceNumber();
  const today = new Date().toISOString().slice(0, 10);

  const headers = unwrap(
    await db
      .from("sales_invoices")
      .insert({
        invoice_no: invoiceNo,
        customer_id: input.customerId,
        customer_name: input.customerId ? null : input.customerName,
        warehouse_id: input.warehouseId,
        branch_id: input.branchId,
        pos_session_id: input.sessionId,
        invoice_date: today,
        due_date: today,
        payment_type: input.paymentType,
        subtotal: totals.subtotal,
        discount_total: totals.discount_total,
        tax_total: totals.tax_total,
        total: totals.total,
        notes: input.notes,
        status: "draft",
      })
      .select("id"),
  ) as { id: string }[];

  const invoice = headers[0];
  if (!invoice) throw new Error("The sale could not be started.");

  try {
    unwrap(
      await db
        .from("sales_invoice_lines")
        .insert(
          input.lines.map((line, index) => ({
            invoice_id: invoice.id,
            line_no: index + 1,
            product_id: line.product_id,
            quantity: line.quantity,
            unit_price: line.unit_price,
            discount_percent: line.discount_percent,
            tax_rate: line.tax_rate,
            line_total: lineTotals({
              quantity: line.quantity,
              unit_price: line.unit_price,
              discount_percent: line.discount_percent,
              tax_rate: line.tax_rate,
            }).total,
          })),
        )
        .select("id"),
    );
  } catch (error) {
    await db.from("sales_invoices").delete().eq("id", invoice.id);
    throw error;
  }

  const approved = unwrap(
    await db
      .from("sales_invoices")
      .update({ status: "approved" })
      .eq("id", invoice.id)
      .select("id"),
  ) as { id: string }[];
  if (approved.length === 0) {
    throw new Error("The sale could not be approved for posting.");
  }

  const { error: postError } = await db.rpc("post_sales_invoice", { p_invoice_id: invoice.id });
  if (postError) throw new Error(postError.message);

  return { invoiceId: invoice.id, invoiceNo, total: totals.total };
}

/** Held sales are simply drafts on this till. */
export async function holdSale(input: Parameters<typeof completeSale>[0]): Promise<string> {
  const totals = documentTotals(
    input.lines.map((l) => ({
      quantity: l.quantity,
      unit_price: l.unit_price,
      discount_percent: l.discount_percent,
      tax_rate: l.tax_rate,
    })),
  );
  const invoiceNo = await nextInvoiceNumber();
  const today = new Date().toISOString().slice(0, 10);

  const headers = unwrap(
    await db
      .from("sales_invoices")
      .insert({
        invoice_no: invoiceNo,
        customer_id: input.customerId,
        customer_name: input.customerId ? null : input.customerName,
        warehouse_id: input.warehouseId,
        branch_id: input.branchId,
        pos_session_id: input.sessionId,
        invoice_date: today,
        payment_type: input.paymentType,
        subtotal: totals.subtotal,
        discount_total: totals.discount_total,
        tax_total: totals.tax_total,
        total: totals.total,
        notes: "Held at till",
        status: "draft",
      })
      .select("id"),
  ) as { id: string }[];

  const invoice = headers[0];
  if (!invoice) throw new Error("The sale could not be held.");

  unwrap(
    await db
      .from("sales_invoice_lines")
      .insert(
        input.lines.map((line, index) => ({
          invoice_id: invoice.id,
          line_no: index + 1,
          product_id: line.product_id,
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_percent: line.discount_percent,
          tax_rate: line.tax_rate,
          line_total: lineTotals({
            quantity: line.quantity,
            unit_price: line.unit_price,
            discount_percent: line.discount_percent,
            tax_rate: line.tax_rate,
          }).total,
        })),
      )
      .select("id"),
  );

  return invoiceNo;
}

export async function listHeldSales(sessionId: string) {
  return unwrap(
    await db
      .from("sales_invoices")
      .select("id, invoice_no, total, customer_name, created_at")
      .eq("pos_session_id", sessionId)
      .eq("status", "draft")
      .order("created_at", { ascending: false }),
  ) as {
    id: string;
    invoice_no: string;
    total: number;
    customer_name: string | null;
    created_at: string;
  }[];
}
