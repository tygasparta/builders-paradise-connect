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
