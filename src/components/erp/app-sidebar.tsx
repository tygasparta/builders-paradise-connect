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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useCompanySettings } from "@/features/settings/hooks";
import { usePermissions } from "@/lib/auth/use-permission";
import { NAVIGATION, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";

export type SidebarBadges = Partial<Record<"approvals" | "lowStock" | "notifications", number>>;

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

  const hasActiveChild = (item: NavItem) => item.children?.some((child) => isActive(child)) ?? false;

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-3">
          <BrandMark logoUrl={settings?.logo_url} companyName={settings?.company_name} />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">
                {settings?.company_name ?? "Builders Paradise"}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">Enterprise ERP</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {NAVIGATION.map((section) => {
          const items = section.items.filter(isVisible);
          if (items.length === 0) return null;

          return (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/45">
                {section.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
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

  // A module whose screens land in a later phase is labelled, not linked —
  // a link that goes nowhere is worse than an honest "P3".
  const linkable = Boolean(item.to) && !item.phase;

  const content = (
    <>
      <item.icon className="size-4" />
      <span className="flex-1 truncate">{item.label}</span>
      {!collapsed && item.phase && (
        <span className="rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-medium text-sidebar-foreground/55">
          P{item.phase}
        </span>
      )}
      {!collapsed && count !== undefined && count > 0 && (
        <Badge className="h-5 min-w-5 justify-center rounded-full border-0 bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
          {count > 99 ? "99+" : count}
        </Badge>
      )}
    </>
  );

  if (children.length > 0) {
    return (
      <Collapsible defaultOpen={defaultOpen} className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              tooltip={item.label}
              isActive={active}
              className="data-[state=open]:bg-sidebar-accent/60"
            >
              {content}
              <ChevronRight className="size-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {children.map((child) => (
                <SidebarMenuSubItem key={child.label}>
                  {child.to && !child.phase ? (
                    <SidebarMenuSubButton asChild isActive={isActive(child)}>
                      <Link to={child.to}>
                        <span>{child.label}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  ) : (
                    <SidebarMenuSubButton
                      className="cursor-default opacity-45"
                      aria-disabled="true"
                      title={`${child.label} — Phase ${child.phase}`}
                    >
                      <span className="flex-1">{child.label}</span>
                      <span className="text-[10px]">P{child.phase}</span>
                    </SidebarMenuSubButton>
                  )}
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      {linkable ? (
        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
          <Link
            to={item.to as string}
            className={cn("flex items-center gap-2", active && "font-medium")}
          >
            {content}
          </Link>
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton
          className="cursor-default opacity-45"
          aria-disabled="true"
          tooltip={item.phase ? `${item.label} — Phase ${item.phase}` : item.label}
        >
          {content}
        </SidebarMenuButton>
      )}
    </SidebarMenuItem>
  );
}
