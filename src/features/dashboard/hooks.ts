import { useQuery } from "@tanstack/react-query";

import { db } from "@/lib/supabase";
import { queryKeys } from "@/lib/query-keys";
import type { AuditLogRow } from "@/lib/database.types";

export type OrganisationStats = {
  branches: number;
  warehouses: number;
  locations: number;
  users: number;
  activeUsers: number;
  roles: number;
  auditEvents: number;
};

function countFrom(result: { count: number | null; error: { message: string } | null }): number {
  if (result.error) throw new Error(result.error.message);
  return result.count ?? 0;
}

/**
 * Counts for what Phase 1 actually owns.
 *
 * `head: true` with an exact count returns the number without transferring
 * any rows — these are counters, not lists.
 */
export async function getOrganisationStats(): Promise<OrganisationStats> {
  const head = { count: "exact" as const, head: true };

  const [branches, warehouses, locations, users, activeUsers, roles, auditEvents] =
    await Promise.all([
      db.from("branches").select("*", head).eq("status", "active"),
      db.from("warehouses").select("*", head).eq("status", "active"),
      db.from("warehouse_locations").select("*", head),
      db.from("profiles").select("*", head),
      db.from("profiles").select("*", head).eq("status", "active"),
      db.from("roles").select("*", head),
      db.from("audit_logs").select("*", head),
    ]);

  return {
    branches: countFrom(branches),
    warehouses: countFrom(warehouses),
    locations: countFrom(locations),
    users: countFrom(users),
    activeUsers: countFrom(activeUsers),
    roles: countFrom(roles),
    // Audit is permission-gated; a denied count reads as zero rather than
    // breaking the whole dashboard.
    auditEvents: auditEvents.error ? 0 : (auditEvents.count ?? 0),
  };
}

export function useOrganisationStats() {
  return useQuery({
    queryKey: queryKeys.dashboard.organisation,
    queryFn: getOrganisationStats,
    staleTime: 60_000,
  });
}

export function useRecentActivity(limit = 8) {
  return useQuery({
    queryKey: ["dashboard", "activity", limit] as const,
    queryFn: async (): Promise<AuditLogRow[]> => {
      const { data, error } = await db
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as AuditLogRow[];
    },
    staleTime: 30_000,
    retry: false,
  });
}
