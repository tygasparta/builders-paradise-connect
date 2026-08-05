import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { CustomerFormValues } from "./schema";
import {
  createCustomer,
  fetchBalances,
  listCustomers,
  setCustomerStatus,
  updateCustomer,
} from "./api";

export const customerKeys = {
  all: ["customers"] as const,
  list: (includeInactive: boolean) => ["customers", "list", includeInactive] as const,
  balances: (ids: string[]) => ["customers", "balances", ids.join(",")] as const,
};

export function useCustomers(includeInactive = false) {
  return useQuery({
    queryKey: customerKeys.list(includeInactive),
    queryFn: () => listCustomers(includeInactive),
    staleTime: 60_000,
  });
}

export function useCustomerBalances(customerIds: string[]) {
  return useQuery({
    queryKey: customerKeys.balances(customerIds),
    queryFn: () => fetchBalances(customerIds),
    enabled: customerIds.length > 0,
    staleTime: 30_000,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CustomerFormValues) => createCustomer(values),
    onSuccess: (customer) => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.all });
      toast.success(`Customer "${customer.name}" created`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: CustomerFormValues }) =>
      updateCustomer(id, values),
    onSuccess: (customer) => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.all });
      toast.success(`Customer "${customer.name}" saved`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetCustomerStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "inactive" | "on_hold" }) =>
      setCustomerStatus(id, status),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.all });
      toast.success(
        variables.status === "active"
          ? "Customer reactivated"
          : variables.status === "on_hold"
            ? "Customer placed on hold — no new credit sales"
            : "Customer archived",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
