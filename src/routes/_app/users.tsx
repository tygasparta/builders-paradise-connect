import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { MoreHorizontal, Plus, ShieldCheck, UserMinus, UserPlus, X } from "lucide-react";

import { PageHeader } from "@/components/erp/page-header";
import { DataTable, StatusBadge } from "@/components/erp/data-table";
import { RequirePermission } from "@/components/erp/permission-gate";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/erp/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/erp/form-field";
import { useAuth } from "@/lib/auth/auth-context";
import { usePermissions } from "@/lib/auth/use-permission";
import { MODULE_LABELS, PERMISSIONS } from "@/lib/permissions/catalog";
import {
  useAssignRole,
  usePermissionCatalogue,
  useRevokeRole,
  useRolePermissions,
  useRoles,
  useSetUserStatus,
  useUsers,
} from "@/features/users/hooks";
import { useBranches } from "@/features/branches/hooks";
import type { UserWithRoles } from "@/features/users/api";

export const Route = createFileRoute("/_app/users")({
  component: UsersPage,
});

function UsersPage() {
  return (
    <RequirePermission
      require={[PERMISSIONS.USERS_VIEW, PERMISSIONS.ROLES_VIEW]}
      what="users and roles"
    >
      <UsersScreen />
    </RequirePermission>
  );
}

