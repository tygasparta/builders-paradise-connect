import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Inbox,
  Loader2,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/erp/page-header";
import { RequirePermission } from "@/components/erp/permission-gate";
import { EmptyState, TableSkeleton } from "@/components/erp/states";
import { SectionCard } from "@/components/erp/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  APPROVAL_SOURCES,
  useDecide,
  usePendingApprovals,
  type ApprovalItem,
  type ApprovalSource,
} from "@/features/approvals/api";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/approvals")({
  component: ApprovalsPage,
});

function money(value: number | null, currency: string | null): string {
  if (value === null) return "";
  const formatted = Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${formatted}` : formatted;
}

const KIND_TONE: Record<string, string> = {
  leave: "bg-info/12 text-info",
  requisition: "bg-muted text-muted-foreground",
  purchase_order: "bg-primary/12 text-primary",
  grn: "bg-warning/20 text-warning-foreground",
  invoice: "bg-success/12 text-success",
  expense: "bg-destructive/12 text-destructive",
  payroll: "bg-primary/12 text-primary",
};

function ApprovalsPage() {
  return (
    <RequirePermission require={PERMISSIONS.APPROVALS_INBOX_VIEW} what="approvals">
      <ApprovalsScreen />
    </RequirePermission>
  );
}

function ApprovalsScreen() {
  const { can } = usePermissions();
  const decide = useDecide();

  const [rejecting, setRejecting] = useState<{
    item: ApprovalItem;
    source: ApprovalSource;
  } | null>(null);

  // Only ask for what this person can act on. Querying the rest would
  // return nothing under RLS anyway, and look like an error.
  const sources = useMemo(() => APPROVAL_SOURCES.filter((source) => can(source.permission)), [can]);

  const results = usePendingApprovals(sources);
  const loading = results.some((result) => result.isLoading);

  const groups = sources.map((source, index) => ({
    source,
    items: results[index]?.data ?? [],
    error: results[index]?.error ?? null,
  }));

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  if (sources.length === 0) {
    return (
      <>
        <PageHeader
          title="Approvals"
          description="Everything waiting on you, across every module."
          breadcrumbs={[{ label: "Control" }, { label: "Approvals" }]}
        />
        <div className="card-surface">
          <EmptyState
            icon={<ShieldAlert className="size-5" />}
            title="Nothing is routed to you"
            description="You hold no approval permissions, so no document waits on you. This is the inbox working, not an error."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Everything waiting on you. Acting here is the same transition as acting in the module itself."
        breadcrumbs={[{ label: "Control" }, { label: "Approvals" }]}
      />

      {loading ? (
        <div className="card-surface p-4">
          <TableSkeleton columns={4} rows={6} />
        </div>
      ) : total === 0 ? (
        <div className="card-surface">
          <EmptyState
            icon={<Inbox className="size-5" />}
            title="Nothing waiting"
            description="Every document in the areas you approve has been dealt with."
          />
        </div>
      ) : (
        <>
          <p className="mb-4 text-td text-muted-foreground">
            <span className="font-semibold text-foreground">{plural(total, "item")}</span> waiting
            across {plural(groups.filter((g) => g.items.length > 0).length, "area")}.
          </p>

          <div className="space-y-4">
            {groups
              .filter((group) => group.items.length > 0 || group.error)
              .map(({ source, items, error }) => (
                <SectionCard
                  key={source.kind}
                  title={source.label}
                  description={
                    error ? "Could not be loaded" : `${plural(items.length, "item")} waiting`
                  }
                  bodyClassName="p-0"
                  actions={
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={source.route}>
                        Open module
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  }
                >
                  {error ? (
                    <p className="px-5 py-4 text-td text-destructive">
                      {error instanceof Error ? error.message : "Could not load these."}
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {items.map((item) => (
                        <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                          <span
                            className={cn(
                              "hidden rounded-full px-2 py-0.5 text-helper font-semibold sm:inline-flex",
                              KIND_TONE[item.kind] ?? "bg-muted text-muted-foreground",
                            )}
                          >
                            {source.label}
                          </span>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-td font-medium">{item.title}</p>
                            <p className="num truncate text-helper text-muted-foreground">
                              {item.reference} · {item.subtitle}
                              {item.date ? ` · ${format(new Date(item.date), "dd MMM yyyy")}` : ""}
                            </p>
                          </div>

                          {item.amount !== null && (
                            <span className="num text-td font-semibold">
                              {money(item.amount, item.currency)}
                            </span>
                          )}

                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              className="h-8"
                              disabled={decide.isPending}
                              onClick={() => decide.mutate({ source, id: item.id, approve: true })}
                            >
                              {decide.isPending ? (
                                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                              ) : (
                                <CheckCircle2 className="size-3.5" />
                              )}
                              Approve
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Reject ${item.reference}`}
                              onClick={() => setRejecting({ item, source })}
                            >
                              <XCircle className="size-4" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </SectionCard>
              ))}
          </div>
        </>
      )}

      <AlertDialog open={Boolean(rejecting)} onOpenChange={(open) => !open && setRejecting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {rejecting?.item.reference}?</AlertDialogTitle>
            <AlertDialogDescription>
              {rejecting?.source.rejectedStatus === "cancelled"
                ? "This cancels the document. It stays on record but cannot be acted on further."
                : "This sends it back as rejected. Whoever raised it can amend and resubmit."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep waiting</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (rejecting) {
                  decide.mutate({
                    source: rejecting.source,
                    id: rejecting.item.id,
                    approve: false,
                  });
                }
                setRejecting(null);
              }}
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="mt-4 flex items-start gap-1.5 text-helper text-muted-foreground">
        <ClipboardCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          This inbox reads each module rather than keeping its own copy of what is pending, so it
          cannot disagree with the document. Approving here does not post anything — posting stays a
          separate, deliberate step in the module.
        </span>
      </p>
    </>
  );
}
