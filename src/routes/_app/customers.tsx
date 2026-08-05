import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Download,
  Eye,
  MoreHorizontal,
  PauseCircle,
  Pencil,
  Plus,
  Power,
  Users,
} from "lucide-react";
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
import { CustomerFormDialog } from "@/features/customers/customer-form-dialog";
import { CustomerDetailSheet } from "@/features/customers/customer-detail-sheet";
import {
  useCustomerBalances,
  useCustomers,
  useSetCustomerStatus,
} from "@/features/customers/hooks";
import { CUSTOMER_TYPES, creditHeadroom } from "@/features/customers/schema";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import { downloadCsv } from "@/lib/export";
import { plural } from "@/lib/format";
import type { CustomerRow } from "@/lib/database.types";

export const Route = createFileRoute("/_app/customers")({
  component: CustomersPage,
});

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const typeLabel = (value: string) => CUSTOMER_TYPES.find((t) => t.value === value)?.label ?? value;

function CustomersPage() {
  return (
    <RequirePermission require={PERMISSIONS.CUSTOMERS_VIEW} what="customers">
      <CustomersScreen />
    </RequirePermission>
  );
}

function CustomersScreen() {
  const { can } = usePermissions();
  const canCreate = can(PERMISSIONS.CUSTOMERS_CREATE);
  const canUpdate = can(PERMISSIONS.CUSTOMERS_UPDATE);
  const canArchive = can(PERMISSIONS.CUSTOMERS_ARCHIVE);
  const canExport = can(PERMISSIONS.REPORTS_EXPORT);

  const [includeInactive, setIncludeInactive] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState<CustomerRow | null>(null);

  const customers = useCustomers(includeInactive);
  const setStatus = useSetCustomerStatus();

  const ids = useMemo(() => (customers.data ?? []).map((c) => c.id), [customers.data]);
  const balances = useCustomerBalances(ids);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const exportCustomers = () => {
    const rows = customers.data ?? [];
    downloadCsv("Customers", rows, [
      { header: "Code", value: (c) => c.code },
      { header: "Name", value: (c) => c.name },
      { header: "Type", value: (c) => typeLabel(c.customer_type) },
      { header: "Contact", value: (c) => c.contact_person },
      { header: "Phone", value: (c) => c.phone },
      { header: "Email", value: (c) => c.email },
      { header: "City", value: (c) => c.city },
      { header: "Currency", value: (c) => c.currency_code },
      { header: "Terms (days)", value: (c) => c.payment_terms_days },
      {
        header: "Credit limit",
        value: (c) => (c.credit_limit === null ? "Cash only" : Number(c.credit_limit).toFixed(2)),
      },
      {
        header: "Balance",
        value: (c) => (balances.data?.get(c.id) ?? 0).toFixed(2),
      },
      { header: "Status", value: (c) => c.status },
    ]);
    toast.success(`${plural(rows.length, "customer")} exported`);
  };

  const columns = useMemo<ColumnDef<CustomerRow, unknown>[]>(() => {
    const base: ColumnDef<CustomerRow, unknown>[] = [
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => <span className="num text-xs font-medium">{row.original.code}</span>,
      },
      {
        accessorKey: "name",
        header: "Customer",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {typeLabel(row.original.customer_type)}
              {row.original.city ? ` · ${row.original.city}` : ""}
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
        id: "terms",
        header: "Terms",
        accessorFn: (row) => row.payment_terms_days,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.payment_terms_days === 0
              ? "On delivery"
              : `${row.original.payment_terms_days} days`}
          </span>
        ),
      },
      {
        id: "balance",
        header: "Balance",
        enableSorting: false,
        cell: ({ row }) => {
          const balance = balances.data?.get(row.original.id) ?? 0;
          const credit = creditHeadroom(
            row.original.credit_limit === null ? null : Number(row.original.credit_limit),
            balance,
          );
          return (
            <div className="min-w-0">
              <p className={credit.overLimit ? "num font-semibold text-destructive" : "num"}>
                {money(balance)}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {!credit.limited
                  ? "Cash only"
                  : credit.overLimit
                    ? `${money(Math.abs(credit.headroom))} over limit`
                    : `${money(credit.headroom)} available`}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) =>
          row.original.status === "on_hold" ? (
            <Badge className="border-0 bg-warning/20 text-[11px] font-semibold text-warning-foreground">
              On hold
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
          const customer = row.original;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Actions for ${customer.name}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onSelect={() => setViewing(customer)}>
                    <Eye className="size-4" />
                    View account
                  </DropdownMenuItem>
                  {canUpdate && (
                    <DropdownMenuItem
                      onSelect={() => {
                        setEditing(customer);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                      Edit customer
                    </DropdownMenuItem>
                  )}
                  {canArchive && (
                    <>
                      <DropdownMenuSeparator />
                      {customer.status !== "active" && (
                        <DropdownMenuItem
                          onSelect={() => setStatus.mutate({ id: customer.id, status: "active" })}
                        >
                          <Power className="size-4" />
                          Reactivate
                        </DropdownMenuItem>
                      )}
                      {customer.status !== "on_hold" && (
                        <DropdownMenuItem
                          onSelect={() => setStatus.mutate({ id: customer.id, status: "on_hold" })}
                        >
                          <PauseCircle className="size-4" />
                          Place on hold
                        </DropdownMenuItem>
                      )}
                      {customer.status !== "inactive" && (
                        <DropdownMenuItem
                          onSelect={() => setStatus.mutate({ id: customer.id, status: "inactive" })}
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
  }, [canUpdate, canArchive, setStatus, balances.data]);

  return (
    <>
      <PageHeader
        title="Customers"
        description="Who you sell to. Balances are derived from posted invoices, receipts and credit notes."
        breadcrumbs={[{ label: "Relationships" }, { label: "Customers" }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {canExport && (
              <Button
                variant="outline"
                onClick={exportCustomers}
                disabled={!customers.data?.length}
              >
                <Download className="size-4" />
                Export
              </Button>
            )}
            {canCreate && (
              <Button onClick={openNew}>
                <Plus className="size-4" />
                New customer
              </Button>
            )}
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={customers.data}
        isLoading={customers.isLoading}
        error={customers.error}
        onRetry={() => void customers.refetch()}
        searchPlaceholder="Search by name, code, contact or city…"
        emptyTitle="No customers yet"
        emptyDescription="Add a customer, then raise a quotation or an invoice against them."
        emptyAction={
          canCreate ? (
            <Button onClick={openNew}>
              <Plus className="size-4" />
              New customer
            </Button>
          ) : undefined
        }
        pageSize={25}
        toolbar={
          <div className="flex items-center gap-2">
            <Switch
              id="include-inactive-customers"
              checked={includeInactive}
              onCheckedChange={setIncludeInactive}
            />
            <Label
              htmlFor="include-inactive-customers"
              className="text-xs font-normal text-muted-foreground"
            >
              Show archived and on hold
            </Label>
          </div>
        }
      />

      <CustomerFormDialog open={formOpen} onOpenChange={setFormOpen} customer={editing} />

      <CustomerDetailSheet
        customer={viewing}
        balance={viewing ? (balances.data?.get(viewing.id) ?? 0) : 0}
        onOpenChange={(open) => !open && setViewing(null)}
      />

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="size-3.5" aria-hidden />A blank credit limit means cash only. On hold
        blocks new credit sales without hiding history or stopping settlement of what is already
        owed.
      </p>
    </>
  );
}
