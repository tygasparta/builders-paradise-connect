import { AGING_BUCKETS, AGING_LABELS, type AgingSummary } from "@/lib/aging";
import { cn } from "@/lib/utils";

const TONE: Record<string, { bar: string; text: string }> = {
  current: { bar: "bg-success", text: "text-success" },
  "1-30": { bar: "bg-primary", text: "text-primary" },
  "31-60": { bar: "bg-warning", text: "text-warning-foreground" },
  "61-90": { bar: "bg-destructive/70", text: "text-destructive" },
  "90+": { bar: "bg-destructive", text: "text-destructive" },
};

function money(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Aging as a single proportional bar plus a figure per bucket.
 *
 * The bar carries the shape of the debt at a glance; the figures carry
 * the detail. Colour is never the only signal — every segment is also
 * labelled underneath.
 */
export function AgingBar({ summary, className }: { summary: AgingSummary; className?: string }) {
  const total = summary.total;

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={
          total === 0
            ? "Nothing outstanding"
            : AGING_BUCKETS.filter((b) => summary[b] > 0)
                .map((b) => `${AGING_LABELS[b]}: ${money(summary[b])}`)
                .join(", ")
        }
      >
        {total > 0 &&
          AGING_BUCKETS.map((bucket) =>
            summary[bucket] > 0 ? (
              <span
                key={bucket}
                className={TONE[bucket]?.bar}
                style={{ width: `${(summary[bucket] / total) * 100}%` }}
              />
            ) : null,
          )}
      </div>

      <dl className="grid grid-cols-5 gap-1 text-center">
        {AGING_BUCKETS.map((bucket) => (
          <div key={bucket}>
            <dt className="text-helper leading-tight text-muted-foreground">
              {AGING_LABELS[bucket]}
            </dt>
            <dd
              className={cn(
                "num mt-0.5 text-helper font-semibold",
                summary[bucket] > 0 ? TONE[bucket]?.text : "text-muted-foreground/50",
              )}
            >
              {money(summary[bucket])}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
