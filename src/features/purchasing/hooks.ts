import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { GrnStatus, PurchaseOrderRow, PurchaseOrderStatus } from "@/lib/database.types";
import type { PurchaseOrderFormValues } from "./schema";
import {
  createGrn,
  createPurchaseOrder,
  listGrns,
  listPurchaseOrders,
  postGrn,
  setGrnStatus,
  setPurchaseOrderStatus,
  updatePurchaseOrder,
} from "./api";

export const purchasingKeys = {
  all: ["purchasing"] as const,
  orders: (filters: Record<string, unknown>) => ["purchasing", "orders", filters] as const,
  grns: (filters: Record<string, unknown>) => ["purchasing", "grns", filters] as const,
};

export function usePurchaseOrders(filters: {
  status?: PurchaseOrderStatus | null;
  supplierId?: string | null;
}) {
  return useQuery({
    queryKey: purchasingKeys.orders(filters),
    queryFn: () => listPurchaseOrders(filters),
    staleTime: 30_000,
  });
}

export function useGrns(filters: { status?: GrnStatus | null }) {
  return useQuery({
    queryKey: purchasingKeys.grns(filters),
    queryFn: () => listGrns(filters),
    staleTime: 30_000,
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: PurchaseOrderFormValues) => createPurchaseOrder(values),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: purchasingKeys.all });
      toast.success(`Purchase order ${order.po_no} created`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: PurchaseOrderFormValues }) =>
      updatePurchaseOrder(id, values),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: purchasingKeys.all });
      toast.success(`${order.po_no} saved`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetPurchaseOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: PurchaseOrderRow["status"];
      reason?: string;
    }) => setPurchaseOrderStatus(id, status, reason ? { cancelled_reason: reason } : {}),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: purchasingKeys.all });
      const labels: Record<string, string> = {
        pending_approval: "Sent for approval",
        approved: "Purchase order approved",
        cancelled: "Purchase order cancelled",
        closed: "Purchase order closed",
      };
      toast.success(labels[variables.status] ?? "Purchase order updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCreateGrn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createGrn,
    onSuccess: (grn) => {
      void queryClient.invalidateQueries({ queryKey: purchasingKeys.all });
      toast.success(`${grn.grn_no} created — inspect and approve it before posting`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetGrnStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "inspected" | "approved" | "cancelled" }) =>
      setGrnStatus(id, status),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: purchasingKeys.all });
      const labels = {
        inspected: "Marked inspected",
        approved: "GRN approved — it can now be posted",
        cancelled: "GRN cancelled",
      };
      toast.success(labels[variables.status]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function usePostGrn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => postGrn(id),
    onSuccess: () => {
      // Posting moves stock, the ledger and the purchase order at once.
      void queryClient.invalidateQueries({ queryKey: purchasingKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Posted — stock and the ledger have both been updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
