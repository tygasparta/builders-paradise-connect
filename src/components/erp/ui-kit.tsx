import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sub,
  delta,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number;
  icon?: ReactNode;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
}) {
  const toneRing = {
    default: "bg-muted text-foreground",
    primary: "bg-primary/12 text-primary",
    success: "bg-success/12 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    danger: "bg-destructive/12 text-destructive",
  }[tone];

  return (
    <div className="card-surface group p-5 transition-shadow duration-300 hover:shadow-raised">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {icon && (
          <span className={cn("grid size-9 place-items-center rounded-lg", toneRing)}>{icon}</span>
        )}
      </div>
      <p className="num mt-3 text-[26px] font-semibold leading-none">{value}</p>
      <div className="mt-2.5 flex items-center gap-2">
        {typeof delta === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
              delta >= 0 ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive",
            )}
          >
            {delta >= 0 ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("card-surface flex flex-col", className)}>
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </header>
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    Posted: "bg-success/12 text-success",
    Paid: "bg-success/12 text-success",
    Delivered: "bg-success/12 text-success",
    Received: "bg-success/12 text-success",
    Applied: "bg-muted text-muted-foreground",
    Draft: "bg-muted text-muted-foreground",
    Sent: "bg-info/12 text-info",
    Confirmed: "bg-info/12 text-info",
    Inspection: "bg-warning/25 text-warning-foreground",
    "Part paid": "bg-warning/25 text-warning-foreground",
    "Partially Received": "bg-warning/25 text-warning-foreground",
    "Pending Approval": "bg-warning/25 text-warning-foreground",
    "Awaiting Receipt": "bg-info/12 text-info",
    Unpaid: "bg-destructive/12 text-destructive",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold",
        map[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}
