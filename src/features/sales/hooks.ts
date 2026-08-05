import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { InvoiceStatus, QuotationStatus, SalesReturnStatus } from "@/lib/database.types";
import type { SalesDocumentValues } from "./schema";
import {
  createReturn,
  createSalesDocument,
  listInvoices,
  listQuotations,
  listReturns,
  postInvoice,
  postReturn,
  setInvoiceStatus,
  setQuotationStatus,
  setReturnStatus,
} from "./api";

export const salesKeys = {
  all: ["sales"] as const,
  invoices: (status: string | null) => ["sales", "invoices", status ?? "all"] as const,
  quotations: (status: string | null) => ["sales", "quotations", status ?? "all"] as const,
  returns: (status: string | null) => ["sales", "returns", status ?? "all"] as const,
};

export function useInvoices(status: InvoiceStatus | null) {
  return useQuery({
    queryKey: salesKeys.invoices(status),
    queryFn: () => listInvoices(status),
    staleTime: 30_000,
  });
}

export function useQuotations(status: QuotationStatus | null) {
  return useQuery({
    queryKey: salesKeys.quotations(status),
    queryFn: () => listQuotations(status),
    staleTime: 30_000,
  });
}

export function useSalesReturns(status: SalesReturnStatus | null) {
  return useQuery({
    queryKey: salesKeys.returns(status),
    queryFn: () => listReturns(status),
    staleTime: 30_000,
  });
}

export function useCreateSalesDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: SalesDocumentValues) => createSalesDocument(values),
    onSuccess: (result, values) => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.all });
      toast.success(
        values.kind === "invoice"
          ? `${result.number} created — approve it, then post`
          : `${result.number} created`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetInvoiceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: InvoiceStatus }) =>
      setInvoiceStatus(id, status),
    onSuccess: (_d, v) => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.all });
      const labels: Record<string, string> = {
        awaiting_approval: "Sent for approval",
        approved: "Invoice approved — it can now be posted",
        cancelled: "Invoice cancelled",
      };
      toast.success(labels[v.status] ?? "Invoice updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetQuotationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuotationStatus }) =>
      setQuotationStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.all });
      toast.success("Quotation updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetReturnStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: SalesReturnStatus }) =>
      setReturnStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.all });
      toast.success("Credit note updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function usePostInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => postInvoice(id),
    onSuccess: () => {
      // One posting touches stock, the ledger and the customer balance.
      void queryClient.invalidateQueries({ queryKey: salesKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Posted — stock, revenue and cost of sales all updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCreateReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createReturn,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.all });
      toast.success(`${result.number} created — approve it, then post`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function usePostReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => postReturn(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: salesKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Credit note posted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
