import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  CheckCircle2,
  Download,
  FileText,
  MoreHorizontal,
  Plus,
  Receipt,
  RotateCcw,
  Send,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/erp/page-header";
import { DataTable } from "@/components/erp/data-table";
import { RequirePermission } from "@/components/erp/permission-gate";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { SalesDocumentDialog } from "@/features/sales/sales-document-dialog";
import { CreditNoteDialog } from "@/features/sales/credit-note-dialog";
import {
  useInvoices,
  usePostInvoice,
  usePostReturn,
  useQuotations,
  useSalesReturns,
  useSetInvoiceStatus,
  useSetQuotationStatus,
  useSetReturnStatus,
} from "@/features/sales/hooks";
import {
  INVOICE_STATUS_LABELS,
  QUOTATION_STATUS_LABELS,
  RETURN_STATUS_LABELS,
} from "@/features/sales/schema";
import type { InvoiceWithRefs, QuotationWithRefs, ReturnWithRefs } from "@/features/sales/api";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import type { InvoiceStatus, QuotationStatus, SalesReturnStatus } from "@/lib/database.types";
import { downloadCsv } from "@/lib/export";
import { plural } from "@/lib/format";

export const Route = createFileRoute("/_app/sales")({
  component: SalesPage,
});

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  awaiting_approval: "bg-warning/20 text-warning-foreground",
  sent: "bg-info/12 text-info",
  approved: "bg-info/12 text-info",
  accepted: "bg-success/12 text-success",
  posted: "bg-success/12 text-success",
  paid: "bg-success/12 text-success",
  partially_paid: "bg-warning/20 text-warning-foreground",
  overdue: "bg-destructive/12 text-destructive",
  declined: "bg-destructive/12 text-destructive",
  cancelled: "bg-destructive/12 text-destructive",
  expired: "bg-muted text-muted-foreground",
  converted: "bg-muted text-muted-foreground",
};

