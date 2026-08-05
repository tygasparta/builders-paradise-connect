import {
  Banknote,
  BarChart3,
  Boxes,
  Building2,
  CheckSquare,
  ClipboardList,
  Cog,
  CreditCard,
  FileText,
  LayoutDashboard,
  Landmark,
  Package,
  PackageCheck,
  ReceiptText,
  ScanBarcode,
  ScrollText,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  UsersRound,
  Wallet,
  Warehouse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PERMISSIONS, type PermissionCode } from "@/lib/permissions/catalog";

export type NavItem = {
  label: string;
  to?: string;
  icon: LucideIcon;
  /** Any one of these permissions reveals the entry. */
  require?: PermissionCode | readonly PermissionCode[];
  children?: NavItem[];
  /** Key into the badge counts supplied by the shell. */
  badgeKey?: "approvals" | "lowStock" | "notifications";
  /** Modules that arrive in a later phase keep their place but are marked. */
  phase?: number;
};

export type NavSection = { label: string; items: NavItem[] };

/**
 * The full 18-module navigation.
 *
 * Entries are declared once and filtered by permission at render time, so
 * what a cashier sees and what a finance manager sees come from the same
 * source of truth. `phase` marks modules whose screens land later — they are
 * shown as scheduled rather than pretending to be finished, and they are not
 * clickable, so there are no dead links.
 */
export const NAVIGATION: NavSection[] = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        to: "/",
        icon: LayoutDashboard,
        require: PERMISSIONS.DASHBOARD_VIEW,
      },
    ],
  },
  {
    label: "Trade",
    items: [
      {
        label: "Sales",
        to: "/sales",
        icon: ReceiptText,
        require: PERMISSIONS.SALES_VIEW,
        children: [
          {
            label: "Invoices",
            to: "/sales",
            icon: FileText,
            require: PERMISSIONS.SALES_INVOICES_VIEW,
          },
          {
            label: "Quotations",
            to: "/sales",
            icon: FileText,
            require: PERMISSIONS.QUOTATIONS_VIEW,
          },
          {
            label: "Returns",
            to: "/sales",
            icon: FileText,
            require: PERMISSIONS.SALES_RETURNS_VIEW,
          },
        ],
      },
      {
        label: "Point of Sale",
        to: "/pos",
        icon: ScanBarcode,
        require: PERMISSIONS.POS_OPERATE,
      },
      {
        label: "Purchases",
        to: "/purchases",
        icon: ShoppingCart,
        require: PERMISSIONS.PURCHASING_VIEW,
        children: [
          {
            label: "Purchase orders",
            to: "/purchases",
            icon: FileText,
            require: PERMISSIONS.PURCHASE_ORDERS_VIEW,
          },
          {
            label: "Goods receiving",
            to: "/goods-receiving",
            icon: PackageCheck,
            require: PERMISSIONS.GRN_VIEW,
          },
          {
            label: "Requisitions",
            to: "/requisitions",
            icon: ClipboardList,
            require: PERMISSIONS.PURCHASE_REQUISITIONS_VIEW,
          },
        ],
      },
    ],
  },
  {
    label: "Stock",
    items: [
      {
        label: "Products",
        to: "/products",
        icon: Package,
        require: PERMISSIONS.PRODUCTS_VIEW,
      },
      {
        label: "Inventory",
        to: "/inventory",
        icon: Boxes,
        require: PERMISSIONS.INVENTORY_VIEW,
        badgeKey: "lowStock",
      },
      {
        label: "Warehouses",
        to: "/warehouses",
        icon: Warehouse,
        require: PERMISSIONS.WAREHOUSES_VIEW,
      },
    ],
  },
  {
    label: "Relationships",
    items: [
      {
        label: "Customers",
        to: "/customers",
        icon: Users,
        require: PERMISSIONS.CUSTOMERS_VIEW,
      },
      {
        label: "Suppliers",
        to: "/suppliers",
        icon: Truck,
        require: PERMISSIONS.SUPPLIERS_VIEW,
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        label: "Accounting",
        to: "/accounting",
        icon: Landmark,
        require: PERMISSIONS.ACCOUNTING_VIEW,
      },
      {
        label: "Banking",
        to: "/banking",
        icon: Banknote,
        require: PERMISSIONS.BANKING_VIEW,
      },
      {
        label: "Expenses",
        to: "/expenses",
        icon: CreditCard,
        require: PERMISSIONS.EXPENSES_VIEW,
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        label: "Human Resources",
        to: "/hr",
        icon: UsersRound,
        require: PERMISSIONS.HR_VIEW,
        phase: 5,
      },
      {
        label: "Payroll",
        to: "/payroll",
        icon: Wallet,
        require: PERMISSIONS.PAYROLL_VIEW,
        phase: 5,
      },
    ],
  },
  {
    label: "Control",
    items: [
      {
        label: "Approvals",
        to: "/approvals",
        icon: CheckSquare,
        require: PERMISSIONS.APPROVALS_INBOX_VIEW,
        badgeKey: "approvals",
        phase: 6,
      },
      {
        label: "Reports",
        to: "/reports",
        icon: BarChart3,
        require: PERMISSIONS.REPORTS_VIEW,
        phase: 6,
      },
      {
        label: "Users & Roles",
        to: "/users",
        icon: ShieldCheck,
        require: [PERMISSIONS.USERS_VIEW, PERMISSIONS.ROLES_VIEW],
      },
      {
        label: "Audit Trail",
        to: "/audit-trail",
        icon: ScrollText,
        require: PERMISSIONS.AUDIT_VIEW,
      },
      {
        label: "Settings",
        icon: Cog,
        require: [
          PERMISSIONS.SETTINGS_COMPANY_MANAGE,
          PERMISSIONS.SETTINGS_BRANCHES_MANAGE,
          PERMISSIONS.SETTINGS_SYSTEM_MANAGE,
        ],
        children: [
          {
            label: "Company",
            to: "/settings/company",
            icon: Building2,
            require: PERMISSIONS.SETTINGS_COMPANY_MANAGE,
          },
          {
            label: "Branches",
            to: "/settings/branches",
            icon: Building2,
            require: PERMISSIONS.SETTINGS_BRANCHES_MANAGE,
          },
        ],
      },
    ],
  },
];
