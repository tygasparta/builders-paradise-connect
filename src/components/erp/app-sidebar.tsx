import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Boxes,
  PackageCheck,
  ScanBarcode,
  ReceiptText,
  Landmark,
  Users,
  Truck,
  BarChart3,
  UsersRound,
  Wallet,
  Settings,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { lowStock } from "@/lib/erp-data";

type Item = { title: string; url: string; icon: typeof Boxes; badge?: string; soon?: boolean };

const groups: { label: string; items: Item[] }[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/", icon: LayoutDashboard }],
  },
  {
    label: "Operations",
    items: [
      { title: "Inventory", url: "/inventory", icon: Boxes, badge: String(lowStock.length) },
      { title: "Goods Receiving", url: "/goods-receiving", icon: PackageCheck },
      { title: "Point of Sale", url: "/pos", icon: ScanBarcode },
      { title: "Sales", url: "/sales", icon: ReceiptText },
    ],
  },
  {
    label: "Finance",
    items: [{ title: "Accounting", url: "/accounting", icon: Landmark }],
  },
  {
    label: "Coming next",
    items: [
      { title: "Purchasing", url: "/", icon: Truck, soon: true },
      { title: "Customers", url: "/", icon: Users, soon: true },
      { title: "Human Resources", url: "/", icon: UsersRound, soon: true },
      { title: "Payroll", url: "/", icon: Wallet, soon: true },
      { title: "Reports", url: "/", icon: BarChart3, soon: true },
      { title: "Settings", url: "/", icon: Settings, soon: true },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary font-bold text-primary-foreground">
            BP
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">
                Builders Paradise
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">Enterprise ERP</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/45">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = !item.soon && pathname === item.url;
                  if (item.soon) {
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          className="cursor-default opacity-45"
                          tooltip={`${item.title} — phase 2`}
                        >
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="size-4" />
                          <span className="flex-1">{item.title}</span>
                          {item.badge && !collapsed && (
                            <Badge className="h-5 border-0 bg-primary/15 px-1.5 text-[10px] text-primary">
                              {item.badge}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="px-3 pb-4">
        {!collapsed && (
          <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/60 p-3">
            <p className="text-xs font-medium text-sidebar-accent-foreground">Demo dataset</p>
            <p className="mt-1 text-[11px] leading-relaxed text-sidebar-foreground/60">
              Running on sample data. Connect the backend to go live.
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
