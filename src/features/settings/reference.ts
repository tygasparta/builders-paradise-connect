import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { db, unwrap } from "@/lib/supabase";
import type {
  BrandRow,
  DocumentSequenceRow,
  ProductCategoryRow,
  UnitOfMeasureRow,
} from "@/lib/database.types";

/**
 * Reference data behind the rest of the system: numbering, units,
 * categories and brands. Everything here is read constantly elsewhere,
 * so edits are deliberately narrow.
 */

export async function listSequences(): Promise<DocumentSequenceRow[]> {
  return unwrap(
    await db.from("document_sequences").select("*").order("doc_type"),
  ) as DocumentSequenceRow[];
}

export async function updateSequence(
  docType: string,
  patch: { prefix: string; padding: number; next_number: number },
): Promise<void> {
  const rows = unwrap(
    await db.from("document_sequences").update(patch).eq("doc_type", docType).select("doc_type"),
  ) as { doc_type: string }[];
  if (rows.length === 0) {
    throw new Error("Numbering could not be changed. You may not have permission.");
  }
}

export async function listUnits(): Promise<UnitOfMeasureRow[]> {
  return unwrap(await db.from("units_of_measure").select("*").order("code")) as UnitOfMeasureRow[];
}

export async function listCategories(): Promise<ProductCategoryRow[]> {
  return unwrap(
    await db.from("product_categories").select("*").order("name"),
  ) as ProductCategoryRow[];
}

export async function listBrands(): Promise<BrandRow[]> {
  return unwrap(await db.from("brands").select("*").order("name")) as BrandRow[];
}

export type UnitInput = { code: string; name: string; allow_decimal: boolean };

export async function saveUnit(input: UnitInput & { id?: string }): Promise<void> {
  const { id, ...values } = input;
  const rows = unwrap(
    id
      ? await db.from("units_of_measure").update(values).eq("id", id).select("id")
      : await db.from("units_of_measure").insert(values).select("id"),
  ) as { id: string }[];
  if (rows.length === 0) throw new Error("The unit could not be saved.");
}

export type CategoryInput = { code: string; name: string; description: string | null };

export async function saveCategory(input: CategoryInput & { id?: string }): Promise<void> {
  const { id, ...values } = input;
  const rows = unwrap(
    id
      ? await db.from("product_categories").update(values).eq("id", id).select("id")
      : await db.from("product_categories").insert(values).select("id"),
  ) as { id: string }[];
  if (rows.length === 0) throw new Error("The category could not be saved.");
}

export type BrandInput = { code: string; name: string };

export async function saveBrand(input: BrandInput & { id?: string }): Promise<void> {
  const { id, ...values } = input;
  const rows = unwrap(
    id
      ? await db.from("brands").update(values).eq("id", id).select("id")
      : await db.from("brands").insert(values).select("id"),
  ) as { id: string }[];
  if (rows.length === 0) throw new Error("The brand could not be saved.");
}

export async function setReferenceStatus(
  table: "units_of_measure" | "product_categories" | "brands",
  id: string,
  status: "active" | "inactive",
): Promise<void> {
  unwrap(await db.from(table).update({ status }).eq("id", id).select("id"));
}

// ---------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------

export const referenceKeys = {
  all: ["reference"] as const,
  sequences: ["reference", "sequences"] as const,
  units: ["reference", "units"] as const,
  categories: ["reference", "categories"] as const,
  brands: ["reference", "brands"] as const,
};

export function useSequences() {
  return useQuery({
    queryKey: referenceKeys.sequences,
    queryFn: listSequences,
    staleTime: 5 * 60_000,
  });
}

export function useUnits() {
  return useQuery({ queryKey: referenceKeys.units, queryFn: listUnits, staleTime: 5 * 60_000 });
}

export function useCategories() {
  return useQuery({
    queryKey: referenceKeys.categories,
    queryFn: listCategories,
    staleTime: 5 * 60_000,
  });
}

export function useBrands() {
  return useQuery({ queryKey: referenceKeys.brands, queryFn: listBrands, staleTime: 5 * 60_000 });
}

export function useUpdateSequence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      docType,
      patch,
    }: {
      docType: string;
      patch: { prefix: string; padding: number; next_number: number };
    }) => updateSequence(docType, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: referenceKeys.sequences });
      toast.success("Numbering updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSaveUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveUnit,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: referenceKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Unit saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSaveCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveCategory,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: referenceKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Category saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSaveBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveBrand,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: referenceKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Brand saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetReferenceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      table,
      id,
      status,
    }: {
      table: "units_of_measure" | "product_categories" | "brands";
      id: string;
      status: "active" | "inactive";
    }) => setReferenceStatus(table, id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: referenceKeys.all });
      toast.success("Updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** What a sequence's next document number will look like. */
export function previewNumber(prefix: string, padding: number, next: number): string {
  const safePadding = Math.min(10, Math.max(3, padding || 3));
  return `${prefix}-${String(next).padStart(safePadding, "0")}`;
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  purchase_requisition: "Purchase requisitions",
  purchase_order: "Purchase orders",
  grn: "Goods received notes",
  supplier_invoice: "Supplier invoices",
  supplier_payment: "Supplier payments",
  quotation: "Quotations",
  sales_order: "Sales orders",
  sales_invoice: "Sales invoices",
  sales_return: "Sales returns",
  credit_note: "Credit notes",
  customer_receipt: "Customer receipts",
  stock_adjustment: "Stock adjustments",
  stock_transfer: "Stock transfers",
  stock_count: "Stock counts",
  expense: "Expenses",
  bank_txn: "Bank transactions",
  reconciliation: "Bank reconciliations",
  employee: "Employees",
  leave_request: "Leave requests",
  payroll_run: "Payroll runs",
  payslip: "Payslips",
  pos_session: "POS sessions",
};
