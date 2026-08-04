import { db, unwrap } from "@/lib/supabase";
import type { WarehouseLocationRow, WarehouseRow } from "@/lib/database.types";
import {
  toWarehousePayload,
  type WarehouseFormValues,
  type WarehouseLocationFormValues,
} from "./schema";

/** Warehouse plus the branch name, which every list view needs. */
export type WarehouseWithBranch = WarehouseRow & {
  branch: { id: string; code: string; name: string } | null;
  manager: { id: string; full_name: string } | null;
};

export async function listWarehouses(
  branchId: string | null,
  includeInactive = false,
): Promise<WarehouseWithBranch[]> {
  let query = db
    .from("warehouses")
    .select(
      "*, branch:branches!warehouses_branch_id_fkey(id, code, name), manager:profiles!warehouses_manager_id_fkey(id, full_name)",
    )
    .order("code");

  if (branchId) query = query.eq("branch_id", branchId);
  if (!includeInactive) query = query.eq("status", "active");

  return unwrap(await query) as unknown as WarehouseWithBranch[];
}

export async function createWarehouse(values: WarehouseFormValues): Promise<WarehouseRow> {
  const rows = unwrap(
    await db.from("warehouses").insert(toWarehousePayload(values)).select("*"),
  ) as WarehouseRow[];
  const created = rows[0];
  if (!created) throw new Error("The warehouse was not created.");
  return created;
}

export async function updateWarehouse(
  id: string,
  values: WarehouseFormValues,
): Promise<WarehouseRow> {
  const rows = unwrap(
    await db.from("warehouses").update(toWarehousePayload(values)).eq("id", id).select("*"),
  ) as WarehouseRow[];
  const updated = rows[0];
  if (!updated) {
    throw new Error("The warehouse could not be updated. You may not have permission.");
  }
  return updated;
}

export async function setWarehouseStatus(id: string, status: "active" | "inactive"): Promise<void> {
  unwrap(await db.from("warehouses").update({ status }).eq("id", id).select("id"));
}

export async function listWarehouseLocations(warehouseId: string): Promise<WarehouseLocationRow[]> {
  return unwrap(
    await db.from("warehouse_locations").select("*").eq("warehouse_id", warehouseId).order("code"),
  ) as WarehouseLocationRow[];
}

export async function createWarehouseLocation(
  values: WarehouseLocationFormValues,
): Promise<WarehouseLocationRow> {
  const rows = unwrap(
    await db
      .from("warehouse_locations")
      .insert({
        warehouse_id: values.warehouse_id,
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        type: values.type,
        status: values.status,
      })
      .select("*"),
  ) as WarehouseLocationRow[];
  const created = rows[0];
  if (!created) throw new Error("The location was not created.");
  return created;
}
