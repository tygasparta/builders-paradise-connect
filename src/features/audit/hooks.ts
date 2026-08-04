import { useQuery } from "@tanstack/react-query";

import { db, unwrap } from "@/lib/supabase";
import type { AuditLogRow } from "@/lib/database.types";
import { queryKeys } from "@/lib/query-keys";

export type AuditFilters = {
  module?: string;
  action?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export type AuditPage = { rows: AuditLogRow[]; total: number };

/**
 * Audit rows are paged on the server — this table grows without bound and
 * must never be pulled into the browser wholesale.
 */
export async function listAuditLogs(filters: AuditFilters): Promise<AuditPage> {
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? 25;
  const from = page * pageSize;

  let query = db
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (filters.module) query = query.eq("module", filters.module);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);
  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(`user_email.ilike.${term},table_name.ilike.${term},record_id.ilike.${term}`);
  }

  const result = await query;
  const rows = unwrap(result) as AuditLogRow[];
  return { rows, total: result.count ?? rows.length };
}

export function useAuditLogs(filters: AuditFilters) {
  return useQuery({
    queryKey: queryKeys.audit.list(filters as Record<string, unknown>),
    queryFn: () => listAuditLogs(filters),
    // Keeps the table on screen while a new page loads instead of flashing.
    placeholderData: (previous) => previous,
  });
}

export function useUnreadNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications.unread,
    queryFn: async () => {
      const result = await db
        .from("notifications")
        .select("*", { count: "exact" })
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(10);
      return { rows: unwrap(result), total: result.count ?? 0 };
    },
    staleTime: 60_000,
  });
}
