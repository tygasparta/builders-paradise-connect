import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  Building2,
  Download,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  UserCheck,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { HeroBanner } from "@/components/erp/hero-banner";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/erp/states";
import { StatCard, SectionCard } from "@/components/erp/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useOrganisationStats,
  useRecentActivity,
  useUsersByRole,
  useWarehousesByBranch,
} from "@/features/dashboard/hooks";
import { useUnreadNotifications } from "@/features/audit/hooks";
import { useCompanySettings } from "@/features/settings/hooks";
import { plural, readableRecord } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import { useAuth } from "@/lib/auth/auth-context";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
});

const ACTIVITY_SIZES = [8, 15, 30] as const;

function DashboardPage() {
  const { profile, roles } = useAuth();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const { data: settings } = useCompanySettings();

  const [activitySize, setActivitySize] = useState<number>(8);

  const primaryRole = roles.slice().sort((a, b) => a.rank - b.rank)[0];
  const stats = useOrganisationStats();
  const activity = useRecentActivity(activitySize);
  const usersByRole = useUsersByRole();
  const warehousesByBranch = useWarehousesByBranch();
  const notifications = useUnreadNotifications();

  const canSeeAudit = can(PERMISSIONS.AUDIT_VIEW);
  const canExport = can(PERMISSIONS.REPORTS_EXPORT);

  const firstName = profile?.full_name.split(" ")[0] ?? "there";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const refreshing =
    stats.isFetching ||
    activity.isFetching ||
    usersByRole.isFetching ||
    warehousesByBranch.isFetching;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    toast.success("Dashboard refreshed");
  };

  /** Exports exactly what is on screen — no hidden or invented rows. */
  const exportSummary = () => {
    const rows: { metric: string; value: string; detail: string }[] = [
      {
        metric: "Active branches",
        value: String(stats.data?.branches ?? 0),
        detail: "Trading locations",
      },
      {
        metric: "Active warehouses",
        value: String(stats.data?.warehouses ?? 0),
        detail: plural(stats.data?.locations ?? 0, "storage location"),
      },
      {
        metric: "Active users",
        value: String(stats.data?.activeUsers ?? 0),
        detail: `${plural(stats.data?.users ?? 0, "account")} in total`,
      },
      {
        metric: "Roles configured",
        value: String(stats.data?.roles ?? 0),
        detail: "Permission profiles",
      },
      ...(usersByRole.data ?? []).map((row) => ({
        metric: `Users — ${row.role}`,
        value: String(row.count),
        detail: "Role assignment",
      })),
      ...(warehousesByBranch.data ?? []).map((row) => ({
        metric: `Warehouses — ${row.branch}`,
        value: String(row.warehouses),
        detail: plural(row.locations, "storage location"),
      })),
    ];

    downloadCsv("Dashboard summary", rows, [
      { header: "Metric", value: (r) => r.metric },
      { header: "Value", value: (r) => r.value },
      { header: "Detail", value: (r) => r.detail },
      { header: "Exported at", value: () => new Date().toISOString() },
      { header: "Exported by", value: () => profile?.email ?? "" },
    ]);
    toast.success("Dashboard summary exported");
  };

  const chartColours = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];

  const roleChartData = useMemo(
    () => (usersByRole.data ?? []).map((row) => ({ name: row.role, value: row.count })),
    [usersByRole.data],
  );

  return (
    <>
      <HeroBanner
        eyebrow={`${primaryRole?.name ?? "Signed in"} · Control centre`}
        title={`${settings?.company_name ?? "Builders Paradise"} — Enterprise Overview`}
        stats={[
          `Good day, ${firstName}`,
          today,
          stats.data ? plural(stats.data.activeUsers, "active user") : null,
          stats.data ? plural(stats.data.branches, "branch", "branches") : null,
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={refresh}
              disabled={refreshing}
              className="border-0 bg-white/15 text-white hover:bg-white/25"
            >
              <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} aria-hidden />
              Refresh
            </Button>
            {canExport && (
              <Button
                size="sm"
                onClick={exportSummary}
                className="border-0 bg-white/15 text-white hover:bg-white/25"
              >
                <Download className="size-4" aria-hidden />
                Export
              </Button>
            )}
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
          <Link to="/settings/branches" className="rounded-xl focus-visible:outline-none">
            <StatCard
              label="Active branches"
              value={String(stats.data?.branches ?? 0)}
              sub="Trading locations"
              icon={<Building2 className="size-4" />}
              tone="primary"
            />
          </Link>
          <Link to="/warehouses" className="rounded-xl focus-visible:outline-none">
            <StatCard
              label="Active warehouses"
              value={String(stats.data?.warehouses ?? 0)}
              sub={plural(stats.data?.locations ?? 0, "storage location")}
              icon={<WarehouseIcon className="size-4" />}
              tone="primary"
            />
          </Link>
          <Link to="/users" className="rounded-xl focus-visible:outline-none">
            <StatCard
              label="Active users"
              value={String(stats.data?.activeUsers ?? 0)}
              sub={`${plural(stats.data?.users ?? 0, "account")} in total`}
              icon={<UserCheck className="size-4" />}
              tone="success"
            />
          </Link>
          <Link to="/users" className="rounded-xl focus-visible:outline-none">
            <StatCard
              label="Roles configured"
              value={String(stats.data?.roles ?? 0)}
              sub="Permission profiles"
              icon={<ShieldCheck className="size-4" />}
            />
          </Link>
        </section>
      )}

      {/* Charts — both driven by live rows, not sample series. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Users by role"
          description="Where system access currently sits"
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link to="/users">Manage</Link>
            </Button>
          }
        >
          {usersByRole.isLoading ? (
            <CardsSkeleton count={1} />
          ) : usersByRole.isError ? (
            <ErrorState error={usersByRole.error} onRetry={() => void usersByRole.refetch()} />
          ) : roleChartData.length === 0 ? (
            <EmptyState
              title="No roles assigned yet"
              description="Assign a role on the Users & Roles screen and it appears here."
            />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roleChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                    stroke="var(--color-card)"
                    strokeWidth={2}
                  >
                    {roleChartData.map((entry, index) => (
                      <Cell key={entry.name} fill={chartColours[index % chartColours.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => [plural(value, "user"), name]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(value: string) => (
                      <span style={{ fontSize: 12, color: "var(--color-muted-foreground)" }}>
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Warehouse coverage"
          description="Active warehouses and storage locations per branch"
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link to="/warehouses">Manage</Link>
            </Button>
          }
        >
          {warehousesByBranch.isLoading ? (
            <CardsSkeleton count={1} />
          ) : warehousesByBranch.isError ? (
            <ErrorState
              error={warehousesByBranch.error}
              onRetry={() => void warehousesByBranch.refetch()}
            />
          ) : (warehousesByBranch.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No active warehouses"
              description="Add a warehouse and its coverage appears here."
            />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={warehousesByBranch.data ?? []}
                  margin={{ top: 4, right: 8, bottom: 4, left: -18 }}
                >
                  <XAxis
                    dataKey="branch"
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)" }}
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(value: string) => (
                      <span style={{ fontSize: 12, color: "var(--color-muted-foreground)" }}>
                        {value}
                      </span>
                    )}
                  />
                  <Bar
                    dataKey="warehouses"
                    name="Warehouses"
                    fill="var(--chart-1)"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="locations"
                    name="Storage locations"
                    fill="var(--chart-3)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {canSeeAudit && (
          <SectionCard
            title="Recent activity"
            description="Every change, with the person who made it"
            className="lg:col-span-2"
            bodyClassName="p-0"
            actions={
              <div className="flex items-center gap-2">
                <Select
                  value={String(activitySize)}
                  onValueChange={(value) => setActivitySize(Number(value))}
                >
                  <SelectTrigger className="h-8 w-24" aria-label="Number of activity entries">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_SIZES.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        Last {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/audit-trail">View all</Link>
                </Button>
              </div>
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
                    <span
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-td">
                        <span className="font-medium">{entry.user_email ?? "System"}</span>{" "}
                        <span className="text-muted-foreground">
                          {actionVerb(entry.action)} {readableRecord(entry.table_name)}
                        </span>
                      </p>
                      <p className="mt-0.5 text-helper text-muted-foreground">
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

        <div className="space-y-4">
          <SectionCard
            title="Notifications"
            description="Items addressed to you"
            bodyClassName="p-0"
          >
            {notifications.isLoading ? (
              <div className="p-5">
                <CardsSkeleton count={1} />
              </div>
            ) : (notifications.data?.rows.length ?? 0) === 0 ? (
              <EmptyState
                icon={<Bell className="size-5" />}
                title="Nothing needs you"
                description="Low stock, approvals and overdue invoices will appear here."
              />
            ) : (
              <ul className="divide-y divide-border">
                {notifications.data?.rows.map((note) => (
                  <li key={note.id} className="px-5 py-3">
                    <p className="text-td font-medium">{note.title}</p>
                    {note.body && (
                      <p className="mt-0.5 text-helper text-muted-foreground">{note.body}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Build status"
            description="What is live, and what comes next"
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-border text-td">
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
                        ? "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success text-helper font-bold text-success-foreground"
                        : "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-border text-helper font-semibold text-muted-foreground"
                    }
                    aria-hidden
                  >
                    {row.done ? "✓" : row.phase}
                  </span>
                  <div className="min-w-0">
                    <p className={row.done ? "font-medium" : "text-muted-foreground"}>
                      {row.label}
                    </p>
                    <p className="text-helper text-muted-foreground">
                      {row.done ? "Live" : `Phase ${row.phase}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>

      <p className="mt-4 text-helper text-muted-foreground">
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
