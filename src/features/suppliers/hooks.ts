import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { SupplierFormValues } from "./schema";
import {
  createSupplier,
  fetchSupplierActivity,
  listSupplierProducts,
  listSuppliers,
  setSupplierStatus,
  updateSupplier,
} from "./api";

export const supplierKeys = {
  all: ["suppliers"] as const,
  list: (includeInactive: boolean) => ["suppliers", "list", includeInactive] as const,
  products: (id: string) => ["suppliers", "products", id] as const,
};

export function useSuppliers(includeInactive = false) {
  return useQuery({
    queryKey: supplierKeys.list(includeInactive),
    queryFn: () => listSuppliers(includeInactive),
    staleTime: 60_000,
  });
}

export function useSupplierProducts(supplierId: string | null) {
  return useQuery({
    queryKey: supplierKeys.products(supplierId ?? ""),
    queryFn: () => listSupplierProducts(supplierId as string),
    enabled: Boolean(supplierId),
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: SupplierFormValues) => createSupplier(values),
    onSuccess: (supplier) => {
      void queryClient.invalidateQueries({ queryKey: supplierKeys.all });
      toast.success(`Supplier "${supplier.name}" created`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: SupplierFormValues }) =>
      updateSupplier(id, values),
    onSuccess: (supplier) => {
      void queryClient.invalidateQueries({ queryKey: supplierKeys.all });
      toast.success(`Supplier "${supplier.name}" saved`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetSupplierStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "inactive" | "blocked" }) =>
      setSupplierStatus(id, status),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: supplierKeys.all });
      toast.success(
        variables.status === "active"
          ? "Supplier reactivated"
          : variables.status === "blocked"
            ? "Supplier blocked — no new orders can be raised"
            : "Supplier archived",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSupplierActivity(supplierId: string | null) {
  return useQuery({
    queryKey: ["suppliers", "activity", supplierId ?? ""] as const,
    queryFn: () => fetchSupplierActivity(supplierId as string),
    enabled: Boolean(supplierId),
    staleTime: 30_000,
  });
}
