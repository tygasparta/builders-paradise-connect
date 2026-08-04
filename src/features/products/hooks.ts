import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { ProductFormValues } from "./schema";
import {
  createProduct,
  listBrands,
  listCategories,
  listProducts,
  listUnitsOfMeasure,
  setProductStatus,
  updateProduct,
} from "./api";

export const productKeys = {
  all: ["products"] as const,
  list: (filters: Record<string, unknown>) => ["products", "list", filters] as const,
  categories: ["products", "categories"] as const,
  brands: ["products", "brands"] as const,
  uoms: ["products", "uoms"] as const,
};

export function useProducts(filters: {
  includeInactive?: boolean;
  categoryId?: string | null;
  brandId?: string | null;
}) {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: () => listProducts(filters),
    staleTime: 30_000,
  });
}

// Reference data barely changes; cache it hard so every form opens instantly.
export function useCategories() {
  return useQuery({
    queryKey: productKeys.categories,
    queryFn: listCategories,
    staleTime: 10 * 60_000,
  });
}

export function useBrands() {
  return useQuery({
    queryKey: productKeys.brands,
    queryFn: listBrands,
    staleTime: 10 * 60_000,
  });
}

export function useUnitsOfMeasure() {
  return useQuery({
    queryKey: productKeys.uoms,
    queryFn: listUnitsOfMeasure,
    staleTime: 10 * 60_000,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: ProductFormValues) => createProduct(values),
    onSuccess: (product) => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success(`"${product.name}" added to the catalogue`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: ProductFormValues }) =>
      updateProduct(id, values),
    onSuccess: (product) => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success(`"${product.name}" saved`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetProductStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "inactive" | "discontinued" }) =>
      setProductStatus(id, status),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success(
        variables.status === "active" ? "Product reactivated" : `Product ${variables.status}`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
