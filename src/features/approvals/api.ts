import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { db, unwrap } from "@/lib/supabase";
import { PERMISSIONS, type PermissionCode } from "@/lib/permissions/catalog";

/**
 * The approvals inbox is a read across modules, not a workflow engine.
 *
 * Every document already carries its own status, its own approve
 * permission and its own posting guard. A separate approvals table would
 * duplicate that state and could drift out of step with the document it
 * claims to describe. So this reads what is pending and acts through
 * each module's existing transition.
 */

export type ApprovalKind =
  "leave" | "requisition" | "purchase_order" | "grn" | "invoice" | "expense" | "payroll";

export type ApprovalItem = {
  id: string;
  kind: ApprovalKind;
  reference: string;
  title: string;
  subtitle: string;
  amount: number | null;
  currency: string | null;
  date: string;
  /** The permission needed to act on this item. */
  permission: PermissionCode;
  /** Where the document lives, for the "open" link. */
  route: string;
};

export type ApprovalSource = {
  kind: ApprovalKind;
  label: string;
  permission: PermissionCode;
  route: string;
  table: string;
  /** Statuses that mean "waiting for someone". */
  pending: string[];
  approvedStatus: string;
  rejectedStatus: string;
};

export const APPROVAL_SOURCES: ApprovalSource[] = [
  {
    kind: "leave",
    label: "Leave requests",
    permission: PERMISSIONS.LEAVE_APPROVE,
    route: "/hr",
    table: "leave_requests",
    pending: ["submitted"],
    approvedStatus: "approved",
    rejectedStatus: "rejected",
  },
  {
    kind: "requisition",
    label: "Requisitions",
    permission: PERMISSIONS.PURCHASE_REQUISITIONS_APPROVE,
    route: "/requisitions",
    table: "purchase_requisitions",
    pending: ["submitted"],
    approvedStatus: "approved",
    rejectedStatus: "rejected",
  },
  {
    kind: "purchase_order",
    label: "Purchase orders",
    permission: PERMISSIONS.PURCHASE_ORDERS_APPROVE,
    route: "/purchases",
    table: "purchase_orders",
    pending: ["pending_approval"],
    approvedStatus: "approved",
    rejectedStatus: "cancelled",
  },
  {
    kind: "grn",
    label: "Goods received",
    permission: PERMISSIONS.GRN_APPROVE,
    route: "/goods-receiving",
    table: "goods_received_notes",
    pending: ["draft", "inspected"],
    approvedStatus: "approved",
    rejectedStatus: "cancelled",
  },
  {
    kind: "invoice",
    label: "Sales invoices",
    permission: PERMISSIONS.SALES_INVOICES_APPROVE,
    route: "/sales",
    table: "sales_invoices",
    pending: ["awaiting_approval"],
    approvedStatus: "approved",
    rejectedStatus: "cancelled",
  },
  {
    kind: "expense",
    label: "Expenses",
    permission: PERMISSIONS.EXPENSES_APPROVE,
    route: "/expenses",
    table: "expenses",
    pending: ["submitted"],
    approvedStatus: "approved",
    rejectedStatus: "rejected",
  },
  {
    kind: "payroll",
    label: "Payroll runs",
    permission: PERMISSIONS.PAYROLL_RUNS_APPROVE,
    route: "/payroll",
    table: "payroll_runs",
    pending: ["calculated"],
    approvedStatus: "approved",
    rejectedStatus: "cancelled",
  },
];

type Row = Record<string, unknown>;

const str = (row: Row, key: string): string => {
  const value = row[key];
  return typeof value === "string" ? value : "";
};
const num = (row: Row, key: string): number | null => {
  const value = row[key];
  return value === null || value === undefined ? null : Number(value);
};

/** Shapes one row from a given table into a common item. */
function toItem(source: ApprovalSource, row: Row): ApprovalItem {
  const base = {
    id: str(row, "id"),
    kind: source.kind,
    permission: source.permission,
    route: source.route,
  };

  switch (source.kind) {
    case "leave": {
      const employee = row["employee"] as Row | null;
      const type = row["leave_type"] as Row | null;
      return {
        ...base,
        reference: str(row, "request_no"),
        title: employee
          ? `${str(employee, "first_name")} ${str(employee, "last_name")}`
          : "Employee",
        subtitle: `${type ? str(type, "name") : "Leave"} · ${num(row, "days") ?? 0} days`,
        amount: null,
        currency: null,
        date: str(row, "start_date"),
      };
    }
    case "requisition": {
      const requester = row["requester"] as Row | null;
      return {
        ...base,
        reference: str(row, "requisition_no"),
        title: requester ? str(requester, "full_name") : "Requisition",
        subtitle: str(row, "reason") || "Stock request",
        amount: null,
        currency: null,
        date: str(row, "created_at").slice(0, 10),
      };
    }
    case "purchase_order": {
      const supplier = row["supplier"] as Row | null;
      return {
        ...base,
        reference: str(row, "po_no"),
        title: supplier ? str(supplier, "name") : "Supplier",
        subtitle: "Purchase order",
        amount: num(row, "total"),
        currency: str(row, "currency_code") || null,
        date: str(row, "order_date"),
      };
    }
    case "grn": {
      const supplier = row["supplier"] as Row | null;
      return {
        ...base,
        reference: str(row, "grn_no"),
        title: supplier ? str(supplier, "name") : "Supplier",
        subtitle: `Delivery ${str(row, "delivery_note_ref") || "received"}`,
        amount: num(row, "total_cost"),
        currency: null,
        date: str(row, "received_date"),
      };
    }
    case "invoice": {
      const customer = row["customer"] as Row | null;
      return {
        ...base,
        reference: str(row, "invoice_no"),
        title: customer ? str(customer, "name") : "Customer",
        subtitle: "Sales invoice",
        amount: num(row, "total"),
        currency: null,
        date: str(row, "invoice_date"),
      };
    }
    case "expense": {
      const category = row["category"] as Row | null;
      return {
        ...base,
        reference: str(row, "expense_no"),
        title: str(row, "description"),
        subtitle: category ? str(category, "name") : "Expense",
        amount: num(row, "total"),
        currency: null,
        date: str(row, "expense_date"),
      };
    }
    case "payroll": {
      const period = row["period"] as Row | null;
      return {
        ...base,
        reference: str(row, "run_no"),
        title: period ? str(period, "name") : "Payroll run",
        subtitle: `${num(row, "employee_count") ?? 0} employees · net pay`,
        amount: num(row, "total_net"),
        currency: null,
        date: str(row, "created_at").slice(0, 10),
      };
    }
  }
}

