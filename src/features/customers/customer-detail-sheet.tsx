import { useMemo } from "react";
import { format } from "date-fns";
import { Download, FileText, Receipt, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/erp/states";
import { AgingBar } from "@/components/erp/aging-bar";
import { ageDocuments, creditUtilisation } from "@/lib/aging";
import { downloadCsv } from "@/lib/export";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import type { CustomerRow } from "@/lib/database.types";
import { useCustomerActivity } from "./hooks";

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const SETTLED = new Set(["paid", "cancelled", "draft", "awaiting_approval", "approved"]);

export function CustomerDetailSheet({
  customer,
  balance,
  onOpenChange,
}: {
  customer: CustomerRow | null;
  balance: number;
  onOpenChange: (open: boolean) => void;
}) {
  const { can } = usePermissions();
  const canExport = can(PERMISSIONS.REPORTS_EXPORT);
  const activity = useCustomerActivity(customer?.id ?? null);

  /**
   * Only posted, unsettled invoices age. A draft has not been issued and
   * a paid one owes nothing — including either would overstate the debt.
   */
  const openInvoices = useMemo(
    () =>
      (activity.data?.invoices ?? []).filter(
        (invoice) =>
          !SETTLED.has(invoice.status) && Number(invoice.total) - Number(invoice.amount_paid) > 0,
      ),
    [activity.data],
  );

  const aging = useMemo(
    () =>
      ageDocuments(
        openInvoices.map((invoice) => ({
          dueDate: invoice.due_date,
          documentDate: invoice.invoice_date,
          outstanding: Number(invoice.total) - Number(invoice.amount_paid),
        })),
      ),
    [openInvoices],
  );

  const credit = creditUtilisation(
    customer?.credit_limit === null || customer?.credit_limit === undefined
      ? null
      : Number(customer.credit_limit),
    balance,
  );

  const exportStatement = () => {
    if (!customer) return;
    const rows = [
      ...(activity.data?.invoices ?? []).map((i) => ({
        date: i.invoice_date,
        type: "Invoice",
        reference: i.invoice_no,
        detail: i.payment_type,
        debit: Number(i.total),
        credit: 0,
      })),
      ...(activity.data?.receipts ?? []).map((r) => ({
        date: r.receipt_date,
        type: "Receipt",
        reference: r.receipt_no,
        detail: r.payment_method,
        debit: 0,
        credit: Number(r.amount),
      })),
      ...(activity.data?.creditNotes ?? []).map((c) => ({
        date: c.return_date,
        type: "Credit note",
        reference: c.return_no,
        detail: c.reason,
        debit: 0,
        credit: Number(c.total),
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    downloadCsv(`Statement ${customer.code}`, rows, [
      { header: "Date", value: (r) => r.date },
      { header: "Type", value: (r) => r.type },
      { header: "Reference", value: (r) => r.reference },
      { header: "Detail", value: (r) => r.detail },
      { header: "Debit", value: (r) => (r.debit === 0 ? "" : r.debit.toFixed(2)) },
      { header: "Credit", value: (r) => (r.credit === 0 ? "" : r.credit.toFixed(2)) },
    ]);
    toast.success("Statement exported");
  };

  return (
    <Sheet open={Boolean(customer)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{customer?.name}</SheetTitle>
          <SheetDescription>
            <span className="num">{customer?.code}</span>
            {customer?.contact_person ? ` · ${customer.contact_person}` : ""}
            {customer?.phone ? ` · ${customer.phone}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          {/* Position */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card-surface p-3">
              <p className="text-[11px] text-muted-foreground">Balance owing</p>
              <p
                className={
                  credit.overLimit
                    ? "num mt-0.5 text-lg font-semibold text-destructive"
                    : "num mt-0.5 text-lg font-semibold"
                }
              >
                {money(balance)}
              </p>
            </div>
            <div className="card-surface p-3">
              <p className="text-[11px] text-muted-foreground">Credit limit</p>
              <p className="num mt-0.5 text-lg font-semibold">
                {customer?.credit_limit === null ? "Cash only" : money(customer?.credit_limit)}
              </p>
            </div>
            <div className="card-surface p-3">
              <p className="text-[11px] text-muted-foreground">
                {credit.limited ? "Available" : "Terms"}
              </p>
              <p className="num mt-0.5 text-lg font-semibold">
                {credit.limited
                  ? money(credit.available)
                  : customer?.payment_terms_days === 0
                    ? "On delivery"
                    : `${customer?.payment_terms_days}d`}
              </p>
            </div>
          </div>

          {credit.limited && (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Credit used</span>
                <span
                  className={
                    credit.overLimit ? "num font-semibold text-destructive" : "num font-medium"
                  }
                >
                  {credit.percent.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={credit.overLimit ? "h-full bg-destructive" : "h-full bg-primary"}
                  style={{ width: `${Math.min(100, Math.max(0, credit.percent))}%` }}
                />
              </div>
              {credit.overLimit && (
                <p className="mt-1 text-[11px] text-destructive">
                  Over limit by {money(Math.abs(credit.available))} — new credit sales need
                  approval.
                </p>
              )}
            </div>
          )}

          {/* Aging */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Aging</h3>
              {canExport && (
                <Button variant="outline" size="sm" onClick={exportStatement}>
                  <Download className="size-3.5" />
                  Statement
                </Button>
              )}
            </div>
            {activity.isLoading ? (
              <TableSkeleton columns={5} rows={1} />
            ) : (
              <div className="card-surface p-3">
                <AgingBar summary={aging} />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  By days past due, not document age. Unposted and settled invoices are excluded.
                </p>
              </div>
            )}
          </section>

          {/* Activity */}
          {activity.isError ? (
            <ErrorState error={activity.error} onRetry={() => void activity.refetch()} />
          ) : (
            <Tabs defaultValue="invoices">
              <TabsList>
                <TabsTrigger value="invoices">Invoices</TabsTrigger>
                <TabsTrigger value="receipts">Receipts</TabsTrigger>
                <TabsTrigger value="credits">Credit notes</TabsTrigger>
              </TabsList>

              <TabsContent value="invoices" className="mt-3">
                {activity.isLoading ? (
                  <TableSkeleton columns={4} rows={4} />
                ) : (activity.data?.invoices.length ?? 0) === 0 ? (
                  <EmptyState
                    icon={<FileText className="size-5" />}
                    title="No invoices yet"
                    description="Invoices raised against this customer appear here."
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {activity.data?.invoices.map((invoice) => {
                      const outstanding = Number(invoice.total) - Number(invoice.amount_paid);
                      return (
                        <li
                          key={invoice.id}
                          className="flex items-start justify-between gap-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="num text-xs font-medium">{invoice.invoice_no}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {format(new Date(invoice.invoice_date), "dd MMM yyyy")}
                              {invoice.due_date
                                ? ` · due ${format(new Date(invoice.due_date), "dd MMM")}`
                                : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="num text-sm font-medium">{money(invoice.total)}</p>
                            {outstanding > 0 && !SETTLED.has(invoice.status) ? (
                              <p className="num text-[11px] text-destructive">
                                {money(outstanding)} owing
                              </p>
                            ) : (
                              <Badge variant="secondary" className="mt-0.5 text-[10px]">
                                {invoice.status}
                              </Badge>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="receipts" className="mt-3">
                {activity.isLoading ? (
                  <TableSkeleton columns={3} rows={3} />
                ) : (activity.data?.receipts.length ?? 0) === 0 ? (
                  <EmptyState
                    icon={<Receipt className="size-5" />}
                    title="No receipts yet"
                    description="Payments received from this customer appear here."
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {activity.data?.receipts.map((receipt) => (
                      <li
                        key={receipt.id}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="num text-xs font-medium">{receipt.receipt_no}</p>
                          <p className="text-[11px] capitalize text-muted-foreground">
                            {format(new Date(receipt.receipt_date), "dd MMM yyyy")} ·{" "}
                            {receipt.payment_method.replace(/_/g, " ")}
                          </p>
                        </div>
                        <span className="num text-sm font-medium text-success">
                          {money(receipt.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="credits" className="mt-3">
                {activity.isLoading ? (
                  <TableSkeleton columns={3} rows={3} />
                ) : (activity.data?.creditNotes.length ?? 0) === 0 ? (
                  <EmptyState
                    icon={<RotateCcw className="size-5" />}
                    title="No credit notes"
                    description="Returns credited to this customer appear here."
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {activity.data?.creditNotes.map((credit) => (
                      <li key={credit.id} className="flex items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="num text-xs font-medium">{credit.return_no}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {format(new Date(credit.return_date), "dd MMM yyyy")} · {credit.reason}
                          </p>
                        </div>
                        <span className="num text-sm font-medium">−{money(credit.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
