import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, MoreHorizontal, Package, Pencil, Plus, Power } from "lucide-react";

import { PageHeader } from "@/components/erp/page-header";
import { DataTable, StatusBadge } from "@/components/erp/data-table";
import { RequirePermission } from "@/components/erp/permission-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProductFormDialog } from "@/features/products/product-form-dialog";
import {
  useBrands,
  useCategories,
  useProducts,
  useSetProductStatus,
} from "@/features/products/hooks";
import type { ProductWithRefs } from "@/features/products/api";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import { downloadCsv } from "@/lib/export";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/products")({
  component: ProductsPage,
});

function ProductsPage() {
  return (
    <RequirePermission require={PERMISSIONS.PRODUCTS_VIEW} what="the product catalogue">
      <ProductsScreen />
    </RequirePermission>
  );
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function ProductsScreen() {
  const { can } = usePermissions();
  const canCreate = can(PERMISSIONS.PRODUCTS_CREATE);
  const canUpdate = can(PERMISSIONS.PRODUCTS_UPDATE);
  const canArchive = can(PERMISSIONS.PRODUCTS_ARCHIVE);
  const canSeeCost = can(PERMISSIONS.PRODUCTS_COST_PRICE_VIEW);
  const canExport = can(PERMISSIONS.REPORTS_EXPORT);

  const [includeInactive, setIncludeInactive] = useState(false);
  const [categoryId, setCategoryId] = useState<string>("all");
  const [brandId, setBrandId] = useState<string>("all");
  const [editing, setEditing] = useState<ProductWithRefs | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [archiving, setArchiving] = useState<ProductWithRefs | null>(null);

  const products = useProducts({
    includeInactive,
    categoryId: categoryId === "all" ? null : categoryId,
    brandId: brandId === "all" ? null : brandId,
  });
  const { data: categories } = useCategories();
  const { data: brands } = useBrands();
  const setStatus = useSetProductStatus();

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const exportProducts = () => {
    const rows = products.data ?? [];
    downloadCsv("Product catalogue", rows, [
      { header: "SKU", value: (p) => p.sku },
      { header: "Stock code", value: (p) => p.stock_code },
      { header: "Name", value: (p) => p.name },
      { header: "Category", value: (p) => p.category?.name },
      { header: "Brand", value: (p) => p.brand?.name },
      { header: "Unit", value: (p) => p.uom?.code },
      // Cost is omitted entirely rather than exported blank, so the file
      // cannot imply a zero cost to whoever opens it.
      ...(canSeeCost
        ? [
            {
              header: "Standard cost",
              value: (p: ProductWithRefs) => Number(p.standard_cost).toFixed(4),
            },
          ]
        : []),
      { header: "Selling price", value: (p) => Number(p.selling_price).toFixed(2) },
      { header: "Tax %", value: (p) => Number(p.tax_rate).toFixed(2) },
      { header: "Reorder level", value: (p) => Number(p.reorder_level) },
      { header: "Track stock", value: (p) => (p.track_stock ? "Yes" : "No") },
      { header: "Status", value: (p) => p.status },
      { header: "Barcodes", value: (p) => p.product_barcodes.map((b) => b.barcode).join(" | ") },
    ]);
    toast.success(`${rows.length} products exported`);
  };

  const columns = useMemo<ColumnDef<ProductWithRefs, unknown>[]>(() => {
    const base: ColumnDef<ProductWithRefs, unknown>[] = [
      {
        accessorKey: "sku",
        header: "SKU",
        cell: ({ row }) => <span className="num text-helper font-medium">{row.original.sku}</span>,
      },
      {
        accessorKey: "name",
        header: "Product",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.name}</p>
            <p className="truncate text-helper text-muted-foreground">
              {row.original.category?.name ?? "Uncategorised"}
              {row.original.brand ? ` · ${row.original.brand.name}` : ""}
            </p>
          </div>
        ),
      },
      {
        id: "uom",
        header: "Unit",
        accessorFn: (row) => row.uom?.code ?? "",
        cell: ({ row }) => (
          <span className="text-helper text-muted-foreground">{row.original.uom?.code ?? "—"}</span>
        ),
      },
    ];

    if (canSeeCost) {
      base.push({
        accessorKey: "standard_cost",
        header: "Cost",
        cell: ({ row }) => <span className="num">{money(row.original.standard_cost)}</span>,
      });
    }

    base.push(
      {
        accessorKey: "selling_price",
        header: "Price",
        cell: ({ row }) => (
          <span className="num font-medium">{money(row.original.selling_price)}</span>
        ),
      },
      {
        id: "flags",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {!row.original.track_stock && (
              <Badge variant="secondary" className="text-helper">
                Not stocked
              </Badge>
            )}
            {row.original.track_expiry && (
              <Badge variant="secondary" className="text-helper">
                Expiry
              </Badge>
            )}
            {row.original.product_barcodes.length > 0 && (
              <Badge variant="secondary" className="text-helper">
                {row.original.product_barcodes.length} code
                {row.original.product_barcodes.length === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    );

    if (canUpdate || canArchive) {
      base.push({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const product = row.original;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Actions for ${product.name}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canUpdate && (
                    <DropdownMenuItem
                      onSelect={() => {
                        setEditing(product);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                      Edit product
                    </DropdownMenuItem>
                  )}
                  {canArchive &&
                    (product.status === "active" ? (
                      <DropdownMenuItem onSelect={() => setArchiving(product)}>
                        <Power className="size-4" />
                        Discontinue
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onSelect={() => setStatus.mutate({ id: product.id, status: "active" })}
                      >
                        <Power className="size-4" />
                        Reactivate
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      });
    }

    return base;
  }, [canSeeCost, canUpdate, canArchive, setStatus]);

  const parents = (categories ?? []).filter((c) => c.parent_id === null);

  return (
    <>
      <PageHeader
        title="Products"
        description="The catalogue. Quantities come from receipts and adjustments, never from this screen."
        breadcrumbs={[{ label: "Stock" }, { label: "Products" }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {canExport && (
              <Button variant="outline" onClick={exportProducts} disabled={!products.data?.length}>
                <Download className="size-4" />
                Export
              </Button>
            )}
            {canCreate && (
              <Button onClick={openNew}>
                <Plus className="size-4" />
                New product
              </Button>
            )}
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={products.data}
        isLoading={products.isLoading}
        error={products.error}
        onRetry={() => void products.refetch()}
        searchPlaceholder="Search by name, SKU, category or brand…"
        emptyTitle="No products yet"
        emptyDescription="Add your first product, or import your catalogue once purchasing is live."
        emptyAction={
          canCreate && (
            <Button onClick={openNew}>
              <Plus className="size-4" />
              New product
            </Button>
          )
        }
        pageSize={25}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-9 w-44" aria-label="Filter by category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {parents.map((parent) => (
                  <SelectItem key={parent.id} value={parent.id}>
                    {parent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={brandId} onValueChange={setBrandId}>
              <SelectTrigger className="h-9 w-36" aria-label="Filter by brand">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All brands</SelectItem>
                {brands?.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Switch
                id="include-inactive-products"
                checked={includeInactive}
                onCheckedChange={setIncludeInactive}
              />
              <Label
                htmlFor="include-inactive-products"
                className="text-helper font-normal text-muted-foreground"
              >
                Show inactive
              </Label>
            </div>
          </div>
        }
      />

      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editing} />

      <AlertDialog open={Boolean(archiving)} onOpenChange={(open) => !open && setArchiving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discontinue {archiving?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It stops appearing on new orders and at the till. Existing stock, movements and
              history are untouched, and you can reactivate it at any time. Products are never
              deleted, because invoices and stock movements reference them permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (archiving) setStatus.mutate({ id: archiving.id, status: "discontinued" });
                setArchiving(null);
              }}
            >
              Discontinue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="mt-4 flex items-center gap-1.5 text-helper text-muted-foreground">
        <Package className="size-3.5" aria-hidden />
        {canSeeCost
          ? "Cost shown here is the catalogue standard. Stock is valued at weighted average per warehouse."
          : "Cost prices are hidden for your role."}
      </p>
    </>
  );
}
