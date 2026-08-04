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

export type RoleDistribution = { role: string; count: number };
export type WarehouseDistribution = { branch: string; warehouses: number; locations: number };

/**
 * How many users hold each role.
 *
 * Aggregated in the browser rather than in SQL because the row count is
 * bounded by headcount — a few hundred at most. Anything unbounded (stock
 * movements, invoices) gets a database-side aggregate instead.
 */
export function useUsersByRole() {
  return useQuery({
    queryKey: ["dashboard", "usersByRole"] as const,
    queryFn: async (): Promise<RoleDistribution[]> => {
      const { data, error } = await db.from("user_roles").select("role:roles(name, rank)");
      if (error) throw new Error(error.message);

      const rows = (data ?? []) as unknown as { role: { name: string; rank: number } | null }[];
      const counts = new Map<string, { count: number; rank: number }>();
      for (const row of rows) {
        if (!row.role) continue;
        const existing = counts.get(row.role.name);
        counts.set(row.role.name, {
          count: (existing?.count ?? 0) + 1,
          rank: row.role.rank,
        });
      }
      return [...counts.entries()]
        .map(([role, meta]) => ({ role, count: meta.count, rank: meta.rank }))
        .sort((a, b) => a.rank - b.rank || b.count - a.count)
        .map(({ role, count }) => ({ role, count }));
    },
    staleTime: 60_000,
  });
}

/** Warehouses and storage locations per branch, for the coverage chart. */
export function useWarehousesByBranch() {
  return useQuery({
    queryKey: ["dashboard", "warehousesByBranch"] as const,
    queryFn: async (): Promise<WarehouseDistribution[]> => {
      const [warehouseResult, locationResult] = await Promise.all([
        db.from("warehouses").select("id, branch:branches(name)").eq("status", "active"),
        db.from("warehouse_locations").select("warehouse_id").eq("status", "active"),
      ]);

      if (warehouseResult.error) throw new Error(warehouseResult.error.message);
      if (locationResult.error) throw new Error(locationResult.error.message);

      const warehouses = (warehouseResult.data ?? []) as unknown as {
        id: string;
        branch: { name: string } | null;
      }[];
      const locations = (locationResult.data ?? []) as { warehouse_id: string }[];

      const locationsPerWarehouse = new Map<string, number>();
      for (const location of locations) {
        locationsPerWarehouse.set(
          location.warehouse_id,
          (locationsPerWarehouse.get(location.warehouse_id) ?? 0) + 1,
        );
      }

      const byBranch = new Map<string, { warehouses: number; locations: number }>();
      for (const warehouse of warehouses) {
        const name = warehouse.branch?.name ?? "Unassigned";
        const existing = byBranch.get(name) ?? { warehouses: 0, locations: 0 };
        byBranch.set(name, {
          warehouses: existing.warehouses + 1,
          locations: existing.locations + (locationsPerWarehouse.get(warehouse.id) ?? 0),
        });
      }

      return [...byBranch.entries()]
        .map(([branch, counts]) => ({ branch, ...counts }))
        .sort((a, b) => b.warehouses - a.warehouses);
    },
    staleTime: 60_000,
  });
}
