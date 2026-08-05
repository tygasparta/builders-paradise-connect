import { db, unwrap } from "@/lib/supabase";
import type {
  InvoiceStatus,
  QuotationStatus,
  SalesInvoiceRow,
  SalesQuotationRow,
  SalesReturnRow,
  SalesReturnStatus,
} from "@/lib/database.types";
import { documentTotals, lineTotals, type SalesDocumentValues } from "./schema";

type LineWithProduct = {
  id: string;
  line_no: number;
  product_id: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
  line_total: number;
  unit_cost?: number;
  line_cost?: number;
  product: { sku: string; name: string; uom: { code: string } | null } | null;
};

export type InvoiceWithRefs = SalesInvoiceRow & {
  customer: { id: string; name: string; code: string } | null;
  warehouse: { id: string; name: string; code: string } | null;
  sales_invoice_lines: LineWithProduct[];
};

export type QuotationWithRefs = SalesQuotationRow & {
  customer: { id: string; name: string; code: string } | null;
  sales_quotation_lines: LineWithProduct[];
};

export type ReturnWithRefs = SalesReturnRow & {
  customer: { id: string; name: string; code: string } | null;
  invoice: { id: string; invoice_no: string } | null;
  sales_return_lines: {
    id: string;
    line_no: number;
    product_id: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    line_total: number;
    product: { sku: string; name: string } | null;
  }[];
};

// Annotated as string: supabase-js parses a select literal at the type
// level, and this nesting depth makes inference explode.
const INVOICE_SELECT: string = `
  *,
  customer:customers!sales_invoices_customer_id_fkey(id, name, code),
  warehouse:warehouses!sales_invoices_warehouse_id_fkey(id, name, code),
  sales_invoice_lines(
    *, product:products!sales_invoice_lines_product_id_fkey(
      sku, name, uom:units_of_measure!products_uom_id_fkey(code))
  )
`;

const QUOTE_SELECT: string = `
  *,
  customer:customers!sales_quotations_customer_id_fkey(id, name, code),
  sales_quotation_lines(
    *, product:products!sales_quotation_lines_product_id_fkey(
      sku, name, uom:units_of_measure!products_uom_id_fkey(code))
  )
`;

const RETURN_SELECT: string = `
  *,
  customer:customers!sales_returns_customer_id_fkey(id, name, code),
  invoice:sales_invoices!sales_returns_invoice_id_fkey(id, invoice_no),
  sales_return_lines(
    *, product:products!sales_return_lines_product_id_fkey(sku, name)
  )
`;

async function nextNumber(docType: string): Promise<string> {
  const { data, error } = await db.rpc("next_document_number", { p_doc_type: docType });
  if (error) throw new Error(error.message);
  return data as unknown as string;
}

export async function listInvoices(status: InvoiceStatus | null): Promise<InvoiceWithRefs[]> {
  let query = db
    .from("sales_invoices")
    .select(INVOICE_SELECT)
    .order("invoice_date", { ascending: false });
  if (status) query = query.eq("status", status);
  return unwrap(await query) as unknown as InvoiceWithRefs[];
}

export async function listQuotations(status: QuotationStatus | null): Promise<QuotationWithRefs[]> {
  let query = db
    .from("sales_quotations")
    .select(QUOTE_SELECT)
    .order("quotation_date", { ascending: false });
  if (status) query = query.eq("status", status);
  return unwrap(await query) as unknown as QuotationWithRefs[];
}

export async function listReturns(status: SalesReturnStatus | null): Promise<ReturnWithRefs[]> {
  let query = db
    .from("sales_returns")
    .select(RETURN_SELECT)
    .order("return_date", { ascending: false });
  if (status) query = query.eq("status", status);
  return unwrap(await query) as unknown as ReturnWithRefs[];
}

/**
 * Creates an invoice or a quotation with its lines.
 *
 * Header first, then lines; the header is removed if the lines fail. A
 * draft has moved no stock and no money, so nothing is lost — whereas a
 * header with no lines would sit in the list looking like a real document.
 */
