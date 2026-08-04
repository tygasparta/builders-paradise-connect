import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Building2,
  ChevronDown,
  LogOut,
  Plus,
  Search,
  User,
  Warehouse,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobalSearch } from "./global-search";
import { useAuth } from "@/lib/auth/auth-context";
import { useBranches } from "@/features/branches/hooks";
import { useWarehouses } from "@/features/warehouses/hooks";
import { useUnreadNotifications } from "@/features/audit/hooks";
import { PERMISSIONS, type PermissionCode } from "@/lib/permissions/catalog";
import { usePermissions } from "@/lib/auth/use-permission";
import { cn } from "@/lib/utils";

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Topbar() {
  const navigate = useNavigate();
  const {
    profile,
    roles,
    signOut,
    activeBranchId,
    setActiveBranchId,
    activeWarehouseId,
    setActiveWarehouseId,
  } = useAuth();

  const { can } = usePermissions();
  const [searchOpen, setSearchOpen] = useState(false);
  const online = useOnlineStatus();
  const { data: branches } = useBranches();
  const { data: warehouses } = useWarehouses(activeBranchId);
  const { data: notifications } = useUnreadNotifications();

  const activeBranch = branches?.find((branch) => branch.id === activeBranchId);
  const activeWarehouse = warehouses?.find((warehouse) => warehouse.id === activeWarehouseId);
  const unread = notifications?.total ?? 0;
  const primaryRole = roles.slice().sort((a, b) => a.rank - b.rank)[0];

  // Cmd/Ctrl+K opens search from anywhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-card/85 px-3 backdrop-blur md:px-6">
      <SidebarTrigger className="text-muted-foreground" />

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="hidden h-9 max-w-md flex-1 items-center gap-2 rounded-lg border border-border bg-muted/60 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="truncate">Search branches, warehouses, people…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium lg:inline">
          ⌘K
        </kbd>
      </button>

      <Button
        variant="ghost"
        size="icon"
        className="size-9 md:hidden"
        onClick={() => setSearchOpen(true)}
        aria-label="Search"
      >
        <Search className="size-4" />
      </Button>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {/* Live connection state — reflects the browser, not a decoration */}
        <span
          className={cn(
            "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium xl:inline-flex",
            online
              ? "border-success/30 bg-success/10 text-success"
              : "border-destructive/30 bg-destructive/10 text-destructive",
          )}
          role="status"
        >
          {online ? (
            <Wifi className="size-3" aria-hidden />
          ) : (
            <WifiOff className="size-3" aria-hidden />
          )}
          {online ? "Online" : "Offline"}
        </span>

        <QuickActions can={can} />

        {/* Branch scope */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <Building2 className="size-4 text-primary" aria-hidden />
              <span className="hidden max-w-32 truncate sm:inline">
                {activeBranch?.name ?? "All branches"}
              </span>
              <ChevronDown className="size-3.5 opacity-60" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Branch</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setActiveBranchId(null)}>
              All branches
            </DropdownMenuItem>
            {branches?.map((branch) => (
              <DropdownMenuItem
                key={branch.id}
                onSelect={() => setActiveBranchId(branch.id)}
                className={cn(branch.id === activeBranchId && "bg-accent text-accent-foreground")}
              >
                <span className="truncate">{branch.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{branch.code}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Warehouse scope — only meaningful once a branch is chosen */}
        {activeBranchId && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="hidden h-9 gap-2 lg:flex">
                <Warehouse className="size-4 text-primary" aria-hidden />
                <span className="max-w-32 truncate">
                  {activeWarehouse?.name ?? "All warehouses"}
                </span>
                <ChevronDown className="size-3.5 opacity-60" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Warehouse</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setActiveWarehouseId(null)}>
                All warehouses
              </DropdownMenuItem>
              {warehouses?.map((warehouse) => (
                <DropdownMenuItem
                  key={warehouse.id}
                  onSelect={() => setActiveWarehouseId(warehouse.id)}
                  className={cn(
                    warehouse.id === activeWarehouseId && "bg-accent text-accent-foreground",
                  )}
                >
                  <span className="truncate">{warehouse.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{warehouse.code}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="relative size-9"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-muted">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-semibold text-secondary-foreground">
                {profile ? initialsOf(profile.full_name) : "…"}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block max-w-32 truncate text-xs font-semibold">
                  {profile?.full_name ?? "Signed in"}
                </span>
                <span className="block max-w-32 truncate text-[11px] text-muted-foreground">
                  {primaryRole?.name ?? "No role"}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="truncate">{profile?.full_name}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">
                {profile?.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="flex flex-wrap gap-1 px-2 py-1.5">
              {roles.map((role) => (
                <Badge key={role.code} variant="secondary" className="text-[10px]">
                  {role.name}
                </Badge>
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile">
                <User className="size-4" />
                My profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={async () => {
                await signOut();
                void navigate({ to: "/login" });
              }}
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

/**
 * Retained for the Phase 1 module screens that already import it.
 * New screens should use `@/components/erp/page-header`, which adds
 * breadcrumbs.
 */
export function PageHeader({
  title,
  description,
  badge,
  actions,
}: {
  title: string;
  description?: string | undefined;
  badge?: string | undefined;
  actions?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {badge && (
            <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
              {badge}
            </Badge>
          )}
        </div>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Tracks real browser connectivity so the status pill means something. */
function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}

/**
 * Shortcuts to the things this user can actually create right now.
 * Entries the user lacks permission for are not rendered, and the whole
 * control disappears rather than opening an empty menu.
 */
function QuickActions({ can }: { can: (code: PermissionCode) => boolean }) {
  const actions: { label: string; to: string; require: PermissionCode }[] = [
    {
      label: "New branch",
      to: "/settings/branches",
      require: PERMISSIONS.SETTINGS_BRANCHES_MANAGE,
    },
    { label: "New warehouse", to: "/warehouses", require: PERMISSIONS.WAREHOUSES_MANAGE },
    { label: "Manage users & roles", to: "/users", require: PERMISSIONS.USERS_VIEW },
    {
      label: "Company settings",
      to: "/settings/company",
      require: PERMISSIONS.SETTINGS_COMPANY_MANAGE,
    },
    { label: "Audit trail", to: "/audit-trail", require: PERMISSIONS.AUDIT_VIEW },
  ].filter((action) => can(action.require));

  if (actions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="hidden h-9 gap-2 md:flex">
          <Zap className="size-4 text-primary" aria-hidden />
          <span className="hidden lg:inline">Quick actions</span>
          <ChevronDown className="size-3.5 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {actions.map((action) => (
          <DropdownMenuItem key={action.to} asChild>
            <Link to={action.to}>
              <Plus className="size-4" />
              {action.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
