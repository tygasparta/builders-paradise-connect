import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCompanySettings } from "@/features/settings/hooks";
import { usePermissions } from "@/lib/auth/use-permission";
import { NAVIGATION, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";

export type SidebarBadges = Partial<Record<"approvals" | "lowStock" | "notifications", number>>;

/**
 * The navigation rail.
 *
 * A hairline runs down the item column and the current entry is marked by
 * a short segment on that line rather than by filling the row. Tracking
 * one vertical line is quicker than scanning twenty rows for a shaded
 * block, and it keeps the brand blue to a single place at a time.
 *
 * Identity lives in the topbar, so it is deliberately absent here — this
 * owns navigation and nothing else.
 */
export function AppSidebar({ badges = {} }: { badges?: SidebarBadges }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (router) => router.location.pathname });
  const { satisfies } = usePermissions();
  const { data: settings } = useCompanySettings();

  /** An entry is visible if the user holds its permission, or any child's. */
  const isVisible = (item: NavItem): boolean => {
    if (satisfies(item.require)) return true;
    return item.children?.some(isVisible) ?? false;
  };

  const isActive = (item: NavItem) =>
    Boolean(item.to) &&
    (pathname === item.to || (item.to !== "/" && pathname.startsWith(`${item.to}/`)));

  const hasActiveChild = (item: NavItem) =>
    item.children?.some((child) => isActive(child)) ?? false;

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="px-3 pb-1 pt-4">
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          {/* A small white tile rather than a full-width card: a colour mark
              still needs white to read, but it does not need to shout. */}
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white">
            <BrandMark logoUrl={settings?.logo_url} companyName={settings?.company_name} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold leading-tight text-sidebar-accent-foreground">
                {settings?.company_name ?? "Builders Paradise"}
              </p>
              <p className="truncate text-[11px] leading-tight text-sidebar-muted">
                Enterprise ERP
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="sidebar-scroll gap-0 pb-4">
        {NAVIGATION.map((section) => {
          const items = section.items.filter(isVisible);
          if (items.length === 0) return null;

          return (
            <SidebarGroup key={section.label} className="px-3 py-0 pt-4 first:pt-2">
              {!collapsed && (
                <SidebarGroupLabel className="h-auto px-0 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted/80">
                  {section.label}
                </SidebarGroupLabel>
              )}

              <SidebarGroupContent className="relative">
                {/* The rail. Hidden when collapsed, where icons centre instead. */}
                {!collapsed && (
                  <span
                    aria-hidden
                    className="absolute bottom-1 left-[13px] top-1 w-px bg-sidebar-rail"
                  />
                )}

                <SidebarMenu className="gap-px">
                  {items.map((item) => (
                    <NavEntry
                      key={item.label}
                      item={item}
                      collapsed={collapsed}
                      badges={badges}
                      isVisible={isVisible}
                      isActive={isActive}
                      defaultOpen={hasActiveChild(item)}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}

/** The blue segment that sits on the rail beside the current entry. */
function ActiveMark({ short = false }: { short?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute left-[11px] top-1/2 w-[3px] -translate-y-1/2 rounded-full bg-sidebar-primary",
        short ? "h-3" : "h-4",
      )}
    />
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="num ml-auto shrink-0 rounded-full bg-sidebar-primary px-1.5 py-px text-[10px] font-semibold leading-4 text-sidebar-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavEntry({
  item,
  collapsed,
  badges,
  isVisible,
  isActive,
  defaultOpen,
}: {
  item: NavItem;
  collapsed: boolean;
  badges: SidebarBadges;
  isVisible: (item: NavItem) => boolean;
  isActive: (item: NavItem) => boolean;
  defaultOpen: boolean;
}) {
  const count = item.badgeKey ? badges[item.badgeKey] : undefined;
  const children = item.children?.filter(isVisible) ?? [];
  const active = isActive(item);
  const childActive = children.some(isActive);

  // A module still awaiting its screens is labelled, not linked. Nothing
  // carries a phase today; the guard stays so re-adding one is safe.
  const linkable = Boolean(item.to) && !item.phase;

  /**
   * Rows stay quiet. The current row gets a faint tint and brighter text —
   * the loud part is the mark on the rail, which is why blue never appears
   * in two places at once.
   */
  const rowClass = cn(
    "group/row relative h-8 rounded-md text-[13.5px] font-medium transition-colors motion-reduce:transition-none",
    collapsed ? "justify-center px-0" : "pl-[26px] pr-2",
    active
      ? "bg-sidebar-accent/60 text-sidebar-accent-foreground hover:bg-sidebar-accent/60"
      : "text-sidebar-foreground hover:bg-sidebar-accent/35 hover:text-sidebar-accent-foreground",
  );

  const iconClass = cn(
    "size-4 shrink-0 transition-colors motion-reduce:transition-none",
    active
      ? "text-sidebar-accent-foreground"
      : "text-sidebar-muted group-hover/row:text-sidebar-foreground",
  );

  // ---- Entry with children ---------------------------------------------
  if (children.length > 0) {
    return (
      <Collapsible defaultOpen={defaultOpen} className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              {...(collapsed ? { tooltip: item.label } : {})}
              className={cn(
                rowClass,
                // A parent whose child is current stays legible without
                // claiming the mark — that belongs to the child.
                !active && childActive && "text-sidebar-accent-foreground",
              )}
            >
              {childActive && !active && !collapsed && (
                <span
                  aria-hidden
                  className="absolute left-[11px] top-1/2 size-[3px] -translate-y-1/2 rounded-full bg-sidebar-muted"
                />
              )}
              <item.icon className={iconClass} />
              {!collapsed && (
                <>
                  <span className="truncate">{item.label}</span>
                  <ChevronRight className="ml-auto size-3.5 shrink-0 text-sidebar-muted transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 motion-reduce:transition-none" />
                </>
              )}
            </SidebarMenuButton>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <SidebarMenuSub className="mx-0 my-0.5 gap-px border-0 px-0">
              {children.map((child) => {
                const childIsActive = isActive(child);
                const childLinkable = Boolean(child.to) && !child.phase;
                return (
                  <SidebarMenuSubItem key={child.label}>
                    <SidebarMenuSubButton
                      asChild={childLinkable}
                      isActive={childIsActive}
                      aria-disabled={childLinkable ? undefined : "true"}
                      className={cn(
                        "relative h-7 rounded-md pl-[42px] pr-2 text-[13px] transition-colors motion-reduce:transition-none",
                        childIsActive
                          ? "bg-sidebar-accent/60 font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent/60"
                          : "text-sidebar-muted hover:bg-sidebar-accent/35 hover:text-sidebar-foreground",
                        !childLinkable && "cursor-default opacity-45",
                      )}
                    >
                      {childLinkable ? (
                        <Link to={child.to ?? "/"}>
                          {childIsActive && <ActiveMark short />}
                          <span className="truncate">{child.label}</span>
                        </Link>
                      ) : (
                        <span className="truncate">{child.label}</span>
                      )}
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                );
              })}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  // ---- Leaf entry -------------------------------------------------------
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild={linkable}
        isActive={active}
        {...(collapsed ? { tooltip: item.label } : {})}
        aria-disabled={linkable ? undefined : "true"}
        className={cn(rowClass, !linkable && "cursor-default opacity-45")}
      >
        {linkable ? (
          <Link to={item.to ?? "/"}>
            {active && !collapsed && <ActiveMark />}
            <item.icon className={iconClass} />
            {!collapsed && <span className="truncate">{item.label}</span>}
            {!collapsed && count !== undefined && count > 0 && <CountBadge count={count} />}
          </Link>
        ) : (
          <>
            <item.icon className={iconClass} />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
