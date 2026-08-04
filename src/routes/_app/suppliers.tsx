import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Download, MoreHorizontal, Pencil, Plus, Power, Truck } from "lucide-react";
import { toast } from "sonner";

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
  DropdownMenuSeparator,
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
import { SupplierFormDialog } from "@/features/suppliers/supplier-form-dialog";
import { useSetSupplierStatus, useSuppliers } from "@/features/suppliers/hooks";
import { paymentTermsLabel } from "@/features/suppliers/schema";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import { downloadCsv } from "@/lib/export";
import { plural } from "@/lib/format";
import type { SupplierRow } from "@/lib/database.types";

export const Route = createFileRoute("/_app/suppliers")({
  component: SuppliersPage,
});

function SuppliersPage() {
  return (
    <RequirePermission require={PERMISSIONS.SUPPLIERS_VIEW} what="suppliers">
      <SuppliersScreen />
    </RequirePermission>
  );
}

function SuppliersScreen() {
  const { can } = usePermissions();
  const canCreate = can(PERMISSIONS.SUPPLIERS_CREATE);
  const canUpdate = can(PERMISSIONS.SUPPLIERS_UPDATE);
  const canArchive = can(PERMISSIONS.SUPPLIERS_ARCHIVE);
  const canExport = can(PERMISSIONS.REPORTS_EXPORT);

  const [includeInactive, setIncludeInactive] = useState(false);
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [blocking, setBlocking] = useState<SupplierRow | null>(null);

  const suppliers = useSuppliers(includeInactive);
  const setStatus = useSetSupplierStatus();

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const exportSuppliers = () => {
    const rows = suppliers.data ?? [];
    downloadCsv("Suppliers", rows, [
      { header: "Code", value: (s) => s.code },
      { header: "Name", value: (s) => s.name },
      { header: "Trading name", value: (s) => s.trading_name },
      { header: "Contact", value: (s) => s.contact_person },
      { header: "Phone", value: (s) => s.phone },
      { header: "Email", value: (s) => s.email },
      { header: "City", value: (s) => s.city },
      { header: "Country", value: (s) => s.country },
      { header: "Tax number", value: (s) => s.tax_number },
      { header: "Currency", value: (s) => s.currency_code },
      { header: "Payment terms", value: (s) => paymentTermsLabel(s.payment_terms_days) },
      {
        header: "Credit limit",
        value: (s) => (s.credit_limit === null ? "" : Number(s.credit_limit).toFixed(2)),
      },
      { header: "Opening balance", value: (s) => Number(s.opening_balance).toFixed(2) },
      { header: "Status", value: (s) => s.status },
      // Bank details are deliberately absent from the export. They arrive
      // nulled for users without payment permissions, and exporting them
      // would put account numbers in a file that leaves the system.
    ]);
    toast.success(`${plural(rows.length, "supplier")} exported`);
  };

  const columns = useMemo<ColumnDef<SupplierRow, unknown>[]>(() => {
    const base: ColumnDef<SupplierRow, unknown>[] = [
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => <span className="num text-xs font-medium">{row.original.code}</span>,
      },
      {
        accessorKey: "name",
        header: "Supplier",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.trading_name ?? row.original.city ?? row.original.country}
            </p>
          </div>
        ),
      },
      {
        id: "contact",
        header: "Contact",
        accessorFn: (row) => `${row.contact_person ?? ""} ${row.phone ?? ""} ${row.email ?? ""}`,
        cell: ({ row }) => (
          <div className="min-w-0 text-xs">
            <p className="truncate">{row.original.contact_person ?? "—"}</p>
            <p className="num truncate text-muted-foreground">{row.original.phone ?? ""}</p>
          </div>
        ),
      },
      {
        accessorKey: "payment_terms_days",
        header: "Terms",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {paymentTermsLabel(row.original.payment_terms_days)}
          </span>
        ),
      },
      {
        accessorKey: "currency_code",
        header: "Currency",
        cell: ({ row }) => <span className="num text-xs">{row.original.currency_code}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) =>
          row.original.status === "blocked" ? (
            <Badge className="border-0 bg-destructive/12 text-[11px] font-semibold text-destructive">
              Blocked
            </Badge>
          ) : (
            <StatusBadge status={row.original.status} />
          ),
      },
    ];

    if (canUpdate || canArchive) {
      base.push({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const supplier = row.original;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Actions for ${supplier.name}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {canUpdate && (
                    <DropdownMenuItem
                      onSelect={() => {
                        setEditing(supplier);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                      Edit supplier
                    </DropdownMenuItem>
                  )}
                  {canArchive && (
                    <>
                      <DropdownMenuSeparator />
                      {supplier.status !== "active" && (
                        <DropdownMenuItem
                          onSelect={() => setStatus.mutate({ id: supplier.id, status: "active" })}
                        >
                          <Power className="size-4" />
                          Reactivate
                        </DropdownMenuItem>
                      )}
                      {supplier.status !== "blocked" && (
                        <DropdownMenuItem onSelect={() => setBlocking(supplier)}>
                          <Ban className="size-4" />
                          Block supplier
                        </DropdownMenuItem>
                      )}
                      {supplier.status !== "inactive" && (
                        <DropdownMenuItem
                          onSelect={() => setStatus.mutate({ id: supplier.id, status: "inactive" })}
                        >
                          <Power className="size-4" />
                          Archive
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      });
    }

    return base;
  }, [canUpdate, canArchive, setStatus]);

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Who you buy from. Purchase orders, receipts, invoices and payments all reference these records."
        breadcrumbs={[{ label: "Relationships" }, { label: "Suppliers" }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {canExport && (
              <Button
                variant="outline"
                onClick={exportSuppliers}
                disabled={!suppliers.data?.length}
              >
                <Download className="size-4" />
                Export
              </Button>
            )}
            {canCreate && (
              <Button onClick={openNew}>
                <Plus className="size-4" />
                New supplier
              </Button>
            )}
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={suppliers.data}
        isLoading={suppliers.isLoading}
        error={suppliers.error}
        onRetry={() => void suppliers.refetch()}
        searchPlaceholder="Search by name, code, contact or city…"
        emptyTitle="No suppliers yet"
        emptyDescription="Add your first supplier, then raise a purchase order against them."
        emptyAction={
          canCreate && (
            <Button onClick={openNew}>
              <Plus className="size-4" />
              New supplier
            </Button>
          )
        }
        pageSize={25}
        toolbar={
          <div className="flex items-center gap-2">
            <Switch
              id="include-inactive-suppliers"
              checked={includeInactive}
              onCheckedChange={setIncludeInactive}
            />
            <Label
              htmlFor="include-inactive-suppliers"
              className="text-xs font-normal text-muted-foreground"
            >
              Show archived and blocked
            </Label>
          </div>
        }
      />

      <SupplierFormDialog open={formOpen} onOpenChange={setFormOpen} supplier={editing} />

      <AlertDialog open={Boolean(blocking)} onOpenChange={(open) => !open && setBlocking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block {blocking?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              No new purchase orders can be raised against a blocked supplier. Existing orders,
              receipts, invoices and their history are untouched, and outstanding invoices can still
              be paid. Use this for a supplier in dispute rather than archiving them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (blocking) setStatus.mutate({ id: blocking.id, status: "blocked" });
                setBlocking(null);
              }}
            >
              Block supplier
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Truck className="size-3.5" aria-hidden />
        Banking details are visible only to users who can create or approve supplier payments, and
        are never included in the export.
      </p>
    </>
  );
}
