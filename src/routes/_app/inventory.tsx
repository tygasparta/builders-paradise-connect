import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Download,
  PackageMinus,
  ScrollText,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/erp/page-header";
import { DataTable } from "@/components/erp/data-table";
import { PermissionGate, RequirePermission } from "@/components/erp/permission-gate";
import { CardsSkeleton, EmptyState, ErrorState, TableSkeleton } from "@/components/erp/states";
import { StatCard } from "@/components/erp/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdjustmentDialog } from "@/features/inventory/adjustment-dialog";
import { useMovements, useStockOnHand } from "@/features/inventory/hooks";
import {
  MOVEMENT_TYPE_LABELS,
  isBelowReorder,
  type StockOnHandRow,
} from "@/features/inventory/api";
import { useWarehouses } from "@/features/warehouses/hooks";
import { useAuth } from "@/lib/auth/auth-context";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import type { InventoryMovementType } from "@/lib/database.types";
import { downloadCsv } from "@/lib/export";
import { plural } from "@/lib/format";

export const Route = createFileRoute("/_app/inventory")({
  component: InventoryPage,
});

function num(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function InventoryPage() {
  return (
    <RequirePermission require={PERMISSIONS.INVENTORY_VIEW} what="inventory">
      <InventoryScreen />
    </RequirePermission>
  );
}

function InventoryScreen() {
  const { can } = usePermissions();
  const { activeBranchId, activeWarehouseId } = useAuth();

  const canSeeCost = can(PERMISSIONS.PRODUCTS_COST_PRICE_VIEW);
  const canSeeBalances = can(PERMISSIONS.INVENTORY_BALANCES_VIEW);
  const canSeeMovements = can(PERMISSIONS.INVENTORY_MOVEMENTS_VIEW);
  const canAdjust = can(PERMISSIONS.INVENTORY_ADJUSTMENTS_POST);
  const canExport = can(PERMISSIONS.REPORTS_EXPORT);

  const [lowOnly, setLowOnly] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustPrefill, setAdjustPrefill] = useState<StockOnHandRow | null>(null);

  // A chosen warehouse is more specific than the branch, so it wins.
  const stock = useStockOnHand({
    warehouseId: activeWarehouseId,
    branchId: activeWarehouseId ? null : activeBranchId,
  });

  const rows = useMemo(() => {
    const all = stock.data ?? [];
    return lowOnly ? all.filter(isBelowReorder) : all;
  }, [stock.data, lowOnly]);

  const totals = useMemo(() => {
    const all = stock.data ?? [];
    return {
      value: all.reduce((sum, row) => sum + Number(row.total_value), 0),
      lines: all.length,
      low: all.filter(isBelowReorder).length,
      negative: all.filter((row) => Number(row.quantity) < 0).length,
    };
  }, [stock.data]);

  const openAdjust = (row?: StockOnHandRow) => {
    setAdjustPrefill(row ?? null);
    setAdjustOpen(true);
  };

  const exportStock = () => {
    downloadCsv("Stock on hand", rows, [
      { header: "SKU", value: (r) => r.product?.sku },
      { header: "Product", value: (r) => r.product?.name },
      { header: "Category", value: (r) => r.product?.category?.name },
      { header: "Warehouse", value: (r) => r.warehouse?.name },
      { header: "Unit", value: (r) => r.product?.uom?.code },
      { header: "Quantity", value: (r) => Number(r.quantity) },
      { header: "Reorder level", value: (r) => Number(r.product?.reorder_level ?? 0) },
      { header: "Below reorder", value: (r) => (isBelowReorder(r) ? "Yes" : "No") },
      ...(canSeeCost
        ? [
            {
              header: "Average cost",
              value: (r: StockOnHandRow) => Number(r.average_cost).toFixed(4),
            },
            {
              header: "Stock value",
              value: (r: StockOnHandRow) => Number(r.total_value).toFixed(2),
            },
          ]
        : []),
    ]);
    toast.success(`${plural(rows.length, "stock line")} exported`);
  };

  const stockColumns = useMemo<ColumnDef<StockOnHandRow, unknown>[]>(() => {
    const base: ColumnDef<StockOnHandRow, unknown>[] = [
      {
        id: "product",
        header: "Product",
        accessorFn: (row) => `${row.product?.sku ?? ""} ${row.product?.name ?? ""}`,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.product?.name ?? "—"}</p>
            <p className="num truncate text-helper text-muted-foreground">
              {row.original.product?.sku}
            </p>
          </div>
        ),
      },
      {
        id: "warehouse",
        header: "Warehouse",
        accessorFn: (row) => row.warehouse?.name ?? "",
        cell: ({ row }) => (
          <span className="text-td text-muted-foreground">{row.original.warehouse?.name}</span>
        ),
      },
      {
        accessorKey: "quantity",
        header: "On hand",
        cell: ({ row }) => {
          const quantity = Number(row.original.quantity);
          const low = isBelowReorder(row.original);
          return (
            <div className="flex items-center gap-2">
              <span
                className={
                  quantity < 0
                    ? "num font-semibold text-destructive"
                    : low
                      ? "num font-semibold text-warning-foreground"
                      : "num font-medium"
                }
              >
                {num(quantity)}
              </span>
              <span className="text-helper text-muted-foreground">
                {row.original.product?.uom?.code}
              </span>
              {quantity < 0 && (
                <Badge className="border-0 bg-destructive/12 text-helper text-destructive">
                  Negative
                </Badge>
              )}
              {low && quantity >= 0 && (
                <Badge className="border-0 bg-warning/20 text-helper text-warning-foreground">
                  Reorder
                </Badge>
              )}
            </div>
          );
        },
      },
    ];

    if (canSeeCost) {
      base.push(
        {
          accessorKey: "average_cost",
          header: "Avg cost",
          cell: ({ row }) => <span className="num">{num(row.original.average_cost, 4)}</span>,
        },
        {
          accessorKey: "total_value",
          header: "Value",
          cell: ({ row }) => (
            <span className="num font-medium">{num(row.original.total_value)}</span>
          ),
        },
      );
    }

    base.push({
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) =>
        canAdjust ? (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => openAdjust(row.original)}>
              <SlidersHorizontal className="size-3.5" />
              Adjust
            </Button>
          </div>
        ) : null,
    });

    return base;
  }, [canSeeCost, canAdjust]);

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Live stock, valued at weighted average per warehouse. Every figure comes from the movement ledger."
        breadcrumbs={[{ label: "Stock" }, { label: "Inventory" }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {canExport && canSeeBalances && (
              <Button variant="outline" onClick={exportStock} disabled={rows.length === 0}>
                <Download className="size-4" />
                Export
              </Button>
            )}
            <PermissionGate require={PERMISSIONS.INVENTORY_ADJUSTMENTS_POST}>
              <Button onClick={() => openAdjust()}>
                <SlidersHorizontal className="size-4" />
                Post adjustment
              </Button>
            </PermissionGate>
          </div>
        }
      />

      {!canSeeBalances ? (
        <div className="card-surface">
          <EmptyState
            icon={<Boxes className="size-5" />}
            title="Stock balances are hidden for your role"
            description="You can still view the movement ledger if your role allows it."
          />
        </div>
      ) : stock.isLoading ? (
        <CardsSkeleton count={4} />
      ) : stock.isError ? (
        <div className="card-surface">
          <ErrorState error={stock.error} onRetry={() => void stock.refetch()} />
        </div>
      ) : (
        <section aria-label="Stock summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Inventory value"
            value={canSeeCost ? num(totals.value) : "—"}
            sub={canSeeCost ? "At weighted average cost" : "Hidden for your role"}
            icon={<Boxes className="size-4" />}
            tone="primary"
          />
          <StatCard
            label="Stocked lines"
            value={String(totals.lines)}
            sub="Product / warehouse pairs"
            icon={<Boxes className="size-4" />}
          />
          <StatCard
            label="At or below reorder"
            value={String(totals.low)}
            sub={totals.low === 0 ? "Nothing to reorder" : "Needs purchasing attention"}
            icon={<TriangleAlert className="size-4" />}
            tone={totals.low > 0 ? "warning" : "default"}
          />
          <StatCard
            label="Negative balances"
            value={String(totals.negative)}
            sub={totals.negative === 0 ? "None — good" : "Investigate before month end"}
            icon={<PackageMinus className="size-4" />}
            tone={totals.negative > 0 ? "danger" : "default"}
          />
        </section>
      )}

      <div className="mt-4">
        <Tabs defaultValue={canSeeBalances ? "stock" : "movements"}>
          <TabsList>
            {canSeeBalances && <TabsTrigger value="stock">Stock on hand</TabsTrigger>}
            {canSeeMovements && <TabsTrigger value="movements">Movement ledger</TabsTrigger>}
          </TabsList>

          {canSeeBalances && (
            <TabsContent value="stock" className="mt-4">
              <DataTable
                columns={stockColumns}
                data={rows}
                isLoading={stock.isLoading}
                error={stock.error}
                onRetry={() => void stock.refetch()}
                searchPlaceholder="Search by product, SKU or warehouse…"
                emptyTitle={lowOnly ? "Nothing is below its reorder level" : "No stock yet"}
                emptyDescription={
                  lowOnly
                    ? "Every stocked line is above its reorder point."
                    : "Stock appears here after the first goods receipt or opening-balance adjustment."
                }
                pageSize={25}
                toolbar={
                  <div className="flex items-center gap-2">
                    <Switch id="low-only" checked={lowOnly} onCheckedChange={setLowOnly} />
                    <Label
                      htmlFor="low-only"
                      className="text-helper font-normal text-muted-foreground"
                    >
                      Below reorder only
                    </Label>
                  </div>
                }
              />
              <p className="mt-3 text-helper text-muted-foreground">
                Showing{" "}
                {activeWarehouseId
                  ? "the selected warehouse"
                  : activeBranchId
                    ? "the selected branch"
                    : "all branches"}{" "}
                — change the scope in the top bar.
              </p>
            </TabsContent>
          )}

          {canSeeMovements && (
            <TabsContent value="movements" className="mt-4">
              <MovementLedger canSeeCost={canSeeCost} canExport={canExport} />
            </TabsContent>
          )}
        </Tabs>
      </div>

      <AdjustmentDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        prefill={adjustPrefill}
        stock={stock.data ?? []}
      />
    </>
  );
}

