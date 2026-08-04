import { db, unwrap, unwrapMaybe } from "@/lib/supabase";
import type { BranchRow } from "@/lib/database.types";
import { toBranchPayload, type BranchFormValues } from "./schema";

export async function listBranches(includeInactive = false): Promise<BranchRow[]> {
  let query = db.from("branches").select("*").order("is_head_office", { ascending: false }).order("name");
  if (!includeInactive) {
    query = query.eq("status", "active");
  }
  return unwrap(await query) as BranchRow[];
}

export async function getBranch(id: string): Promise<BranchRow | null> {
  return unwrapMaybe(await db.from("branches").select("*").eq("id", id).maybeSingle()) as BranchRow | null;
}

export async function createBranch(values: BranchFormValues): Promise<BranchRow> {
  const rows = unwrap(
    await db.from("branches").insert(toBranchPayload(values)).select("*"),
  ) as BranchRow[];
  const created = rows[0];
  if (!created) throw new Error("The branch was not created.");
  return created;
}

export async function updateBranch(id: string, values: BranchFormValues): Promise<BranchRow> {
  const rows = unwrap(
    await db.from("branches").update(toBranchPayload(values)).eq("id", id).select("*"),
  ) as BranchRow[];
  const updated = rows[0];
  if (!updated) {
    // RLS returns an empty set rather than an error when the row is
    // invisible or the write is refused.
    throw new Error("The branch could not be updated. You may not have permission.");
  }
  return updated;
}

/** Branches are never deleted — history references them. */
export async function setBranchStatus(id: string, status: "active" | "inactive"): Promise<void> {
  unwrap(await db.from("branches").update({ status }).eq("id", id).select("id"));
}
