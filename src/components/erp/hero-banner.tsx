import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The control-centre banner that opens a module dashboard.
 *
 * Filled in the deep brand blue rather than the lighter identity blue —
 * white body text needs 4.5:1, and #1682E6 only reaches 3.91:1. Flat
 * colour, no gradient.
 */
export function HeroBanner({
  eyebrow,
  title,
  stats,
  actions,
  className,
}: {
  eyebrow: string;
  title: string;
  /** Rendered as a single "a · b · c" line beneath the title. */
  stats?: (string | null | undefined)[] | undefined;
  actions?: ReactNode | undefined;
  className?: string | undefined;
}) {
  const shown = (stats ?? []).filter(Boolean) as string[];

  return (
    <section
      className={cn(
        "mb-4 rounded-xl bg-primary px-5 py-5 text-primary-foreground md:px-6 md:py-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/75">
            <ShieldCheck className="size-3.5" aria-hidden />
            {eyebrow}
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
          {shown.length > 0 && <p className="mt-1.5 text-sm text-white/85">{shown.join(" · ")}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </section>
  );
}
