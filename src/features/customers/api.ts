import { db, unwrap } from "@/lib/supabase";
import type { CustomerRow } from "@/lib/database.types";
import { toCustomerPayload, type CustomerFormValues } from "./schema";

export async function listCustomers(includeInactive = false): Promise<CustomerRow[]> {
  let query = db.from("customers").select("*").order("name");
  if (!includeInactive) query = query.eq("status", "active");
  return unwrap(await query) as CustomerRow[];
}

export async function createCustomer(values: CustomerFormValues): Promise<CustomerRow> {
  const rows = unwrap(
    await db.from("customers").insert(toCustomerPayload(values)).select("*"),
  ) as CustomerRow[];
  const created = rows[0];
  if (!created) throw new Error("The customer was not created.");
  return created;
}

export async function updateCustomer(id: string, values: CustomerFormValues): Promise<CustomerRow> {
  const rows = unwrap(
    await db.from("customers").update(toCustomerPayload(values)).eq("id", id).select("*"),
  ) as CustomerRow[];
  const updated = rows[0];
  if (!updated) throw new Error("The customer could not be saved. You may not have permission.");
  return updated;
}

export async function setCustomerStatus(
  id: string,
  status: "active" | "inactive" | "on_hold",
): Promise<void> {
  const rows = unwrap(await db.from("customers").update({ status }).eq("id", id).select("id")) as {
    id: string;
  }[];
  if (rows.length === 0) {
    throw new Error("The customer status could not be changed. You may not have permission.");
  }
}

/**
 * Live balances for a set of customers.
 *
 * customer_balance() is derived from the documents rather than stored, so
 * it is asked for per customer. Requested in parallel and only for the
 * rows on screen.
 */
export async function fetchBalances(customerIds: string[]): Promise<Map<string, number>> {
  const entries = await Promise.all(
    customerIds.map(async (id) => {
      const { data, error } = await db.rpc("customer_balance", { p_customer_id: id });
      if (error) return [id, 0] as const;
      return [id, Number(data ?? 0)] as const;
    }),
  );
  return new Map(entries);
}

// ---------------------------------------------------------------------
// Account activity — what a customer detail view needs
// ---------------------------------------------------------------------

export type CustomerInvoiceRow = {
  id: string;
  invoice_no: string;
  invoice_date: string;
  due_date: string | null;
  total: number;
  amount_paid: number;
  status: string;
  payment_type: string;
};

export type CustomerReceiptSummary = {
  id: string;
  receipt_no: string;
  receipt_date: string;
  payment_method: string;
  reference: string | null;
  amount: number;
  status: string;
};

export type CustomerCreditNote = {
  id: string;
  return_no: string;
  return_date: string;
  reason: string;
  total: number;
  status: string;
};

export type CustomerActivity = {
  invoices: CustomerInvoiceRow[];
  receipts: CustomerReceiptSummary[];
  creditNotes: CustomerCreditNote[];
};

/**
 * Everything on one customer's account.
 *
 * Three parallel reads rather than one nested select: they are unrelated
 * tables, and a nested select of this depth makes supabase-js's type
 * inference explode.
 */
export async function fetchCustomerActivity(customerId: string): Promise<CustomerActivity> {
  const [invoices, receipts, creditNotes] = await Promise.all([
    db
      .from("sales_invoices")
      .select("id, invoice_no, invoice_date, due_date, total, amount_paid, status, payment_type")
      .eq("customer_id", customerId)
      .order("invoice_date", { ascending: false }),
    db
      .from("customer_receipts")
      .select("id, receipt_no, receipt_date, payment_method, reference, amount, status")
      .eq("customer_id", customerId)
      .order("receipt_date", { ascending: false }),
    db
      .from("sales_returns")
      .select("id, return_no, return_date, reason, total, status")
      .eq("customer_id", customerId)
      .order("return_date", { ascending: false }),
  ]);

  return {
    invoices: unwrap(invoices) as unknown as CustomerInvoiceRow[],
    receipts: unwrap(receipts) as unknown as CustomerReceiptSummary[],
    creditNotes: unwrap(creditNotes) as unknown as CustomerCreditNote[],
  };
}
