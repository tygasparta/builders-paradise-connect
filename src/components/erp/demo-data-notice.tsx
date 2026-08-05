import { FlaskConical } from "lucide-react";

/**
 * Marks a screen that is still rendering the pre-Supabase sample dataset
 * from `src/lib/erp-data.ts`.
 *
 * These screens were built before the database existed. They are kept
 * because their layout is the target for the phase named below — but every
 * figure on them is invented, and nobody should read them as trading data.
 * The notice comes off when the screen is wired to real tables.
 */
export function DemoDataNotice({ phase, module }: { phase: number; module: string }) {
  return (
    <div
      role="note"
      className="mb-5 flex items-start gap-2.5 rounded-lg border border-warning/35 bg-warning/10 px-3.5 py-3 text-td text-warning-foreground"
    >
      <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        <span className="font-semibold">Sample data — not live.</span> Every figure on this screen
        comes from a fixed demo dataset, not the database. {module} is wired to real data in Phase{" "}
        {phase}.
      </p>
    </div>
  );
}