function StatusChip({ status, labels }: { status: string; labels: Record<string, string> }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-helper font-semibold ${
        TONE[status] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function SalesPage() {
  return (
    <RequirePermission require={PERMISSIONS.SALES_VIEW} what="sales">
      <SalesScreen />
    </RequirePermission>
  );
}

function SalesScreen() {
  const { can } = usePermissions();
  const canSeeInvoices = can(PERMISSIONS.SALES_INVOICES_VIEW);
  const canSeeQuotes = can(PERMISSIONS.QUOTATIONS_VIEW);
  const canSeeReturns = can(PERMISSIONS.SALES_RETURNS_VIEW);

  const [tab, setTab] = useState(
    canSeeInvoices ? "invoices" : canSeeQuotes ? "quotations" : "returns",
  );
  const [docDialog, setDocDialog] = useState<"invoice" | "quotation" | null>(null);

  return (
    <>
      <PageHeader
        title="Sales"
        description="Quotations, invoices and credit notes. Posting an invoice moves stock, revenue and cost of sales together."
        breadcrumbs={[{ label: "Trade" }, { label: "Sales" }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {can(PERMISSIONS.QUOTATIONS_CREATE) && (
              <Button variant="outline" onClick={() => setDocDialog("quotation")}>
                <Plus className="size-4" />
                New quotation
              </Button>
            )}
            {can(PERMISSIONS.SALES_INVOICES_CREATE) && (
              <Button onClick={() => setDocDialog("invoice")}>
                <Plus className="size-4" />
                New invoice
              </Button>
            )}
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {canSeeInvoices && <TabsTrigger value="invoices">Invoices</TabsTrigger>}
          {canSeeQuotes && <TabsTrigger value="quotations">Quotations</TabsTrigger>}
          {canSeeReturns && <TabsTrigger value="returns">Returns</TabsTrigger>}
        </TabsList>

        {canSeeInvoices && (
          <TabsContent value="invoices" className="mt-4">
            <InvoicesTab />
          </TabsContent>
        )}
        {canSeeQuotes && (
          <TabsContent value="quotations" className="mt-4">
            <QuotationsTab />
          </TabsContent>
        )}
        {canSeeReturns && (
          <TabsContent value="returns" className="mt-4">
            <ReturnsTab />
          </TabsContent>
        )}
      </Tabs>

      {docDialog && (
        <SalesDocumentDialog
          open={docDialog !== null}
          onOpenChange={(open) => !open && setDocDialog(null)}
          kind={docDialog}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------

function InvoicesTab() {
  const { can } = usePermissions();
  const canApprove = can(PERMISSIONS.SALES_INVOICES_APPROVE);
  const canPost = can(PERMISSIONS.SALES_INVOICES_POST);
  const canCancel = can(PERMISSIONS.SALES_INVOICES_CANCEL);
  const canReturn = can(PERMISSIONS.SALES_RETURNS_CREATE);
  const canExport = can(PERMISSIONS.REPORTS_EXPORT);
  const canSeeCost = can(PERMISSIONS.PRODUCTS_COST_PRICE_VIEW);

  const [status, setStatus] = useState("all");
  const [posting, setPosting] = useState<InvoiceWithRefs | null>(null);
  const [crediting, setCrediting] = useState<InvoiceWithRefs | null>(null);

  const invoices = useInvoices(status === "all" ? null : (status as InvoiceStatus));
  const setStatusMutation = useSetInvoiceStatus();
  const postInvoice = usePostInvoice();

  const exportInvoices = () => {
    const rows = invoices.data ?? [];
    downloadCsv("Sales invoices", rows, [
      { header: "Invoice", value: (i) => i.invoice_no },
      { header: "Date", value: (i) => i.invoice_date },
      { header: "Customer", value: (i) => i.customer?.name ?? i.customer_name },
      { header: "Payment", value: (i) => i.payment_type },
      { header: "Currency", value: (i) => i.currency_code },
      { header: "Subtotal", value: (i) => Number(i.subtotal).toFixed(2) },
      { header: "Tax", value: (i) => Number(i.tax_total).toFixed(2) },
      { header: "Total", value: (i) => Number(i.total).toFixed(2) },
      ...(canSeeCost
        ? [
            {
              header: "Cost of sales",
              value: (i: InvoiceWithRefs) => Number(i.cost_of_sales).toFixed(2),
            },
            {
              header: "Gross profit",
              value: (i: InvoiceWithRefs) =>
                (Number(i.total) - Number(i.tax_total) - Number(i.cost_of_sales)).toFixed(2),
            },
          ]
        : []),
      { header: "Status", value: (i) => INVOICE_STATUS_LABELS[i.status] ?? i.status },
    ]);
    toast.success(`${plural(rows.length, "invoice")} exported`);
  };

  const columns = useMemo<ColumnDef<InvoiceWithRefs, unknown>[]>(() => {
    const base: ColumnDef<InvoiceWithRefs, unknown>[] = [
      {
        accessorKey: "invoice_no",
        header: "Invoice",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="num text-helper font-medium">{row.original.invoice_no}</p>
            <p className="text-helper text-muted-foreground">
              {format(new Date(row.original.invoice_date), "dd MMM yyyy")}
            </p>
          </div>
        ),
      },
      {
        id: "customer",
        header: "Customer",
        accessorFn: (row) => row.customer?.name ?? row.customer_name ?? "",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">
              {row.original.customer?.name ?? row.original.customer_name ?? "Walk-in"}
            </p>
            <p className="text-helper capitalize text-muted-foreground">
              {row.original.payment_type}
            </p>
          </div>
        ),
      },
      {
        id: "lines",
        header: "Lines",
        accessorFn: (row) => row.sales_invoice_lines.length,
        cell: ({ row }) => (
          <span className="num text-td">{row.original.sales_invoice_lines.length}</span>
        ),
      },
      {
        accessorKey: "total",
        header: "Total",
        cell: ({ row }) => (
          <span className="num font-medium">
            {row.original.currency_code} {money(row.original.total)}
          </span>
        ),
      },
    ];

    if (canSeeCost) {
      base.push({
        id: "margin",
        header: "Gross profit",
        enableSorting: false,
        cell: ({ row }) => {
          const invoice = row.original;
          if (Number(invoice.cost_of_sales) === 0) {
            return <span className="text-helper text-muted-foreground">—</span>;
          }
          const net = Number(invoice.total) - Number(invoice.tax_total);
          const profit = net - Number(invoice.cost_of_sales);
          const percent = net === 0 ? 0 : (profit / net) * 100;
          return (
            <div>
              <p className={profit < 0 ? "num font-medium text-destructive" : "num font-medium"}>
                {money(profit)}
              </p>
              <p className="text-helper text-muted-foreground">{percent.toFixed(1)}%</p>
            </div>
          );
        },
      });
    }

    base.push({
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusChip status={row.original.status} labels={INVOICE_STATUS_LABELS} />,
    });

    base.push({
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const invoice = row.original;
        const isPosted = ["posted", "partially_paid", "paid", "overdue"].includes(invoice.status);
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Actions for ${invoice.invoice_no}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {invoice.status === "draft" && (
                  <DropdownMenuItem
                    onSelect={() =>
                      setStatusMutation.mutate({ id: invoice.id, status: "awaiting_approval" })
                    }
                  >
                    <Send className="size-4" />
                    Send for approval
                  </DropdownMenuItem>
                )}
                {canApprove && ["draft", "awaiting_approval"].includes(invoice.status) && (
                  <DropdownMenuItem
                    onSelect={() =>
                      setStatusMutation.mutate({ id: invoice.id, status: "approved" })
                    }
                  >
                    <CheckCircle2 className="size-4" />
                    Approve
                  </DropdownMenuItem>
                )}
                {canPost && invoice.status === "approved" && (
                  <DropdownMenuItem onSelect={() => setPosting(invoice)}>
                    <Upload className="size-4" />
                    Post invoice
                  </DropdownMenuItem>
                )}
                {canReturn && isPosted && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setCrediting(invoice)}>
                      <RotateCcw className="size-4" />
                      Raise credit note
                    </DropdownMenuItem>
                  </>
                )}
                {canCancel &&
                  ["draft", "awaiting_approval", "approved"].includes(invoice.status) && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() =>
                          setStatusMutation.mutate({ id: invoice.id, status: "cancelled" })
                        }
                      >
                        Cancel invoice
                      </DropdownMenuItem>
                    </>
                  )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    });

    return base;
  }, [canApprove, canPost, canCancel, canReturn, canSeeCost, setStatusMutation]);

  return (
    <>
      <DataTable
        columns={columns}
        data={invoices.data}
        isLoading={invoices.isLoading}
        error={invoices.error}
        onRetry={() => void invoices.refetch()}
        searchPlaceholder="Search by invoice number or customer…"
        emptyTitle="No invoices yet"
        emptyDescription="Raise an invoice, approve it, then post it to move stock and the ledger."
        pageSize={25}
        toolbar={
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-44" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={exportInvoices}
                disabled={!invoices.data?.length}
              >
                <Download className="size-4" />
                Export
              </Button>
            )}
          </div>
        }
      />

      <AlertDialog open={Boolean(posting)} onOpenChange={(open) => !open && setPosting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post {posting?.invoice_no}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deducts the stock, records the revenue and the cost of sales, and — for a credit
              sale — puts the amount on the customer&rsquo;s account. All of it happens in one
              transaction, and a posted invoice cannot be edited afterwards; corrections are made
              with a credit note.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (posting) postInvoice.mutate(posting.id);
                setPosting(null);
              }}
            >
              Post invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreditNoteDialog
        open={Boolean(crediting)}
        onOpenChange={(open) => !open && setCrediting(null)}
        invoice={crediting}
      />
    </>
  );
}