function UsersScreen() {
  const { can } = usePermissions();

  return (
    <>
      <PageHeader
        title="Users & Roles"
        description="Who can sign in, and exactly what each of them is allowed to do."
        breadcrumbs={[{ label: "Control" }, { label: "Users & Roles" }]}
      />

      <Tabs defaultValue={can(PERMISSIONS.USERS_VIEW) ? "users" : "roles"}>
        <TabsList>
          {can(PERMISSIONS.USERS_VIEW) && <TabsTrigger value="users">Users</TabsTrigger>}
          {can(PERMISSIONS.ROLES_VIEW) && <TabsTrigger value="roles">Roles & permissions</TabsTrigger>}
        </TabsList>

        {can(PERMISSIONS.USERS_VIEW) && (
          <TabsContent value="users" className="mt-4">
            <UsersTab />
          </TabsContent>
        )}
        {can(PERMISSIONS.ROLES_VIEW) && (
          <TabsContent value="roles" className="mt-4">
            <RolesTab />
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}

function UsersTab() {
  const { can } = usePermissions();
  const { profile } = useAuth();
  const users = useUsers();
  const setStatus = useSetUserStatus();
  const [assigning, setAssigning] = useState<UserWithRoles | null>(null);

  const canAssignRoles = can(PERMISSIONS.USERS_ROLES_ASSIGN);
  const canUpdate = can(PERMISSIONS.USERS_UPDATE);

  const columns = useMemo<ColumnDef<UserWithRoles, unknown>[]>(
    () => [
      {
        accessorKey: "full_name",
        header: "Name",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">
              {row.original.full_name}
              {row.original.id === profile?.id && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        ),
      },
      {
        accessorKey: "employee_code",
        header: "Employee no.",
        cell: ({ row }) => (
          <span className="num text-xs">
            {row.original.employee_code ?? <span className="text-muted-foreground">—</span>}
          </span>
        ),
      },
      {
        id: "roles",
        header: "Roles",
        enableSorting: false,
        accessorFn: (row) => row.user_roles.map((r) => r.role?.name ?? "").join(" "),
        cell: ({ row }) =>
          row.original.user_roles.length === 0 ? (
            <Badge className="border-0 bg-warning/20 text-[10px] text-warning-foreground">
              No role
            </Badge>
          ) : (
            <div className="flex flex-wrap gap-1">
              {row.original.user_roles.map((assignment) => (
                <Badge key={assignment.id} variant="secondary" className="text-[10px]">
                  {assignment.role?.name}
                  {assignment.branch && (
                    <span className="ml-1 opacity-70">· {assignment.branch.code}</span>
                  )}
                </Badge>
              ))}
            </div>
          ),
      },
      {
        id: "branch",
        header: "Default branch",
        accessorFn: (row) => row.default_branch?.name ?? "",
        cell: ({ row }) =>
          row.original.default_branch?.name ?? <span className="text-muted-foreground">—</span>,
      },
      {
        accessorKey: "last_login_at",
        header: "Last sign-in",
        cell: ({ row }) => (
          <span className="num text-xs text-muted-foreground">
            {row.original.last_login_at
              ? format(new Date(row.original.last_login_at), "dd MMM yyyy HH:mm")
              : "Never"}
          </span>
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
          const user = row.original;
          const isSelf = user.id === profile?.id;
          if (!canAssignRoles && !canUpdate) return null;

          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Actions for ${user.full_name}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {canAssignRoles && (
                    <DropdownMenuItem onSelect={() => setAssigning(user)} disabled={isSelf}>
                      <ShieldCheck className="size-4" />
                      Manage roles
                    </DropdownMenuItem>
                  )}
                  {canUpdate && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                        Account status
                      </DropdownMenuLabel>
                      {user.status !== "active" && (
                        <DropdownMenuItem
                          onSelect={() => setStatus.mutate({ id: user.id, status: "active" })}
                          disabled={isSelf}
                        >
                          <UserPlus className="size-4" />
                          Activate
                        </DropdownMenuItem>
                      )}
                      {user.status !== "suspended" && (
                        <DropdownMenuItem
                          onSelect={() => setStatus.mutate({ id: user.id, status: "suspended" })}
                          disabled={isSelf}
                        >
                          <UserMinus className="size-4" />
                          Suspend
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [canAssignRoles, canUpdate, profile?.id, setStatus],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={users.data}
        isLoading={users.isLoading}
        error={users.error}
        onRetry={() => void users.refetch()}
        searchPlaceholder="Search people by name, email or employee number…"
        emptyTitle="No users yet"
        emptyDescription="Users appear here once they have been created in Supabase Authentication."
      />

      <p className="mt-3 text-xs text-muted-foreground">
        New accounts are created in Supabase → Authentication → Users, or through the{" "}
        <code className="rounded bg-muted px-1 py-0.5">invite-user</code> Edge Function. A user
        cannot change their own status or grant themselves a role — the database refuses both.
      </p>

      <ManageRolesDialog user={assigning} onOpenChange={(open) => !open && setAssigning(null)} />
    </>
  );
}

function ManageRolesDialog({
  user,
  onOpenChange,
}: {
  user: UserWithRoles | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: roles } = useRoles();
  const { data: branches } = useBranches();
  const assignRole = useAssignRole();
  const revokeRole = useRevokeRole();

  const [roleId, setRoleId] = useState("");
  const [branchId, setBranchId] = useState("all");

  const assignedRoleIds = new Set(user?.user_roles.map((assignment) => assignment.role_id));
  const available = roles?.filter((role) => !assignedRoleIds.has(role.id)) ?? [];

  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Roles for {user?.full_name}</DialogTitle>
          <DialogDescription>
            Permissions come from roles. A role with no branch applies everywhere.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Current roles
            </p>
            {user?.user_roles.length === 0 ? (
              <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
                This user has no role, so they cannot open anything after signing in.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {user?.user_roles.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{assignment.role?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {assignment.branch ? `${assignment.branch.name} only` : "All branches"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label={`Revoke ${assignment.role?.name}`}
                      onClick={() => revokeRole.mutate(assignment.id)}
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <Field label="Add role" htmlFor="role">
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Scope" htmlFor="branch-scope">
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger id="branch-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {branches?.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            disabled={!roleId || !user || assignRole.isPending}
            onClick={async () => {
              if (!user || !roleId) return;
              await assignRole.mutateAsync({
                userId: user.id,
                roleId,
                branchId: branchId === "all" ? null : branchId,
              });
              setRoleId("");
            }}
          >
            <Plus className="size-4" />
            Assign role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RolesTab() {
  const roles = useRoles();
  const permissions = usePermissionCatalogue();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const activeRoleId = selectedRoleId ?? roles.data?.[0]?.id ?? null;
  const rolePermissions = useRolePermissions(activeRoleId);

  const granted = new Set(rolePermissions.data ?? []);
  const activeRole = roles.data?.find((role) => role.id === activeRoleId);

  const byModule = useMemo(() => {
    const groups = new Map<string, typeof permissions.data>();
    for (const permission of permissions.data ?? []) {
      const list = groups.get(permission.module) ?? [];
      list.push(permission);
      groups.set(permission.module, list);
    }
    return [...groups.entries()];
  }, [permissions.data]);

  if (roles.isLoading || permissions.isLoading) return <CardsSkeleton count={3} />;
  if (roles.isError) {
    return (
      <div className="card-surface">
        <ErrorState error={roles.error} onRetry={() => void roles.refetch()} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <nav className="card-surface h-fit overflow-hidden" aria-label="Roles">
        <ul className="divide-y divide-border">
          {roles.data?.map((role) => (
            <li key={role.id}>
              <button
                type="button"
                onClick={() => setSelectedRoleId(role.id)}
                className={
                  role.id === activeRoleId
                    ? "w-full border-l-2 border-primary bg-accent px-4 py-3 text-left"
                    : "w-full border-l-2 border-transparent px-4 py-3 text-left transition-colors hover:bg-muted"
                }
                aria-current={role.id === activeRoleId ? "true" : undefined}
              >
                <span className="block text-sm font-medium">{role.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{role.code}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <section className="card-surface overflow-hidden">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">{activeRole?.name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {activeRole?.description}
            {activeRole?.is_system && " · System role"}
          </p>
        </header>

        {rolePermissions.isLoading ? (
          <div className="p-5">
            <CardsSkeleton count={2} />
          </div>
        ) : byModule.length === 0 ? (
          <EmptyState
            title="No permissions in the catalogue"
            description="Run the Phase 1 migrations to seed roles and permissions."
          />
        ) : (
          <div className="divide-y divide-border">
            {byModule.map(([module, items]) => {
              const grantedCount = (items ?? []).filter((item) => granted.has(item.id)).length;
              return (
                <div key={module} className="px-5 py-4">
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {MODULE_LABELS[module] ?? module}
                    </h3>
                    <span className="num text-xs text-muted-foreground">
                      {grantedCount}/{items?.length ?? 0}
                    </span>
                  </div>
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {items?.map((permission) => {
                      const has = granted.has(permission.id);
                      return (
                        <li
                          key={permission.id}
                          className={
                            has
                              ? "flex items-start gap-2 text-sm"
                              : "flex items-start gap-2 text-sm text-muted-foreground/60"
                          }
                        >
                          <span
                            className={
                              has
                                ? "mt-1 size-1.5 shrink-0 rounded-full bg-success"
                                : "mt-1 size-1.5 shrink-0 rounded-full bg-border"
                            }
                            aria-hidden
                          />
                          <span className="min-w-0">
                            <span className="block truncate">{permission.name}</span>
                            <span className="block truncate font-mono text-[10px] opacity-60">
                              {permission.code}
                            </span>
                          </span>
                          <span className="sr-only">{has ? "granted" : "not granted"}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
