import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2, MoreHorizontal, Pencil, Plus, Power } from "lucide-react";

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
import { BranchFormDialog } from "@/features/branches/branch-form-dialog";
import { useBranches, useSetBranchStatus } from "@/features/branches/hooks";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import type { BranchRow } from "@/lib/database.types";

export const Route = createFileRoute("/_app/settings/branches")({
  component: BranchesPage,
});

function BranchesPage() {
  return (
    <RequirePermission require={PERMISSIONS.SETTINGS_BRANCHES_MANAGE} what="branch settings">
      <BranchesScreen />
    </RequirePermission>
  );
}

function BranchesScreen() {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.SETTINGS_BRANCHES_MANAGE);

  const [includeInactive, setIncludeInactive] = useState(false);
  const [editing, setEditing] = useState<BranchRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deactivating, setDeactivating] = useState<BranchRow | null>(null);

  const branches = useBranches(includeInactive);
  const setStatus = useSetBranchStatus();

  const columns = useMemo<ColumnDef<BranchRow, unknown>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => (
          <span className="num font-medium">{row.original.code}</span>
        ),
      },
      {
        accessorKey: "name",
        header: "Branch",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.name}</span>
            {row.original.is_head_office && (
              <Badge variant="secondary" className="text-[10px]">
                Head office
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: "city",
        header: "City",
        cell: ({ row }) => row.original.city ?? <span className="text-muted-foreground">—</span>,
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => (
          <span className="num text-xs">
            {row.original.phone ?? <span className="text-muted-foreground">—</span>}
          </span>
        ),
      },
      {
        accessorKey: "currency_code",
        header: "Currency",
        cell: ({ row }) => <span className="num">{row.original.currency_code}</span>,
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
          const branch = row.original;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Actions for ${branch.name}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditing(branch);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="size-4" />
                    Edit branch
                  </DropdownMenuItem>
                  {branch.status === "active" ? (
                    <DropdownMenuItem
                      onSelect={() => setDeactivating(branch)}
                      disabled={branch.is_head_office}
                    >
                      <Power className="size-4" />
                      Deactivate
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onSelect={() =>
                        setStatus.mutate({ id: branch.id, status: "active" })
                      }
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
        title="Branches"
        description="Trading locations. Every transaction, warehouse and user is scoped to one."
        breadcrumbs={[{ label: "Settings" }, { label: "Branches" }]}
        actions={
          canManage && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              New branch
            </Button>
          )
        }
      />

      <DataTable
        columns={columns}
        data={branches.data}
        isLoading={branches.isLoading}
        error={branches.error}
        onRetry={() => void branches.refetch()}
        searchPlaceholder="Search branches by name, code or city…"
        emptyTitle="No branches yet"
        emptyDescription="Add your first branch to start scoping stock, sales and users."
        emptyAction={
          canManage && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              New branch
            </Button>
          )
        }
        toolbar={
          <div className="flex items-center gap-2">
            <Switch
              id="include-inactive"
              checked={includeInactive}
              onCheckedChange={setIncludeInactive}
            />
            <Label htmlFor="include-inactive" className="text-xs font-normal text-muted-foreground">
              Show inactive
            </Label>
          </div>
        }
      />

      <BranchFormDialog open={formOpen} onOpenChange={setFormOpen} branch={editing} />

      <AlertDialog
        open={Boolean(deactivating)}
        onOpenChange={(open) => !open && setDeactivating(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deactivating?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The branch stops appearing in pickers and its warehouses become unavailable for new
              transactions. Nothing is deleted — historical records keep referencing it, and you can
              reactivate at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deactivating) {
                  setStatus.mutate({ id: deactivating.id, status: "inactive" });
                }
                setDeactivating(null);
              }}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Building2 className="size-3.5" aria-hidden />
        Branches are never deleted. Deactivate instead, so history stays intact.
      </p>
    </>
  );
}