export async function createSalesDocument(
  values: SalesDocumentValues,
): Promise<{ id: string; number: string }> {
  const totals = documentTotals(values.lines);
  const isInvoice = values.kind === "invoice";

  const number = await nextNumber(isInvoice ? "sales_invoice" : "sales_quotation");
  const table = isInvoice ? "sales_invoices" : "sales_quotations";
  const lineTable = isInvoice ? "sales_invoice_lines" : "sales_quotation_lines";

  const header = isInvoice
    ? {
        invoice_no: number,
        customer_id: values.customer_id,
        customer_name: values.customer_id ? null : (values.customer_name ?? null),
        warehouse_id: values.warehouse_id,
        branch_id: values.branch_id,
        invoice_date: values.document_date,
        due_date: values.due_date || null,
        payment_type: values.payment_type,
        currency_code: values.currency_code.toUpperCase(),
        subtotal: totals.subtotal,
        discount_total: totals.discount_total,
        tax_total: totals.tax_total,
        total: totals.total,
        notes: values.notes?.trim() || null,
        status: "draft",
      }
    : {
        quotation_no: number,
        customer_id: values.customer_id,
        customer_name: values.customer_id ? null : (values.customer_name ?? null),
        warehouse_id: values.warehouse_id,
        branch_id: values.branch_id,
        quotation_date: values.document_date,
        valid_until: values.valid_until || null,
        currency_code: values.currency_code.toUpperCase(),
        subtotal: totals.subtotal,
        discount_total: totals.discount_total,
        tax_total: totals.tax_total,
        total: totals.total,
        notes: values.notes?.trim() || null,
        status: "draft",
      };

  const rows = unwrap(
    await db
      .from(table as "sales_invoices")
      .insert(header as never)
      .select("id"),
  ) as { id: string }[];
  const created = rows[0];
  if (!created) throw new Error("The document was not created.");

  try {
    unwrap(
      await db
        .from(lineTable as "sales_invoice_lines")
        .insert(
          values.lines.map((line, index) => ({
            ...(isInvoice ? { invoice_id: created.id } : { quotation_id: created.id }),
            line_no: index + 1,
            product_id: line.product_id,
            description: line.description?.trim() || null,
            quantity: line.quantity,
            unit_price: line.unit_price,
            discount_percent: line.discount_percent,
            tax_rate: line.tax_rate,
            line_total: lineTotals(line).total,
          })) as never,
        )
        .select("id"),
    );
  } catch (error) {
    await db
      .from(table as "sales_invoices")
      .delete()
      .eq("id", created.id);
    throw error;
  }

  return { id: created.id, number };
}

export async function setInvoiceStatus(id: string, status: InvoiceStatus): Promise<void> {
  const rows = unwrap(
    await db.from("sales_invoices").update({ status }).eq("id", id).select("id"),
  ) as { id: string }[];
  if (rows.length === 0) {
    throw new Error("The invoice status could not be changed. You may not have permission.");
  }
}

export async function setQuotationStatus(id: string, status: QuotationStatus): Promise<void> {
  const rows = unwrap(
    await db.from("sales_quotations").update({ status }).eq("id", id).select("id"),
  ) as { id: string }[];
  if (rows.length === 0) {
    throw new Error("The quotation status could not be changed. You may not have permission.");
  }
}

export async function setReturnStatus(id: string, status: SalesReturnStatus): Promise<void> {
  const rows = unwrap(
    await db.from("sales_returns").update({ status }).eq("id", id).select("id"),
  ) as { id: string }[];
  if (rows.length === 0) {
    throw new Error("The return status could not be changed. You may not have permission.");
  }
}

/** Posts the invoice: stock out, revenue and cost of sales, in one transaction. */
export async function postInvoice(id: string): Promise<string> {
  const { data, error } = await db.rpc("post_sales_invoice", { p_invoice_id: id });
  if (error) throw new Error(error.message);
  return data as unknown as string;
}

export async function postReturn(id: string): Promise<string> {
  const { data, error } = await db.rpc("post_sales_return", { p_return_id: id });
  if (error) throw new Error(error.message);
  return data as unknown as string;
}

/** Raises a credit note against a posted invoice. */
export async function createReturn(input: {
  invoice: InvoiceWithRefs;
  reason: string;
  restock: boolean;
  notes: string | null;
  lines: {
    invoice_line_id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
  }[];
}): Promise<{ id: string; number: string }> {
  const number = await nextNumber("sales_return");

  const subtotal = input.lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
  const tax = input.lines.reduce(
    (sum, l) => sum + l.quantity * l.unit_price * (l.tax_rate / 100),
    0,
  );

  const rows = unwrap(
    await db
      .from("sales_returns")
      .insert({
        return_no: number,
        invoice_id: input.invoice.id,
        customer_id: input.invoice.customer_id,
        customer_name: input.invoice.customer_name,
        branch_id: input.invoice.branch_id,
        warehouse_id: input.invoice.warehouse_id,
        reason: input.reason,
        restock: input.restock,
        subtotal: Math.round(subtotal * 1e4) / 1e4,
        tax_total: Math.round(tax * 1e4) / 1e4,
        total: Math.round((subtotal + tax) * 1e4) / 1e4,
        notes: input.notes,
        status: "draft",
      })
      .select("id"),
  ) as { id: string }[];

  const created = rows[0];
  if (!created) throw new Error("The credit note was not created.");

  try {
    unwrap(
      await db
        .from("sales_return_lines")
        .insert(
          input.lines.map((line, index) => ({
            return_id: created.id,
            line_no: index + 1,
            invoice_line_id: line.invoice_line_id,
            product_id: line.product_id,
            quantity: line.quantity,
            unit_price: line.unit_price,
            tax_rate: line.tax_rate,
            line_total:
              Math.round(line.quantity * line.unit_price * (1 + line.tax_rate / 100) * 1e4) / 1e4,
          })),
        )
        .select("id"),
    );
  } catch (error) {
    await db.from("sales_returns").delete().eq("id", created.id);
    throw error;
  }

  return { id: created.id, number };
}
