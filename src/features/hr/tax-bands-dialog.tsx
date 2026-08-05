import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/erp/form-field";
import { useSaveTaxBands } from "./payroll";
import { buildTaxBands, previewTax, validateBands, type BandDraft } from "./tax-bands";
import type { PayFrequency } from "@/lib/database.types";

function money(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function TaxBandsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSaveTaxBands();

  const [currency, setCurrency] = useState("USD");
  const [frequency, setFrequency] = useState<PayFrequency>("monthly");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [drafts, setDrafts] = useState<BandDraft[]>([
    { upperLimit: 100, ratePercent: 0 },
    { upperLimit: null, ratePercent: 20 },
  ]);
  const [preview, setPreview] = useState(500);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCurrency("USD");
    setFrequency("monthly");
    setEffectiveFrom(new Date().toISOString().slice(0, 10));
    setDrafts([
      { upperLimit: 100, ratePercent: 0 },
      { upperLimit: null, ratePercent: 20 },
    ]);
    setPreview(500);
    setServerError(null);
  }, [open]);

  const problems = useMemo(() => validateBands(drafts), [drafts]);
  const built = useMemo(
    () => (problems.length === 0 ? buildTaxBands(drafts) : []),
    [drafts, problems],
  );
  const problemFor = (index: number) => problems.find((p) => p.index === index)?.message;

  const setDraft = (index: number, patch: Partial<BandDraft>) =>
    setDrafts((current) => current.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  const onSubmit = async () => {
    setServerError(null);
    if (problems.length > 0) return;

    try {
      await save.mutateAsync(
        built.map((band) => ({
          currency_code: currency,
          pay_frequency: frequency,
          effective_from: effectiveFrom,
          lower_limit: band.lower_limit,
          upper_limit: band.upper_limit,
          rate: band.rate,
          cumulative_tax: band.cumulative_tax,
          description: null,
        })),
      );
      onOpenChange(false);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "The bands could not be saved.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set PAYE bands</DialogTitle>
          <DialogDescription>
            Enter the schedule as published: the ceiling of each band and its rate. The cumulative
            tax carried into each band is worked out here rather than typed, because getting it
            wrong understates every payslip in that band without saying so.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {serverError && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/8 px-3 py-2 text-td text-destructive"
            >
              {serverError}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Currency" htmlFor="band_currency" required>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="band_currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["USD", "ZWG", "ZAR"].map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Pay frequency" htmlFor="band_frequency" required>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as PayFrequency)}>
                <SelectTrigger id="band_frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["monthly", "fortnightly", "weekly", "daily"].map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="In force from"
              htmlFor="band_effective"
              required
              hint="Earlier runs keep their old bands."
            >
              <Input
                id="band_effective"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-td font-semibold">Bands</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setDrafts((current) => {
                    // The new band takes over as the open-ended one.
                    const previous = current.at(-1);
                    const ceiling = previous?.upperLimit ?? 0;
                    return [
                      ...current.slice(0, -1),
                      { upperLimit: ceiling + 100, ratePercent: previous?.ratePercent ?? 0 },
                      { upperLimit: null, ratePercent: (previous?.ratePercent ?? 0) + 5 },
                    ];
                  })
                }
              >
                <Plus className="size-3.5" />
                Add band
              </Button>
            </div>

            <div className="table-scroll rounded-lg border border-border">
              <table className="w-full text-td">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-helper uppercase tracking-wider text-muted-foreground">
                    <th className="p-2 text-right font-semibold">From</th>
                    <th className="w-32 p-2 text-right font-semibold">Up to</th>
                    <th className="w-24 p-2 text-right font-semibold">Rate %</th>
                    <th className="w-28 p-2 text-right font-semibold">Cumulative</th>
                    <th className="w-10 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((draft, index) => {
                    const problem = problemFor(index);
                    const band = built[index];
                    return (
                      <tr key={index} className="border-b border-border align-top last:border-0">
                        <td className="num p-2 text-right text-muted-foreground">
                          {index === 0 ? "0.00" : money(drafts[index - 1]?.upperLimit ?? 0)}
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="num h-9 text-right"
                            aria-label={`Upper limit for band ${index + 1}`}
                            placeholder="and above"
                            value={draft.upperLimit ?? ""}
                            onChange={(e) =>
                              setDraft(index, {
                                upperLimit: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                          />
                          {problem && (
                            <p className="mt-1 text-helper text-destructive">{problem}</p>
                          )}
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            className="num h-9 text-right"
                            aria-label={`Rate for band ${index + 1}`}
                            value={draft.ratePercent}
                            onChange={(e) =>
                              setDraft(index, { ratePercent: Number(e.target.value || 0) })
                            }
                          />
                        </td>
                        <td className="num p-2 text-right text-muted-foreground">
                          {band ? money(band.cumulative_tax) : "—"}
                        </td>
                        <td className="p-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Remove band ${index + 1}`}
                            disabled={drafts.length <= 1}
                            onClick={() =>
                              setDrafts((current) => {
                                const next = current.filter((_, i) => i !== index);
                                // Whatever is left must end open-ended.
                                if (next.length > 0) {
                                  next[next.length - 1] = {
                                    ...next[next.length - 1]!,
                                    upperLimit: null,
                                  };
                                }
                                return next;
                              })
                            }
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {problems.some((p) => p.index === -1) && (
              <p className="mt-2 flex items-center gap-1.5 text-helper text-destructive">
                <AlertTriangle className="size-3.5" aria-hidden />
                {problems.find((p) => p.index === -1)?.message}
              </p>
            )}
          </div>

          {/* Checking against a known figure catches a wrong band faster
              than reading the table does. */}
          <div className="rounded-lg bg-muted/60 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-helper text-muted-foreground">Someone earning</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="num h-8 w-32 text-right"
                aria-label="Preview taxable pay"
                value={preview}
                onChange={(e) => setPreview(Number(e.target.value || 0))}
              />
              <span className="text-helper text-muted-foreground">would pay</span>
              <span className="num text-td font-semibold">
                {built.length > 0 ? money(previewTax(built, preview)) : "—"}
              </span>
              {built.length > 0 && preview > 0 && (
                <span className="text-helper text-muted-foreground">
                  ({((previewTax(built, preview) / preview) * 100).toFixed(1)}% of pay)
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={problems.length > 0 || save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Save bands
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
