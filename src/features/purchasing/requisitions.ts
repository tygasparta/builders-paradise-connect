import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { db, unwrap } from "@/lib/supabase";
import type { PurchaseRequisitionRow, RequisitionStatus } from "@/lib/database.types";

export type RequisitionWithRefs = PurchaseRequisitionRow & {
  warehouse: { id: string; name: string; code: string } | null;
  requester: { full_name: string } | null;
  purchase_requisition_lines: {
    id: string;
    line_no: number;
    product_id: string;
    quantity: number;
    estimated_unit_price: number;
    notes: string | null;
    product: { sku: string; name: string; uom: { code: string } | null } | null;
  }[];
};

// Annotated as string so supabase-js does not parse the literal at the
// type level — this nesting depth makes inference explode.
const REQ_SELECT: string = `
  *,
  warehouse:warehouses!purchase_requisitions_warehouse_id_fkey(id, name, code),
  requester:profiles!purchase_requisitions_requested_by_fkey(full_name),
  purchase_requisition_lines(
    *, product:products!purchase_requisition_lines_product_id_fkey(
      sku, name, uom:units_of_measure!products_uom_id_fkey(code))
  )
`;

export async function listRequisitions(
  status: RequisitionStatus | null,
): Promise<RequisitionWithRefs[]> {
  let query = db
    .from("purchase_requisitions")
    .select(REQ_SELECT)
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  return unwrap(await query) as unknown as RequisitionWithRefs[];
}

export type RequisitionInput = {
  warehouse_id: string | null;
  branch_id: string | null;
  department: string | null;
  required_date: string | null;
  reason: string | null;
  notes: string | null;
  lines: {
    product_id: string;
    quantity: number;
    estimated_unit_price: number;
    notes: string | null;
  }[];
};

export async function createRequisition(input: RequisitionInput): Promise<string> {
  const { data: number, error: numberError } = await db.rpc("next_document_number", {
    p_doc_type: "purchase_requisition",
  });
  if (numberError) throw new Error(numberError.message);

  const { data: session } = await db.auth.getUser();

  const rows = unwrap(
    await db
      .from("purchase_requisitions")
      .insert({
        requisition_no: number as unknown as string,
        warehouse_id: input.warehouse_id,
        branch_id: input.branch_id,
        requested_by: session.user?.id ?? null,
        department: input.department,
        required_date: input.required_date,
        reason: input.reason,
        notes: input.notes,
        status: "draft",
      })
      .select("id"),
  ) as { id: string }[];

  const created = rows[0];
  if (!created) throw new Error("The requisition was not created.");

  try {
    unwrap(
      await db
        .from("purchase_requisition_lines")
        .insert(
          input.lines.map((line, index) => ({
            requisition_id: created.id,
            line_no: index + 1,
            product_id: line.product_id,
            quantity: line.quantity,
            estimated_unit_price: line.estimated_unit_price,
            notes: line.notes,
          })),
        )
        .select("id"),
    );
  } catch (error) {
    // A requisition with no lines would sit in the list looking real.
    await db.from("purchase_requisitions").delete().eq("id", created.id);
    throw error;
  }

  return number as unknown as string;
}

export async function setRequisitionStatus(
  id: string,
  status: RequisitionStatus,
  rejectedReason?: string,
): Promise<void> {
  const now = new Date().toISOString();
  // The Update type excludes id and the stamped columns; match it so the
  // client cannot try to rewrite them.
  const patch: Partial<
    Omit<PurchaseRequisitionRow, "id" | "created_at" | "updated_at" | "created_by" | "updated_by">
  > = {
    status,
    ...(status === "submitted" ? { submitted_at: now } : {}),
    ...(status === "approved" ? { approved_at: now } : {}),
    ...(status === "rejected" && rejectedReason ? { rejected_reason: rejectedReason } : {}),
  };

  const rows = unwrap(
    await db.from("purchase_requisitions").update(patch).eq("id", id).select("id"),
  ) as { id: string }[];
  if (rows.length === 0) {
    throw new Error("The requisition could not be updated. You may not have permission.");
  }
}

// ---------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------

export const requisitionKeys = {
  all: ["requisitions"] as const,
  list: (status: string | null) => ["requisitions", "list", status ?? "all"] as const,
};

export function useRequisitions(status: RequisitionStatus | null) {
  return useQuery({
    queryKey: requisitionKeys.list(status),
    queryFn: () => listRequisitions(status),
    staleTime: 30_000,
  });
}

export function useCreateRequisition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createRequisition,
    onSuccess: (number) => {
      void queryClient.invalidateQueries({ queryKey: requisitionKeys.all });
      toast.success(`${number} created — submit it for approval`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetRequisitionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: RequisitionStatus;
      reason?: string;
    }) => setRequisitionStatus(id, status, reason),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: requisitionKeys.all });
      const labels: Record<string, string> = {
        submitted: "Sent for approval",
        approved: "Requisition approved — it can now be turned into an order",
        rejected: "Requisition rejected",
        cancelled: "Requisition cancelled",
        converted: "Marked as converted",
      };
      toast.success(labels[variables.status] ?? "Requisition updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export const REQUISITION_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  converted: "Converted",
  cancelled: "Cancelled",
};
