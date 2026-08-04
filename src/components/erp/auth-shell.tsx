import type { ReactNode } from "react";

import { BrandMark } from "./brand-mark";

/**
 * Shared frame for sign-in, forgot-password and reset-password.
 *
 * Split layout: the form on white, a black brand panel alongside it on
 * larger screens. No gradients — flat brand blue and black only.
 */
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
      <div className="flex w-full flex-col justify-center px-5 py-10 sm:px-10 lg:w-[46%] lg:px-14">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex items-center gap-3">
            <BrandMark className="size-10" />
            <div>
              <p className="text-sm font-semibold leading-tight">Builders Paradise</p>
              <p className="text-xs text-muted-foreground">Enterprise ERP</p>
            </div>
          </div>

          <h1 className="mt-9 text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}

          <div className="mt-7">{children}</div>

          {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>

      <aside
        className="relative hidden flex-1 flex-col justify-between bg-secondary p-12 text-secondary-foreground lg:flex"
        aria-hidden
      >
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-white/45">
          <span className="h-px w-8 bg-primary" />
          Builders Paradise Hardware
        </div>

        <div className="max-w-md">
          <p className="text-[26px] font-semibold leading-snug tracking-tight">
            One system for stock, the till, the ledger and the people who run them.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-white/55">
            Every movement of stock and every cent is recorded against a document, a warehouse and a
            person — so the numbers on the dashboard are the numbers in the yard.
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-6 border-t border-white/10 pt-7">
          {[
            { value: "18", label: "Modules" },
            { value: "14", label: "Roles" },
            { value: "3", label: "Branches" },
          ].map((stat) => (
            <div key={stat.label}>
              <dt className="sr-only">{stat.label}</dt>
              <dd>
                <span className="num block text-xl font-semibold text-primary">{stat.value}</span>
                <span className="mt-0.5 block text-xs text-white/45">{stat.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
}
