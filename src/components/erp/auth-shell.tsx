import type { ReactNode } from "react";
import { BarChart3, Cloud, Headphones, Lock, Package, ShieldCheck, ShoppingCart, Users } from "lucide-react";

import warehouseAsset from "@/assets/auth-warehouse.png.asset.json";
import logoAsset from "@/assets/bp-logo.png.asset.json";

/**
 * Shared frame for sign-in, forgot-password and reset-password.
 *
 * Left: the brand panel — logo on white, then the warehouse photograph tinted
 * in brand blue, the welcome copy and the four module pillars.
 * Right: the form, on a single white card.
 */

const MODULES = [
  { icon: Package, label: "Inventory\nManagement" },
  { icon: ShoppingCart, label: "Sales &\nPOS" },
  { icon: BarChart3, label: "Accounting &\nFinance" },
  { icon: Users, label: "HR &\nPayroll" },
] as const;

const ASSURANCES = [
  {
    icon: ShieldCheck,
    title: "Secure & Reliable",
    note: "Enterprise-grade security to protect your data",
  },
  { icon: Cloud, title: "Cloud Based", note: "Access your business anywhere, anytime" },
  { icon: Headphones, title: "24/7 Support", note: "Our support team is always here to help" },
] as const;

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
}) {
  return (
    <div className="flex min-h-screen bg-surface">
      {/* Brand panel */}
      <aside className="relative hidden w-[43%] flex-col overflow-hidden bg-sidebar text-sidebar-foreground lg:flex">
        <div className="bg-white px-10 py-6">
          <img
            src={logoAsset.url}
            alt="Builders Paradise Hardware"
            className="h-16 w-auto object-contain object-left"
          />
        </div>

        <div className="relative flex flex-1 flex-col justify-between px-10 py-12">
          <img
            src={warehouseAsset.url}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full object-cover"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-sidebar via-sidebar/90 to-sidebar/40"
            aria-hidden
          />

          <div className="relative">
            <span className="block h-[3px] w-14 rounded-full bg-sidebar-primary" />
            <p className="mt-7 text-td text-sidebar-foreground/85">Welcome to</p>
            <h2 className="mt-1.5 text-kpi font-semibold tracking-tight text-white">
              Builders Paradise ERP
            </h2>
            <p className="mt-4 max-w-md text-td leading-relaxed text-sidebar-foreground/80">
              Your all-in-one solution for managing inventory, sales, purchases, accounting, HR and
              more — everything in one place.
            </p>
          </div>

          <div className="relative mt-12 grid grid-cols-4 gap-4">
            {MODULES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-5 text-white" aria-hidden />
                </span>
                <span className="whitespace-pre-line text-helper font-medium leading-snug text-white">
                  {label}
                </span>
              </div>
            ))}
          </div>

          <p className="relative mt-12 text-helper text-sidebar-muted">
            © {new Date().getFullYear()} Builders Paradise Hardware. All rights reserved.
          </p>
        </div>
      </aside>

      {/* Form panel */}
      <div className="flex w-full flex-col justify-center px-5 py-10 sm:px-10 lg:w-[57%] lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-lg sm:p-10">
            <div className="flex flex-col items-center text-center">
              <span className="grid size-14 place-items-center rounded-full bg-primary/10">
                <Lock className="size-6 text-primary" aria-hidden />
              </span>
              <h1 className="mt-5 text-module-title tracking-tight">{title}</h1>
              {description && <p className="mt-2 text-td text-foreground-body">{description}</p>}
            </div>

            <div className="mt-7 text-left">{children}</div>

            {footer && (
              <div className="mt-7 border-t border-border pt-5 text-center text-td text-muted-foreground">
                {footer}
              </div>
            )}
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {ASSURANCES.map(({ icon: Icon, title: heading, note }) => (
              <div key={heading} className="flex gap-2.5">
                <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <div>
                  <p className="text-helper font-semibold text-foreground">{heading}</p>
                  <p className="mt-0.5 text-helper leading-snug text-muted-foreground">{note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
