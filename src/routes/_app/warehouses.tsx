import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Plus, Power, Warehouse as WarehouseIcon } from "lucide-react";

import { PageHeader } from "@/components/erp/page-header";
import { DataTable, StatusBadge } from "@/components/erp/data-table";
import { RequirePermission } from "@/components/erp/permission-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { WarehouseFormDialog } from "@/features/warehouses/warehouse-form-dialog";
import { useSetWarehouseStatus, useWarehouses } from "@/features/warehouses/hooks";
import type { WarehouseWithBranch } from "@/features/warehouses/api";
import { WAREHOUSE_TYPES } from "@/features/warehouses/schema";
import { useAuth } from "@/lib/auth/auth-context";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import type { WarehouseRow } from "@/lib/database.types";

export const Route = createFileRoute("/_app/warehouses")({
  component: WarehousesPage,
});

function WarehousesPage() {
  return (
    <RequirePermission require={PERMISSIONS.WAREHOUSES_VIEW} what="warehouses">
      <WarehousesScreen />
    </RequirePermission>
  );
}

function typeLabel(type: string): string {
  return WAREHOUSE_TYPES.find((option) => option.value === type)?.label ?? type;
}

function WarehousesScreen() {
  const { can } = usePermissions();
  const { activeBranchId } = useAuth();
  const canManage = can(PERMISSIONS.WAREHOUSES_MANAGE);

  const [includeInactive, setIncludeInactive] = useState(false);
  const [editing, setEditing] = useState<WarehouseRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deactivating, setDeactivating] = useState<WarehouseWithBranch | null>(null);

  // Respects the branch scope chosen in the top bar.
  const warehouses = useWarehouses(activeBranchId, includeInactive);
  const setStatus = useSetWarehouseStatus();

  const columns = useMemo<ColumnDef<WarehouseWithBranch, unknown>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => <span className="num font-medium">{row.original.code}</span>,
      },
      {
        accessorKey: "name",
        header: "Warehouse",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.name}</span>
            {row.original.is_default && (
              <Badge variant="secondary" className="text-[10px]">
                Default
              </Badge>
            )}
            {row.original.allow_negative_stock && (
              <Badge className="border-0 bg-warning/20 text-[10px] text-warning-foreground">
                Negative allowed
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: "branch",
        header: "Branch",
        accessorFn: (row) => row.branch?.name ?? "",
        cell: ({ row }) =>
          row.original.branch?.name ?? <span className="text-muted-foreground">—</span>,
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{typeLabel(row.original.type)}</span>
        ),
      },
      {
        id: "manager",
        header: "Manager",
        accessorFn: (row) => row.manager?.full_name ?? "",
        cell: ({ row }) =>
          row.original.manager?.full_name ?? (
            <span className="text-muted-foreground">Unassigned</span>
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          if (!canManage) return null;
          const warehouse = row.original;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Actions for ${warehouse.name}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditing(warehouse);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="size-4" />
                    Edit warehouse
                  </DropdownMenuItem>
                  {warehouse.status === "active" ? (
                    <DropdownMenuItem onSelect={() => setDeactivating(warehouse)}>
                      <Power className="size-4" />
                      Deactivate
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onSelect={() => setStatus.mutate({ id: warehouse.id, status: "active" })}
                    >
                      <Power className="size-4" />
                      Reactivate
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [canManage, setStatus],
  );

  return (
    <>
      <PageHeader
        title="Warehouses"
        description="Every physical and virtual place stock can sit, including transit and damaged goods."
        breadcrumbs={[{ label: "Stock" }, { label: "Warehouses" }]}
        actions={
          canManage && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              New warehouse
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        data={warehouses.data}
        isLoading={warehouses.isLoading}
        error={warehouses.error}
        onRetry={() => void warehouses.refetch()}
        searchPlaceholder="Search warehouses by name, code or branch…"
        emptyTitle="No warehouses yet"
        emptyDescription={
          activeBranchId
            ? "This branch has no warehouses. Add one, or switch branch scope in the top bar."
            : "Add your first warehouse to start holding stock."
        }
        emptyAction={
          canManage && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              New warehouse
            </Button>
          )
        }
        toolbar={
          <div className="flex items-center gap-2">
            <Switch
              id="include-inactive-wh"
              checked={includeInactive}
              onCheckedChange={setIncludeInactive}
            />
            <Label
              htmlFor="include-inactive-wh"
              className="text-xs font-normal text-muted-foreground"
            >
              Show inactive
            </Label>
          </div>
        }
      />

      <WarehouseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        warehouse={editing}
        defaultBranchId={activeBranchId}
      />

      <AlertDialog
        open={Boolean(deactivating)}
        onOpenChange={(open) => !open && setDeactivating(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deactivating?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The warehouse stops accepting new stock movements and disappears from pickers. Its
              recorded history and balances are kept, and you can reactivate it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deactivating) setStatus.mutate({ id: deactivating.id, status: "inactive" });
                setDeactivating(null);
              }}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <WarehouseIcon className="size-3.5" aria-hidden />
        Showing {activeBranchId ? "the selected branch only" : "all branches"} — change the scope in
        the top bar.
      </p>
    </>
  );
}
