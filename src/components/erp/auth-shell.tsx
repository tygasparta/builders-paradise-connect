import type { ReactNode } from "react";

import { BrandMark } from "./brand-mark";

/**
 * Shared frame for sign-in, forgot-password and reset-password.
 *
 * The form sits on white; alongside it on wide screens is the navy panel —
 * the same surface as the sidebar, so signing in reads as the front door of
 * the building rather than a different product.
 *
 * The panel carries the plumb line from the navigation rail. Hung on it is
 * the chain the system actually enforces, in the order goods and money move
 * through it. That is a real sequence rather than decoration, and it tells
 * someone on their first morning what this place does. It replaced a row of
 * counts — module and role totals persuade nobody who already works here.
 */

/** The order every document follows. Each stage hands the next its evidence. */
const CHAIN = [
  { stage: "Requisition", note: "Someone asks" },
  { stage: "Purchase order", note: "The business commits" },
  { stage: "Goods received", note: "What actually arrived" },
  { stage: "Stock", note: "Counted and costed" },
  { stage: "Sale", note: "Over the counter or on account" },
  { stage: "Ledger", note: "Posted once, never twice" },
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
      <div className="flex w-full flex-col justify-center px-5 py-10 sm:px-10 lg:w-[46%] lg:px-14">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex items-center gap-3">
            <BrandMark className="size-10" />
            <div>
              <p className="text-td font-semibold leading-tight">Builders Paradise</p>
              <p className="text-helper text-muted-foreground">Enterprise ERP</p>
            </div>
          </div>

          <h1 className="mt-9 text-module-title tracking-tight">{title}</h1>
          {description && <p className="mt-2 text-td text-foreground-body">{description}</p>}

          <div className="mt-7">{children}</div>

          {footer && <div className="mt-6 text-td text-muted-foreground">{footer}</div>}
        </div>
      </div>

      <aside
        className="relative hidden flex-1 flex-col justify-center overflow-hidden bg-sidebar px-12 py-14 text-sidebar-foreground lg:flex xl:px-16"
        aria-hidden
      >
        {/*
          The plumb line, continued from the navigation rail. It is the
          container's own left border rather than a positioned bar, so the
          stage markers below cannot drift off it however the padding changes.
        */}
        <div className="relative max-w-lg border-l border-sidebar-rail pl-9">
          <p className="text-eyebrow uppercase tracking-[0.16em] text-sidebar-muted">
            Builders Paradise Hardware
          </p>

          <p className="mt-7 text-kpi tracking-tight text-white">
            One system for stock, the till, the ledger and the people who run them.
          </p>

          <p className="mt-5 max-w-md text-td leading-relaxed text-sidebar-foreground/80">
            Every movement of stock and every cent is recorded against a document, a warehouse and a
            person — so the numbers on the dashboard are the numbers in the yard.
          </p>

          <ol className="mt-11 space-y-3.5 border-t border-sidebar-border pt-8">
            {CHAIN.map(({ stage, note }) => (
              <li key={stage} className="relative flex items-baseline gap-3">
                {/* Sits on the line: half its own width left of the padding edge. */}
                <span className="absolute -left-9 top-[0.45rem] size-[7px] -translate-x-1/2 rounded-full bg-sidebar-primary ring-4 ring-sidebar" />
                <span className="w-36 shrink-0 text-td font-medium text-white">{stage}</span>
                <span className="text-helper text-sidebar-muted">{note}</span>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}
