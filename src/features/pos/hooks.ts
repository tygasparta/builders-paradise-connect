import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  closeSession,
  completeSale,
  findOpenSession,
  holdSale,
  listHeldSales,
  openSession,
  sessionTakings,
} from "./api";

export const posKeys = {
  all: ["pos"] as const,
  session: (warehouseId: string) => ["pos", "session", warehouseId] as const,
  takings: (sessionId: string) => ["pos", "takings", sessionId] as const,
  held: (sessionId: string) => ["pos", "held", sessionId] as const,
};

export function useOpenSession(warehouseId: string | null) {
  return useQuery({
    queryKey: posKeys.session(warehouseId ?? ""),
    queryFn: () => findOpenSession(warehouseId as string),
    enabled: Boolean(warehouseId),
    staleTime: 15_000,
  });
}

export function useSessionTakings(sessionId: string | null) {
  return useQuery({
    queryKey: posKeys.takings(sessionId ?? ""),
    queryFn: () => sessionTakings(sessionId as string),
    enabled: Boolean(sessionId),
    staleTime: 5_000,
  });
}

export function useHeldSales(sessionId: string | null) {
  return useQuery({
    queryKey: posKeys.held(sessionId ?? ""),
    queryFn: () => listHeldSales(sessionId as string),
    enabled: Boolean(sessionId),
    staleTime: 5_000,
  });
}

export function useOpenTill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: openSession,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: posKeys.all });
      toast.success("Till opened");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCloseTill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: closeSession,
    onSuccess: (variance) => {
      void queryClient.invalidateQueries({ queryKey: posKeys.all });
      if (Math.abs(variance) < 0.005) {
        toast.success("Till closed and balanced");
      } else if (variance > 0) {
        toast.warning(`Till closed with ${variance.toFixed(2)} over`);
      } else {
        toast.warning(`Till closed with ${Math.abs(variance).toFixed(2)} short`);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCompleteSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: completeSale,
    onSuccess: () => {
      // One sale touches stock, the ledger, the till and the dashboard.
      void queryClient.invalidateQueries({ queryKey: posKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useHoldSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: holdSale,
    onSuccess: (invoiceNo) => {
      void queryClient.invalidateQueries({ queryKey: posKeys.all });
      toast.success(`Held as ${invoiceNo}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
