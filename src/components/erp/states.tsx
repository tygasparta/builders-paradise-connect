import type { ReactNode } from "react";
import { AlertCircle, Inbox, Lock, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Table skeleton sized to the real table, so the layout does not jump. */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2 p-1" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading records</span>
      <div className="flex gap-3 border-b border-border pb-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 py-2">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={cn("h-4 flex-1", c === 0 && "max-w-[38%]")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading figures</span>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-surface p-5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-4 h-7 w-32" />
          <Skeleton className="mt-3 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode | undefined;
  title: string;
  description?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-lg bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" />}
      </span>
      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "This didn't load",
  error,
  onRetry,
}: {
  title?: string | undefined;
  error?: unknown;
  onRetry?: (() => void) | undefined;
}) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : undefined;

  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center" role="alert">
      <span className="grid size-11 place-items-center rounded-lg bg-destructive/10 text-destructive">
        <AlertCircle className="size-5" />
      </span>
      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
      {message && <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{message}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          <RefreshCw className="size-3.5" />
          Try again
        </Button>
      )}
    </div>
  );
}

/** Shown in place of a screen the user's role does not reach. */
export function NoAccessState({ what = "this screen" }: { what?: string | undefined }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="grid size-11 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Lock className="size-5" />
      </span>
      <h3 className="mt-4 text-sm font-semibold">You do not have access to {what}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        Your role does not include this permission. Ask an administrator if you need it.
      </p>
    </div>
  );
}
