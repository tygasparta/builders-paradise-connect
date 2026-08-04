import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  listMovements,
  listStockOnHand,
  postAdjustment,
  type AdjustmentInput,
  type MovementFilters,
} from "./api";

export const inventoryKeys = {
  all: ["inventory"] as const,
  stock: (filters: Record<string, unknown>) => ["inventory", "stock", filters] as const,
  movements: (filters: Record<string, unknown>) => ["inventory", "movements", filters] as const,
};

export function useStockOnHand(options: { warehouseId?: string | null; branchId?: string | null }) {
  return useQuery({
    queryKey: inventoryKeys.stock(options),
    queryFn: () => listStockOnHand(options),
    staleTime: 30_000,
  });
}

export function useMovements(filters: MovementFilters) {
  return useQuery({
    queryKey: inventoryKeys.movements(filters as Record<string, unknown>),
    queryFn: () => listMovements(filters),
    // Keeps the table on screen while the next page loads rather than flashing.
    placeholderData: (previous) => previous,
  });
}

export function usePostAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdjustmentInput) => postAdjustment(input),
    onSuccess: () => {
      // Stock changed, so the ledger, the balances and the dashboard
      // counters are all stale.
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Adjustment posted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
