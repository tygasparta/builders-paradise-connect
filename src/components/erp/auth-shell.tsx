import type { ReactNode } from "react";
import { BarChart3, Cloud, Headphones, Lock, Package, ShieldCheck, ShoppingCart, Users } from "lucide-react";

import warehouseAsset from "@/assets/auth-warehouse.png.asset.json";
import logoAsset from "@/assets/bp-logo.png.asset.json";

/**
 * Shared frame for sign-in, forgot-password and reset-password.
 *
 * Left: full-height brand panel — the warehouse photograph tinted in brand
 * blue, with the logo, welcome copy and four module pillars stacked on top.
 * Right: the form on a single white card, with the trust strip beneath it.
 */

const MODULES = [
  { icon: Package, label: "Inventory" },
  { icon: ShoppingCart, label: "Sales & POS" },
  { icon: BarChart3, label: "Accounting" },
  { icon: Users, label: "HR & Payroll" },
] as const;

const ASSURANCES = [
  { icon: ShieldCheck, title: "Secure & Reliable", note: "Enterprise-grade security" },
  { icon: Cloud, title: "Cloud Based", note: "Access from anywhere" },
  { icon: Headphones, title: "24/7 Support", note: "Always here to help" },
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
      <aside className="relative hidden w-[45%] max-w-[640px] shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground lg:flex">
        <img
          src={warehouseAsset.url}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-br from-sidebar via-sidebar/92 to-sidebar/70"
          aria-hidden
        />

        <div className="relative flex flex-1 flex-col justify-between p-12 xl:p-14">
          <div className="inline-flex w-fit items-center rounded-xl bg-white px-4 py-3 shadow-lg">
            <img
              src={logoAsset.url}
              alt="Builders Paradise Hardware"
              className="h-11 w-auto object-contain"
            />
          </div>

          <div className="max-w-md py-10">
            <span className="block h-[3px] w-14 rounded-full bg-sidebar-primary" />
            <p className="mt-7 text-td text-sidebar-foreground/85">Welcome to</p>
            <h2 className="mt-2 text-kpi font-semibold tracking-tight text-white">
              Builders Paradise ERP
            </h2>
            <p className="mt-4 text-td leading-relaxed text-sidebar-foreground/80">
              Your all-in-one solution for managing inventory, sales, purchases, accounting, HR and
              more — everything in one place.
            </p>
          </div>

          <div>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {MODULES.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl bg-white/8 px-3.5 py-3 ring-1 ring-white/12 backdrop-blur-sm xl:flex-col xl:items-start xl:gap-3 xl:px-4 xl:py-4"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/12">
                    <Icon className="size-[18px] text-white" aria-hidden />
                  </span>
                  <span className="text-helper font-medium leading-snug text-white">{label}</span>
                </div>
              ))}
            </div>

            <p className="mt-10 text-helper text-sidebar-muted">
              © {new Date().getFullYear()} Builders Paradise Hardware. All rights reserved.
            </p>
          </div>
        </div>
      </aside>

      {/* Form panel */}
      <div className="flex flex-1 flex-col justify-center px-5 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-[440px]">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-lg sm:p-10">
            <div className="flex flex-col items-center text-center">
              <span className="grid size-14 place-items-center rounded-full bg-primary/10">
                <Lock className="size-6 text-primary" aria-hidden />
              </span>
              <h1 className="mt-5 text-module-title tracking-tight">{title}</h1>
              {description && <p className="mt-2 text-td text-foreground-body">{description}</p>}
            </div>

            <div className="mt-8 text-left">{children}</div>

            {footer && (
              <div className="mt-7 border-t border-border pt-5 text-center text-td text-muted-foreground">
                {footer}
              </div>
            )}
          </div>

          <div className="mt-8 grid grid-cols-3 gap-4">
            {ASSURANCES.map(({ icon: Icon, title: heading, note }) => (
              <div key={heading} className="flex flex-col items-center gap-2 text-center">
                <Icon className="size-5 text-primary" aria-hidden />
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
