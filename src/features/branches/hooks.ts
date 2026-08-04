import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryKeys } from "@/lib/query-keys";
import type { BranchFormValues } from "./schema";
import { createBranch, listBranches, setBranchStatus, updateBranch } from "./api";

export function useBranches(includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.branches.list(includeInactive),
    queryFn: () => listBranches(includeInactive),
    staleTime: 60_000,
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: BranchFormValues) => createBranch(values),
    onSuccess: (branch) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.branches.all });
      toast.success(`Branch "${branch.name}" created`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: BranchFormValues }) =>
      updateBranch(id, values),
    onSuccess: (branch) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.branches.all });
      toast.success(`Branch "${branch.name}" updated`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetBranchStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "inactive" }) =>
      setBranchStatus(id, status),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.branches.all });
      // Deactivating a branch changes which warehouses are reachable.
      void queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
      toast.success(variables.status === "active" ? "Branch reactivated" : "Branch deactivated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