// ---------------------------------------------------------------------
// Quotations
// ---------------------------------------------------------------------

function QuotationsTab() {
  const { can } = usePermissions();
  const canCreate = can(PERMISSIONS.QUOTATIONS_CREATE);
  const [status, setStatus] = useState("all");
  const quotations = useQuotations(status === "all" ? null : (status as QuotationStatus));
  const setStatusMutation = useSetQuotationStatus();

  const columns = useMemo<ColumnDef<QuotationWithRefs, unknown>[]>(
    () => [
      {
        accessorKey: "quotation_no",
        header: "Quotation",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="num text-helper font-medium">{row.original.quotation_no}</p>
            <p className="text-helper text-muted-foreground">
              {format(new Date(row.original.quotation_date), "dd MMM yyyy")}
            </p>
          </div>
        ),
      },
      {
        id: "customer",
        header: "Customer",
        accessorFn: (row) => row.customer?.name ?? row.customer_name ?? "",
        cell: ({ row }) => (
          <span className="truncate font-medium">
            {row.original.customer?.name ?? row.original.customer_name ?? "Walk-in"}
          </span>
        ),
      },
      {
        id: "valid",
        header: "Valid until",
        accessorFn: (row) => row.valid_until ?? "",
        cell: ({ row }) => (
          <span className="num text-helper text-muted-foreground">
            {row.original.valid_until
              ? format(new Date(row.original.valid_until), "dd MMM yyyy")
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "total",
        header: "Total",
        cell: ({ row }) => (
          <span className="num font-medium">
            {row.original.currency_code} {money(row.original.total)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusChip status={row.original.status} labels={QUOTATION_STATUS_LABELS} />
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const quote = row.original;
          if (!canCreate) return null;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Actions for ${quote.quotation_no}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {quote.status === "draft" && (
                    <DropdownMenuItem
                      onSelect={() => setStatusMutation.mutate({ id: quote.id, status: "sent" })}
                    >
                      <Send className="size-4" />
                      Mark as sent
                    </DropdownMenuItem>
                  )}
                  {["draft", "sent"].includes(quote.status) && (
                    <>
                      <DropdownMenuItem
                        onSelect={() =>
                          setStatusMutation.mutate({ id: quote.id, status: "accepted" })
                        }
                      >
                        <CheckCircle2 className="size-4" />
                        Mark as accepted
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          setStatusMutation.mutate({ id: quote.id, status: "declined" })
                        }
                      >
                        Mark as declined
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [canCreate, setStatusMutation],
  );

  return (
    <DataTable
      columns={columns}
      data={quotations.data}
      isLoading={quotations.isLoading}
      error={quotations.error}
      onRetry={() => void quotations.refetch()}
      searchPlaceholder="Search by quotation number or customer…"
      emptyTitle="No quotations yet"
      emptyDescription="A quotation reserves nothing and moves no stock — it is a priced offer."
      pageSize={25}
      toolbar={
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(QUOTATION_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  );
}

// ---------------------------------------------------------------------
// Returns / credit notes
// ---------------------------------------------------------------------

function ReturnsTab() {
  const { can } = usePermissions();
  const canApprove = can(PERMISSIONS.SALES_RETURNS_APPROVE);
  const [status, setStatus] = useState("all");
  const [posting, setPosting] = useState<ReturnWithRefs | null>(null);

  const returns = useSalesReturns(status === "all" ? null : (status as SalesReturnStatus));
  const setStatusMutation = useSetReturnStatus();
  const postReturn = usePostReturn();

  const columns = useMemo<ColumnDef<ReturnWithRefs, unknown>[]>(
    () => [
      {
        accessorKey: "return_no",
        header: "Credit note",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="num text-helper font-medium">{row.original.return_no}</p>
            <p className="text-helper text-muted-foreground">
              {format(new Date(row.original.return_date), "dd MMM yyyy")}
            </p>
          </div>
        ),
      },
      {
        id: "against",
        header: "Against",
        accessorFn: (row) => row.invoice?.invoice_no ?? "",
        cell: ({ row }) => (
          <span className="num text-helper">{row.original.invoice?.invoice_no ?? "—"}</span>
        ),
      },
      {
        id: "customer",
        header: "Customer",
        accessorFn: (row) => row.customer?.name ?? row.customer_name ?? "",
        cell: ({ row }) => (
          <span className="truncate">
            {row.original.customer?.name ?? row.original.customer_name ?? "Walk-in"}
          </span>
        ),
      },
      {
        id: "reason",
        header: "Reason",
        accessorFn: (row) => row.reason,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-td">{row.original.reason}</p>
            <p className="text-helper text-muted-foreground">
              {row.original.restock ? "Restocked" : "Not restocked"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "total",
        header: "Credit",
        cell: ({ row }) => <span className="num font-medium">{money(row.original.total)}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusChip status={row.original.status} labels={RETURN_STATUS_LABELS} />
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const credit = row.original;
          if (!canApprove) return null;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Actions for ${credit.return_no}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {credit.status === "draft" && (
                    <DropdownMenuItem
                      onSelect={() =>
                        setStatusMutation.mutate({ id: credit.id, status: "approved" })
                      }
                    >
                      <CheckCircle2 className="size-4" />
                      Approve
                    </DropdownMenuItem>
                  )}
                  {credit.status === "approved" && (
                    <DropdownMenuItem onSelect={() => setPosting(credit)}>
                      <Upload className="size-4" />
                      Post credit note
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [canApprove, setStatusMutation],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={returns.data}
        isLoading={returns.isLoading}
        error={returns.error}
        onRetry={() => void returns.refetch()}
        searchPlaceholder="Search by credit note, invoice or customer…"
        emptyTitle="No credit notes yet"
        emptyDescription="Raise one from a posted invoice on the Invoices tab."
        pageSize={25}
        toolbar={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-44" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(RETURN_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <AlertDialog open={Boolean(posting)} onOpenChange={(open) => !open && setPosting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post {posting?.return_no}?</AlertDialogTitle>
            <AlertDialogDescription>
              {posting?.restock
                ? "The goods go back into stock at the cost the original sale left at, the customer is credited, and the revenue and cost of sales are reversed."
                : "The customer is credited and the revenue is reversed. Nothing returns to stock, because this credit note is marked not restocked."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (posting) postReturn.mutate(posting.id);
                setPosting(null);
              }}
            >
              Post credit note
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
