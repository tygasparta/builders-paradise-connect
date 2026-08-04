import { Link, createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import {
  Building2,
  ScrollText,
  ShieldCheck,
  UserCheck,
  Warehouse as WarehouseIcon,
} from "lucide-react";

import { PageHeader } from "@/components/erp/page-header";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/erp/states";
import { StatCard, SectionCard } from "@/components/erp/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOrganisationStats, useRecentActivity } from "@/features/dashboard/hooks";
import { useAuth } from "@/lib/auth/auth-context";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { profile, roles } = useAuth();
  const { can } = usePermissions();
  const stats = useOrganisationStats();
  const activity = useRecentActivity();

  const firstName = profile?.full_name.split(" ")[0] ?? "there";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <PageHeader
        title={`Good day, ${firstName}`}
        description={today}
        breadcrumbs={[{ label: "Dashboard" }]}
        actions={
          <div className="flex flex-wrap gap-1.5">
            {roles.map((role) => (
              <Badge key={role.code} variant="secondary">
                {role.name}
              </Badge>
            ))}
          </div>
        }
      />

      {stats.isLoading ? (
        <CardsSkeleton count={4} />
      ) : stats.isError ? (
        <div className="card-surface">
          <ErrorState
            title="The dashboard could not load"
            error={stats.error}
            onRetry={() => void stats.refetch()}
          />
        </div>
      ) : (
        <section aria-label="Organisation" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Active branches"
            value={String(stats.data?.branches ?? 0)}
            sub="Trading locations"
            icon={<Building2 className="size-4" />}
            tone="primary"
          />
          <StatCard
            label="Active warehouses"
            value={String(stats.data?.warehouses ?? 0)}
            sub={`${stats.data?.locations ?? 0} storage locations`}
            icon={<WarehouseIcon className="size-4" />}
            tone="primary"
          />
          <StatCard
            label="Active users"
            value={String(stats.data?.activeUsers ?? 0)}
            sub={`${stats.data?.users ?? 0} accounts in total`}
            icon={<UserCheck className="size-4" />}
            tone="success"
          />
          <StatCard
            label="Roles configured"
            value={String(stats.data?.roles ?? 0)}
            sub="Permission profiles"
            icon={<ShieldCheck className="size-4" />}
          />
        </section>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {can(PERMISSIONS.AUDIT_VIEW) && (
          <SectionCard
            title="Recent activity"
            description="Every change, with the person who made it"
            className="lg:col-span-2"
            bodyClassName="p-0"
            actions={
              <Button variant="outline" size="sm" asChild>
                <Link to="/audit-trail">View all</Link>
              </Button>
            }
          >
            {activity.isLoading ? (
              <div className="p-5">
                <CardsSkeleton count={1} />
              </div>
            ) : activity.isError ? (
              <ErrorState error={activity.error} onRetry={() => void activity.refetch()} />
            ) : (activity.data?.length ?? 0) === 0 ? (
              <EmptyState
                icon={<ScrollText className="size-5" />}
                title="No activity recorded yet"
                description="Changes to branches, warehouses, users and roles appear here as they happen."
              />
            ) : (
              <ul className="divide-y divide-border">
                {activity.data?.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3 px-5 py-3">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{entry.user_email ?? "System"}</span>{" "}
                        <span className="text-muted-foreground">
                          {actionVerb(entry.action)} {readableTable(entry.table_name)}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {entry.module} ·{" "}
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}

        <SectionCard
          title="Build status"
          description="What is live, and what comes next"
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border text-sm">
            {[
              { phase: 1, label: "Foundation, access control, organisation", done: true },
              { phase: 2, label: "Products, stock, purchasing and GRNs", done: false },
              { phase: 3, label: "Customers, POS, sales and receipts", done: false },
              { phase: 4, label: "Accounting, banking and reconciliation", done: false },
              { phase: 5, label: "Employees, leave and payroll", done: false },
              { phase: 6, label: "Reports, exports and notifications", done: false },
            ].map((row) => (
              <li key={row.phase} className="flex items-start gap-3 px-5 py-3">
                <span
                  className={
                    row.done
                      ? "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success text-[10px] font-bold text-success-foreground"
                      : "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-border text-[10px] font-semibold text-muted-foreground"
                  }
                  aria-hidden
                >
                  {row.done ? "✓" : row.phase}
                </span>
                <div className="min-w-0">
                  <p className={row.done ? "font-medium" : "text-muted-foreground"}>{row.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.done ? "Live" : `Phase ${row.phase}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Trading figures — sales, purchases, gross profit, cash and bank balances — appear here once
        Phase 2 and Phase 3 put real transactions in the database. Nothing on this dashboard is a
        placeholder number.
      </p>
    </>
  );
}

function actionVerb(action: string): string {
  const map: Record<string, string> = {
    insert: "created",
    update: "updated",
    delete: "deleted",
    login: "signed in",
    login_failed: "failed to sign in",
    logout: "signed out",
    approve: "approved",
    reject: "rejected",
    post: "posted",
    reverse: "reversed",
  };
  return map[action] ?? action;
}

function readableTable(table: string | null): string {
  if (!table) return "";
  return `a ${table.replace(/_/g, " ").replace(/s$/, "")} record`;
}
