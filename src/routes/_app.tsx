import { Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/erp/app-sidebar";
import { Topbar } from "@/components/erp/topbar";
import { useAuth } from "@/lib/auth/auth-context";
import { usePermissions } from "@/lib/auth/use-permission";
import { APPROVAL_SOURCES, usePendingApprovalCount } from "@/features/approvals/api";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

/**
 * The authenticated shell.
 *
 * The redirect happens in an effect rather than `beforeLoad` because the
 * Supabase session lives in browser storage — on the server there is nothing
 * to check, so a loader-based guard would bounce every first paint to /login.
 * The real access control is RLS; this is navigation, not security.
 */
function AppLayout() {
  const { status } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (router) => router.location.pathname });

  useEffect(() => {
    if (status === "signed-out") {
      // Send the user back where they were aiming once they sign in.
      const deepLink = pathname && pathname !== "/" ? { search: { redirect: pathname } } : {};
      void navigate({ to: "/login", replace: true, ...deepLink });
    }
  }, [status, navigate, pathname]);

  // Only count what this person can actually act on. Hooks run before
  // the signed-out return below, so the order stays stable across renders;
  // the query itself is disabled while there are no sources.
  const approvalSources = useMemo(
    () => APPROVAL_SOURCES.filter((source) => can(source.permission)),
    [can],
  );
  const approvals = usePendingApprovalCount(approvalSources);

  if (status !== "signed-in") {
    return <BootScreen />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar badges={{ approvals: approvals.data ?? 0 }} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

/** Shown while the session is being resolved, and during the redirect. */
function BootScreen() {
  return (
    <div
      className="grid min-h-screen place-items-center bg-background px-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <span className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <p className="text-td text-muted-foreground">Loading your workspace…</p>
      </div>
    </div>
  );
}