const SELECTS: Record<ApprovalKind, string> = {
  leave: `id, request_no, start_date, days, status,
          employee:employees!leave_requests_employee_id_fkey(first_name, last_name),
          leave_type:leave_types!leave_requests_leave_type_id_fkey(name)`,
  requisition: `id, requisition_no, created_at, reason, status,
          requester:profiles!purchase_requisitions_requested_by_fkey(full_name)`,
  purchase_order: `id, po_no, order_date, total, currency_code, status,
          supplier:suppliers!purchase_orders_supplier_id_fkey(name)`,
  grn: `id, grn_no, received_date, total_cost, delivery_note_ref, status,
          supplier:suppliers!goods_received_notes_supplier_id_fkey(name)`,
  invoice: `id, invoice_no, invoice_date, total, status,
          customer:customers!sales_invoices_customer_id_fkey(name)`,
  expense: `id, expense_no, expense_date, total, description, status,
          category:expense_categories!expenses_category_id_fkey(name)`,
  payroll: `id, run_no, created_at, total_net, employee_count, status,
          period:payroll_periods!payroll_runs_period_id_fkey(name)`,
};

export async function fetchPending(source: ApprovalSource): Promise<ApprovalItem[]> {
  const rows = unwrap(
    await db
      .from(source.table as "expenses")
      .select(SELECTS[source.kind])
      .in("status", source.pending as never[])
      .limit(100),
  ) as unknown as Row[];
  return rows.map((row) => toItem(source, row));
}

export async function decide(source: ApprovalSource, id: string, approve: boolean): Promise<void> {
  const status = approve ? source.approvedStatus : source.rejectedStatus;
  const patch: Row = { status };
  if (approve && source.kind !== "grn") patch["approved_at"] = new Date().toISOString();

  const rows = unwrap(
    await db
      .from(source.table as "expenses")
      .update(patch as never)
      .eq("id", id)
      .select("id"),
  ) as { id: string }[];

  if (rows.length === 0) {
    throw new Error("Nothing was updated. You may not have permission to act on this.");
  }
}

// ---------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------

export const approvalKeys = {
  all: ["approvals"] as const,
  source: (kind: string) => ["approvals", kind] as const,
};

/**
 * One query per source, so a module the user cannot see fails alone
 * rather than emptying the whole inbox.
 */
export function usePendingApprovals(sources: ApprovalSource[]) {
  return useQueries({
    queries: sources.map((source) => ({
      queryKey: approvalKeys.source(source.kind),
      queryFn: () => fetchPending(source),
      staleTime: 30_000,
    })),
  });
}

export function useDecide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      source,
      id,
      approve,
    }: {
      source: ApprovalSource;
      id: string;
      approve: boolean;
    }) => decide(source, id, approve),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: approvalKeys.all });
      // The document's own module shows it too.
      void queryClient.invalidateQueries({ queryKey: [variables.source.kind] });
      for (const key of ["purchasing", "sales", "finance", "hr", "payroll", "requisitions"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast.success(variables.approve ? "Approved" : "Rejected");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * How many items wait on this person, for the sidebar badge.
 *
 * Counts only — head: true asks Postgres for the number without
 * returning rows, so this stays cheap enough to run on every page.
 */
export async function fetchPendingCount(sources: ApprovalSource[]): Promise<number> {
  if (sources.length === 0) return 0;

  const counts = await Promise.all(
    sources.map(async (source) => {
      const { count, error } = await db
        .from(source.table as "expenses")
        .select("id", { count: "exact", head: true })
        .in("status", source.pending as never[]);
      // A source the user cannot read counts as nothing, rather than
      // failing the badge for every other source.
      if (error) return 0;
      return count ?? 0;
    }),
  );

  return counts.reduce((sum, count) => sum + count, 0);
}

export function usePendingApprovalCount(sources: ApprovalSource[]) {
  return useQuery({
    queryKey: [...approvalKeys.all, "count", sources.map((s) => s.kind).join(",")],
    queryFn: () => fetchPendingCount(sources),
    enabled: sources.length > 0,
    staleTime: 60_000,
  });
}
