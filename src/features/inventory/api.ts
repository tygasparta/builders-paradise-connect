import { db, unwrap } from "@/lib/supabase";
import type { InventoryMovementRow, InventoryMovementType } from "@/lib/database.types";

export type StockOnHandRow = {
  product_id: string;
  warehouse_id: string;
  quantity: number;
  average_cost: number;
  total_value: number;
  last_movement_at: string | null;
  product: {
    id: string;
    sku: string;
    name: string;
    reorder_level: number;
    min_stock_level: number;
    status: string;
    uom: { code: string } | null;
    category: { name: string } | null;
  } | null;
  warehouse: { id: string; code: string; name: string; branch_id: string } | null;
};

/**
 * Stock on hand, joined to enough of the product and warehouse to render a
 * row without a second round trip.
 *
 * Reorder comparison happens in the browser because it spans two tables
 * (`balances.quantity` against `products.reorder_level`), which PostgREST
 * cannot express as a filter. The row count is bounded by
 * products x warehouses; when that stops being small this moves to a
 * database view.
 */
export async function listStockOnHand(options: {
  warehouseId?: string | null;
  branchId?: string | null;
}): Promise<StockOnHandRow[]> {
  let query = db
    .from("inventory_balances")
    .select(
      `product_id, warehouse_id, quantity, average_cost, total_value, last_movement_at,
       product:products!inventory_balances_product_id_fkey(
         id, sku, name, reorder_level, min_stock_level, status,
         uom:units_of_measure!products_uom_id_fkey(code),
         category:product_categories!products_category_id_fkey(name)
       ),
       warehouse:warehouses!inventory_balances_warehouse_id_fkey(id, code, name, branch_id)`,
    )
    .order("quantity", { ascending: true });

  if (options.warehouseId) query = query.eq("warehouse_id", options.warehouseId);

  const rows = unwrap(await query) as unknown as StockOnHandRow[];

  // Branch scope has to be applied here: the balance row knows its
  // warehouse, and the warehouse knows its branch.
  if (options.branchId) {
    return rows.filter((row) => row.warehouse?.branch_id === options.branchId);
  }
  return rows;
}

export function isBelowReorder(row: StockOnHandRow): boolean {
  const reorder = Number(row.product?.reorder_level ?? 0);
  return reorder > 0 && Number(row.quantity) <= reorder;
}

export type MovementFilters = {
  productId?: string | null;
  warehouseId?: string | null;
  movementType?: InventoryMovementType | null;
  from?: string | null;
  to?: string | null;
  page?: number;
  pageSize?: number;
};

export type MovementRow = InventoryMovementRow & {
  product: { sku: string; name: string } | null;
  warehouse: { code: string; name: string } | null;
  user: { full_name: string } | null;
};

export type MovementPage = { rows: MovementRow[]; total: number };

/**
 * The stock movement ledger, paged on the server — this table grows
 * without bound and must never be pulled into the browser wholesale.
 */
export async function listMovements(filters: MovementFilters): Promise<MovementPage> {
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? 25;
  const from = page * pageSize;

  let query = db
    .from("inventory_movements")
    .select(
      `*,
       product:products!inventory_movements_product_id_fkey(sku, name),
       warehouse:warehouses!inventory_movements_warehouse_id_fkey(code, name),
       user:profiles!inventory_movements_created_by_fkey(full_name)`,
      { count: "exact" },
    )
    .order("movement_date", { ascending: false })
    .order("movement_no", { ascending: false })
    .range(from, from + pageSize - 1);

  if (filters.productId) query = query.eq("product_id", filters.productId);
  if (filters.warehouseId) query = query.eq("warehouse_id", filters.warehouseId);
  if (filters.movementType) query = query.eq("movement_type", filters.movementType);
  if (filters.from) query = query.gte("movement_date", filters.from);
  if (filters.to) query = query.lte("movement_date", filters.to);

  const result = await query;
  const rows = unwrap(result) as unknown as MovementRow[];
  return { rows, total: result.count ?? rows.length };
}

export type AdjustmentInput = {
  productId: string;
  warehouseId: string;
  direction: "increase" | "decrease";
  quantity: number;
  reason: string;
  explanation: string;
  unitCost?: number | null;
};

/**
 * Posts a stock adjustment.
 *
 * Goes through post_inventory_movement() like every other stock change —
 * the ledger row, the balance and the weighted average all move together
 * or not at all, and the movement is immutable once written.
 */
export async function postAdjustment(input: AdjustmentInput): Promise<string> {
  const { data, error } = await db.rpc("post_inventory_movement", {
    p_product_id: input.productId,
    p_warehouse_id: input.warehouseId,
    p_movement_type: input.direction === "increase" ? "adjustment_increase" : "adjustment_decrease",
    p_quantity: input.quantity,
    p_unit_cost: input.unitCost ?? null,
    p_source_module: "inventory",
    p_source_document_type: "STOCK_ADJUSTMENT",
    p_reason: input.reason,
    p_notes: input.explanation,
  });

  if (error) throw new Error(error.message);
  return data as unknown as string;
}

/** Reasons from the brief. Stored on the movement for the variance report. */
export const ADJUSTMENT_REASONS = [
  { value: "broken", label: "Broken stock", direction: "decrease" },
  { value: "damaged", label: "Damaged stock", direction: "decrease" },
  { value: "expired", label: "Expired stock", direction: "decrease" },
  { value: "own_use", label: "Own use", direction: "decrease" },
  { value: "missing", label: "Missing stock", direction: "decrease" },
  { value: "count_variance", label: "Stock-count variance", direction: "both" },
  { value: "opening", label: "Opening balance", direction: "increase" },
  { value: "found", label: "Stock found", direction: "increase" },
  { value: "other", label: "Other authorised reason", direction: "both" },
] as const;

export const MOVEMENT_TYPE_LABELS: Record<InventoryMovementType, string> = {
  opening_balance: "Opening balance",
  goods_receipt: "Goods receipt",
  customer_return: "Customer return",
  adjustment_increase: "Adjustment (increase)",
  transfer_in: "Transfer in",
  count_increase: "Count increase",
  requisition_return: "Requisition return",
  sale: "Sale",
  supplier_return: "Supplier return",
  adjustment_decrease: "Adjustment (decrease)",
  transfer_out: "Transfer out",
  count_decrease: "Count decrease",
  requisition_issue: "Requisition issue",
};
