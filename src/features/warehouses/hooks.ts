import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryKeys } from "@/lib/query-keys";
import type { WarehouseFormValues, WarehouseLocationFormValues } from "./schema";
import {
  createWarehouse,
  createWarehouseLocation,
  listWarehouseLocations,
  listWarehouses,
  setWarehouseStatus,
  updateWarehouse,
} from "./api";

export function useWarehouses(branchId: string | null, includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.warehouses.list(branchId, includeInactive),
    queryFn: () => listWarehouses(branchId, includeInactive),
    staleTime: 60_000,
  });
}

export function useWarehouseLocations(warehouseId: string | null) {
  return useQuery({
    queryKey: queryKeys.warehouses.locations(warehouseId ?? ""),
    queryFn: () => listWarehouseLocations(warehouseId as string),
    enabled: Boolean(warehouseId),
  });
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: WarehouseFormValues) => createWarehouse(values),
    onSuccess: (warehouse) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
      toast.success(`Warehouse "${warehouse.name}" created`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: WarehouseFormValues }) =>
      updateWarehouse(id, values),
    onSuccess: (warehouse) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
      toast.success(`Warehouse "${warehouse.name}" updated`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetWarehouseStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "inactive" }) =>
      setWarehouseStatus(id, status),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
      toast.success(
        variables.status === "active" ? "Warehouse reactivated" : "Warehouse deactivated",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCreateWarehouseLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: WarehouseLocationFormValues) => createWarehouseLocation(values),
    onSuccess: (location) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.warehouses.locations(location.warehouse_id),
      });
      toast.success(`Location "${location.code}" added`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