const PAGE_SIZE = 25;

function MovementLedger({ canSeeCost, canExport }: { canSeeCost: boolean; canExport: boolean }) {
  const { activeWarehouseId } = useAuth();
  const { data: warehouses } = useWarehouses(null);

  const [warehouseId, setWarehouseId] = useState<string>(activeWarehouseId ?? "all");
  const [movementType, setMovementType] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);

  const movements = useMovements({
    page,
    pageSize: PAGE_SIZE,
    warehouseId: warehouseId === "all" ? null : warehouseId,
    movementType: movementType === "all" ? null : (movementType as InventoryMovementType),
    from: from || null,
    to: to || null,
  });

  const total = movements.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportMovements = () => {
    const rows = movements.data?.rows ?? [];
    downloadCsv("Stock movements", rows, [
      { header: "Date", value: (m) => m.movement_date },
      { header: "Movement no", value: (m) => m.movement_no },
      { header: "Type", value: (m) => MOVEMENT_TYPE_LABELS[m.movement_type] },
      { header: "SKU", value: (m) => m.product?.sku },
      { header: "Product", value: (m) => m.product?.name },
      { header: "Warehouse", value: (m) => m.warehouse?.name },
      { header: "In", value: (m) => (m.direction === 1 ? Number(m.quantity) : "") },
      { header: "Out", value: (m) => (m.direction === -1 ? Number(m.quantity) : "") },
      ...(canSeeCost
        ? [
            {
              header: "Unit cost",
              value: (m: (typeof rows)[number]) => Number(m.unit_cost).toFixed(4),
            },
            {
              header: "Total cost",
              value: (m: (typeof rows)[number]) => Number(m.total_cost).toFixed(2),
            },
            {
              header: "Balance after",
              value: (m: (typeof rows)[number]) => Number(m.balance_quantity),
            },
            {
              header: "Value after",
              value: (m: (typeof rows)[number]) => Number(m.balance_value).toFixed(2),
            },
          ]
        : []),
      { header: "Document", value: (m) => m.source_document_number },
      { header: "Reason", value: (m) => m.reason },
      { header: "By", value: (m) => m.user?.full_name },
    ]);
    toast.success(`${plural(rows.length, "movement")} exported`);
  };

  return (
    <div className="card-surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <Select
          value={warehouseId}
          onValueChange={(value) => {
            setWarehouseId(value);
            setPage(0);
          }}
        >
          <SelectTrigger className="h-9 w-44" aria-label="Filter by warehouse">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All warehouses</SelectItem>
            {warehouses?.map((wh) => (
              <SelectItem key={wh.id} value={wh.id}>
                {wh.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={movementType}
          onValueChange={(value) => {
            setMovementType(value);
            setPage(0);
          }}
        >
          <SelectTrigger className="h-9 w-48" aria-label="Filter by movement type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All movement types</SelectItem>
            {Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={from}
          onChange={(event) => {
            setFrom(event.target.value);
            setPage(0);
          }}
          className="h-9 w-40"
          aria-label="From date"
        />
        <Input
          type="date"
          value={to}
          onChange={(event) => {
            setTo(event.target.value);
            setPage(0);
          }}
          className="h-9 w-40"
          aria-label="To date"
        />

        {canExport && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={exportMovements}
            disabled={(movements.data?.rows.length ?? 0) === 0}
          >
            <Download className="size-4" />
            Export page
          </Button>
        )}
      </div>

      {movements.isError ? (
        <ErrorState error={movements.error} onRetry={() => void movements.refetch()} />
      ) : movements.isLoading ? (
        <TableSkeleton columns={7} rows={8} />
      ) : (movements.data?.rows.length ?? 0) === 0 ? (
        <EmptyState
          icon={<ScrollText className="size-5" />}
          title="No movements for these filters"
          description="Receipts, sales, adjustments and transfers all appear here as they are posted."
        />
      ) : (
        <div className="table-scroll">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-10 text-helper uppercase tracking-wider">Date</TableHead>
                <TableHead className="h-10 text-helper uppercase tracking-wider">Type</TableHead>
                <TableHead className="h-10 text-helper uppercase tracking-wider">Product</TableHead>
                <TableHead className="h-10 text-helper uppercase tracking-wider">
                  Warehouse
                </TableHead>
                <TableHead className="h-10 text-right text-helper uppercase tracking-wider">
                  Qty
                </TableHead>
                {canSeeCost && (
                  <TableHead className="h-10 text-right text-helper uppercase tracking-wider">
                    Cost
                  </TableHead>
                )}
                <TableHead className="h-10 text-right text-helper uppercase tracking-wider">
                  Balance
                </TableHead>
                <TableHead className="h-10 text-helper uppercase tracking-wider">By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.data?.rows.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="num whitespace-nowrap py-2.5 text-helper text-muted-foreground">
                    {format(new Date(movement.movement_date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-td">
                      {movement.direction === 1 ? (
                        <ArrowUpRight className="size-3.5 text-success" aria-hidden />
                      ) : (
                        <ArrowDownRight className="size-3.5 text-destructive" aria-hidden />
                      )}
                      {MOVEMENT_TYPE_LABELS[movement.movement_type]}
                    </span>
                    {movement.source_document_number && (
                      <span className="num mt-0.5 block text-helper text-muted-foreground">
                        {movement.source_document_number}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <span className="block text-td">{movement.product?.name}</span>
                    <span className="num block text-helper text-muted-foreground">
                      {movement.product?.sku}
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5 text-td text-muted-foreground">
                    {movement.warehouse?.code}
                  </TableCell>
                  <TableCell className="num py-2.5 text-right text-td">
                    <span
                      className={movement.direction === 1 ? "text-success" : "text-destructive"}
                    >
                      {movement.direction === 1 ? "+" : "−"}
                      {num(movement.quantity)}
                    </span>
                  </TableCell>
                  {canSeeCost && (
                    <TableCell className="num py-2.5 text-right text-td">
                      {num(movement.unit_cost, 4)}
                    </TableCell>
                  )}
                  <TableCell className="num py-2.5 text-right text-td font-medium">
                    {num(movement.balance_quantity)}
                  </TableCell>
                  <TableCell className="py-2.5 text-helper text-muted-foreground">
                    {movement.user?.full_name ?? "System"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!movements.isLoading && !movements.isError && total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5">
          <p className="text-helper text-muted-foreground">
            Page <span className="num">{page + 1}</span> of <span className="num">{pageCount}</span>{" "}
            · {plural(total, "movement")}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => current + 1)}
              disabled={page + 1 >= pageCount}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
