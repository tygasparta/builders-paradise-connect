import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Download,
  Loader2,
  Plus,
  Receipt,
  Upload,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/erp/page-header";
import { RequirePermission } from "@/components/erp/permission-gate";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/erp/states";
import { SectionCard } from "@/components/erp/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/erp/form-field";
import {
  RUN_STATUS_LABELS,
  useCalculatePayrollRun,
  useCreatePayrollPeriod,
  useCreatePayrollRun,
  usePayrollComponents,
  usePayrollPeriods,
  usePayrollRuns,
  usePayslips,
  usePostPayrollRun,
  useSetRunStatus,
  useTaxBands,
  type PayrollRunWithPeriod,
} from "@/features/hr/payroll";
import { useBranches } from "@/features/branches/hooks";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import { downloadCsv } from "@/lib/export";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/payroll")({
  component: PayrollPage,
});

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  calculated: "bg-info/12 text-info",
  approved: "bg-warning/20 text-warning-foreground",
  posted: "bg-success/12 text-success",
  paid: "bg-success/12 text-success",
  cancelled: "bg-destructive/12 text-destructive",
};

function PayrollPage() {
  return (
    <RequirePermission require={PERMISSIONS.PAYROLL_VIEW} what="payroll">
      <PayrollScreen />
    </RequirePermission>
  );
}

function PayrollScreen() {
  const taxBands = useTaxBands();
  const configured = (taxBands.data?.length ?? 0) > 0;

  return (
    <>
      <PageHeader
        title="Payroll"
        description="Pay periods, runs and payslips. Posting debits wages and credits net pay and statutory deductions."
        breadcrumbs={[{ label: "People" }, { label: "Payroll" }]}
      />

      {!taxBands.isLoading && !configured && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden />
          <div>
            <p className="font-semibold">No PAYE bands are configured</p>
            <p className="mt-0.5 text-muted-foreground">
              Payroll will refuse to calculate until they are set. That is deliberate: a run that
              quietly computed nil tax would understate the statutory liability. Add the current
              bands from the ZIMRA schedule on the Tax bands tab.
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="runs">
        <TabsList>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="periods">Periods</TabsTrigger>
          <TabsTrigger value="bands">Tax bands</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="mt-4">
          <RunsTab />
        </TabsContent>
        <TabsContent value="periods" className="mt-4">
          <PeriodsTab />
        </TabsContent>
        <TabsContent value="bands" className="mt-4">
          <TaxBandsTab />
        </TabsContent>
        <TabsContent value="components" className="mt-4">
          <ComponentsTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

// ---------------------------------------------------------------------

function RunsTab() {
  const { can } = usePermissions();
  const canCreate = can(PERMISSIONS.PAYROLL_RUNS_CREATE);
  const canCalculate = can(PERMISSIONS.PAYROLL_RUNS_CALCULATE);
  const canApprove = can(PERMISSIONS.PAYROLL_RUNS_APPROVE);
  const canPost = can(PERMISSIONS.PAYROLL_RUNS_POST);
  const canMarkPaid = can(PERMISSIONS.PAYROLL_RUNS_MARK_PAID);

  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<PayrollRunWithPeriod | null>(null);
  const [posting, setPosting] = useState<PayrollRunWithPeriod | null>(null);

  const runs = usePayrollRuns(null);
  const calculate = useCalculatePayrollRun();
  const post = usePostPayrollRun();
  const setStatus = useSetRunStatus();

  return (
    <>
      <SectionCard
        title="Payroll runs"
        description="draft → calculated → approved → posted → paid"
        bodyClassName="p-0"
        actions={
          canCreate ? (
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-3.5" />
              New run
            </Button>
          ) : undefined
        }
      >
        {runs.isLoading ? (
          <div className="p-4">
            <TableSkeleton columns={5} rows={4} />
          </div>
        ) : runs.isError ? (
          <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />
        ) : (runs.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<Wallet className="size-5" />}
            title="No payroll runs yet"
            description="Create a pay period, then a run against it."
          />
        ) : (
          <ul className="divide-y divide-border">
            {runs.data?.map((run) => (
              <li key={run.id} className="px-5 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setSelected(run)}
                  >
                    <p className="num text-xs font-medium">{run.run_no}</p>
                    <p className="truncate text-sm">{run.period?.name ?? "Period removed"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {run.employee_count > 0
                        ? `${plural(run.employee_count, "employee")}`
                        : "Not yet calculated"}
                      {run.branch ? ` · ${run.branch.name}` : ""}
                      {run.period
                        ? ` · paid ${format(new Date(run.period.pay_date), "dd MMM")}`
                        : ""}
                    </p>
                  </button>

                  <div className="text-right">
                    <p className="num text-sm font-semibold">{money(run.total_net)}</p>
                    <p className="num text-[11px] text-muted-foreground">
                      net of {money(run.total_deductions)}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      TONE[run.status] ?? "bg-muted text-muted-foreground",
                    )}
                  >
                    {RUN_STATUS_LABELS[run.status] ?? run.status}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {canCalculate && ["draft", "calculated"].includes(run.status) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={calculate.isPending}
                      onClick={() => calculate.mutate(run.id)}
                    >
                      {calculate.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Calculator className="size-3.5" />
                      )}
                      {run.status === "draft" ? "Calculate" : "Recalculate"}
                    </Button>
                  )}
                  {canApprove && run.status === "calculated" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => setStatus.mutate({ id: run.id, status: "approved" })}
                    >
                      <CheckCircle2 className="size-3.5" />
                      Approve
                    </Button>
                  )}
                  {canPost && run.status === "approved" && (
                    <Button size="sm" className="h-8" onClick={() => setPosting(run)}>
                      <Upload className="size-3.5" />
                      Post to ledger
                    </Button>
                  )}
                  {canMarkPaid && run.status === "posted" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => setStatus.mutate({ id: run.id, status: "paid" })}
                    >
                      <Wallet className="size-3.5" />
                      Mark as paid
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => setSelected(run)}
                  >
                    <Receipt className="size-3.5" />
                    Payslips
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <NewRunDialog open={formOpen} onOpenChange={setFormOpen} />
      <PayslipsDialog run={selected} onOpenChange={() => setSelected(null)} />

      <AlertDialog open={Boolean(posting)} onOpenChange={(open) => !open && setPosting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post {posting?.run_no}?</AlertDialogTitle>
            <AlertDialogDescription>
              This debits Salaries and Wages {money(posting?.total_gross)} and, where there are
              employer contributions, Employer Statutory Contributions{" "}
              {money(posting?.total_employer_cost)}. It credits Payroll Liabilities{" "}
              {money(posting?.total_net)} for net pay and Statutory Deductions Payable for PAYE and
              statutory amounts. A posted run cannot be recalculated — a correction is a reversing
              journal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (posting) post.mutate(posting.id);
                setPosting(null);
              }}
            >
              Post payroll
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function NewRunDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreatePayrollRun();
  const { data: periods } = usePayrollPeriods();
  const { data: branches } = useBranches();

  const [periodId, setPeriodId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [description, setDescription] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPeriodId("");
    setBranchId("");
    setDescription("");
    setServerError(null);
  }, [open]);

  const openPeriods = (periods ?? []).filter((p) => p.status === "open");

  const onSubmit = async () => {
    setServerError(null);
    if (!periodId) return setServerError("Choose the pay period.");

    try {
      await create.mutateAsync({
        period_id: periodId,
        branch_id: branchId || null,
        description: description.trim() || null,
      });
      onOpenChange(false);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "The run could not be created.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New payroll run</DialogTitle>
          <DialogDescription>
            Created as a draft. Calculating builds a payslip for every active employee in the
            period.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {serverError && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive"
            >
              {serverError}
            </p>
          )}

          <Field label="Pay period" htmlFor="run_period" required>
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger id="run_period">
                <SelectValue placeholder={openPeriods.length ? "Choose" : "No open periods"} />
              </SelectTrigger>
              <SelectContent>
                {openPeriods.map((period) => (
                  <SelectItem key={period.id} value={period.id}>
                    {period.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Branch" htmlFor="run_branch" hint="Leave empty for everyone.">
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger id="run_branch">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                {branches?.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Description" htmlFor="run_description">
            <Input
              id="run_description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="August salaries"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={create.isPending}>
            {create.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Create run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayslipsDialog({
  run,
  onOpenChange,
}: {
  run: PayrollRunWithPeriod | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { can } = usePermissions();
  const canExport = can(PERMISSIONS.REPORTS_EXPORT);
  const payslips = usePayslips(run?.id ?? null);

  const exportSlips = () => {
    const rows = payslips.data ?? [];
    downloadCsv(`Payslips ${run?.run_no ?? ""}`, rows, [
      { header: "Payslip", value: (p) => p.payslip_no },
      { header: "Employee number", value: (p) => p.employee?.employee_no },
      { header: "First name", value: (p) => p.employee?.first_name },
      { header: "Last name", value: (p) => p.employee?.last_name },
      { header: "Basic", value: (p) => Number(p.basic_salary).toFixed(2) },
      { header: "Gross", value: (p) => Number(p.gross_pay).toFixed(2) },
      { header: "Taxable", value: (p) => Number(p.taxable_income).toFixed(2) },
      { header: "PAYE", value: (p) => Number(p.paye).toFixed(2) },
      { header: "Statutory", value: (p) => Number(p.statutory_deductions).toFixed(2) },
      { header: "Other deductions", value: (p) => Number(p.other_deductions).toFixed(2) },
      { header: "Net pay", value: (p) => Number(p.net_pay).toFixed(2) },
      { header: "Bank", value: (p) => p.employee?.bank_name },
      { header: "Account", value: (p) => p.employee?.bank_account_number },
    ]);
    toast.success(`${plural(rows.length, "payslip")} exported`);
  };

  return (
    <Dialog open={Boolean(run)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payslips — {run?.run_no}</DialogTitle>
          <DialogDescription>
            {run?.period?.name} · {plural(run?.employee_count ?? 0, "employee")}
          </DialogDescription>
        </DialogHeader>

        {payslips.isLoading ? (
          <TableSkeleton columns={5} rows={6} />
        ) : (payslips.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<Receipt className="size-5" />}
            title="No payslips yet"
            description="Calculate the run to build them."
          />
        ) : (
          <>
            <div className="table-scroll rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="p-2 text-left font-semibold">Employee</th>
                    <th className="p-2 text-right font-semibold">Gross</th>
                    <th className="p-2 text-right font-semibold">PAYE</th>
                    <th className="p-2 text-right font-semibold">Deductions</th>
                    <th className="p-2 text-right font-semibold">Net pay</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.data?.map((payslip) => (
                    <tr key={payslip.id} className="border-b border-border last:border-0">
                      <td className="p-2">
                        <p className="text-sm">
                          {payslip.employee?.first_name} {payslip.employee?.last_name}
                        </p>
                        <p className="num text-[11px] text-muted-foreground">
                          {payslip.employee?.employee_no} · {payslip.payslip_no}
                        </p>
                      </td>
                      <td className="num p-2 text-right">{money(payslip.gross_pay)}</td>
                      <td className="num p-2 text-right">{money(payslip.paye)}</td>
                      <td className="num p-2 text-right text-muted-foreground">
                        {money(payslip.total_deductions)}
                      </td>
                      <td className="num p-2 text-right font-semibold">{money(payslip.net_pay)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="p-2">Total</td>
                    <td className="num p-2 text-right">{money(run?.total_gross)}</td>
                    <td className="num p-2 text-right">{money(run?.total_paye)}</td>
                    <td className="num p-2 text-right">{money(run?.total_deductions)}</td>
                    <td className="num p-2 text-right">{money(run?.total_net)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {canExport && (
              <DialogFooter>
                <Button variant="outline" onClick={exportSlips}>
                  <Download className="size-4" />
                  Export for the bank
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------

function PeriodsTab() {
  const { can } = usePermissions();
  const canCreate = can(PERMISSIONS.PAYROLL_RUNS_CREATE);
  const periods = usePayrollPeriods();
  const create = useCreatePayrollPeriod();

  const [open, setOpen] = useState(false);
  const now = new Date();
  const [form, setForm] = useState({
    name: "",
    fiscal_year: now.getFullYear(),
    period_no: now.getMonth() + 1,
    start_date: "",
    end_date: "",
    pay_date: "",
  });

  useEffect(() => {
    if (!open) return;
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 0));
    setForm({
      name: format(start, "MMMM yyyy"),
      fiscal_year: year,
      period_no: month + 1,
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      pay_date: end.toISOString().slice(0, 10),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <SectionCard
        title="Pay periods"
        description="A run belongs to one period. Closing a period stops new runs against it."
        bodyClassName="p-0"
        actions={
          canCreate ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="size-3.5" />
              New period
            </Button>
          ) : undefined
        }
      >
        {periods.isLoading ? (
          <div className="p-4">
            <TableSkeleton columns={3} rows={4} />
          </div>
        ) : (periods.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<Wallet className="size-5" />}
            title="No pay periods"
            description="Create one for the month you are paying."
          />
        ) : (
          <ul className="divide-y divide-border">
            {periods.data?.map((period) => (
              <li key={period.id} className="flex items-center justify-between px-5 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{period.name}</p>
                  <p className="num text-[11px] text-muted-foreground">
                    {format(new Date(period.start_date), "dd MMM")} –{" "}
                    {format(new Date(period.end_date), "dd MMM yyyy")} · pay{" "}
                    {format(new Date(period.pay_date), "dd MMM")}
                  </p>
                </div>
                <Badge
                  variant={period.status === "open" ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {period.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New pay period</DialogTitle>
            <DialogDescription>Defaults to the current calendar month.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Field label="Name" htmlFor="period_name" required>
              <Input
                id="period_name"
                value={form.name}
                onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Year" htmlFor="period_year" required>
                <Input
                  id="period_year"
                  type="number"
                  className="num"
                  value={form.fiscal_year}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, fiscal_year: Number(e.target.value || 0) }))
                  }
                />
              </Field>
              <Field label="Period number" htmlFor="period_no" required hint="1–12 for months.">
                <Input
                  id="period_no"
                  type="number"
                  min="1"
                  className="num"
                  value={form.period_no}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, period_no: Number(e.target.value || 0) }))
                  }
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="From" htmlFor="period_start" required>
                <Input
                  id="period_start"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((c) => ({ ...c, start_date: e.target.value }))}
                />
              </Field>
              <Field label="To" htmlFor="period_end" required>
                <Input
                  id="period_end"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((c) => ({ ...c, end_date: e.target.value }))}
                />
              </Field>
              <Field label="Pay date" htmlFor="period_pay" required>
                <Input
                  id="period_pay"
                  type="date"
                  value={form.pay_date}
                  onChange={(e) => setForm((c) => ({ ...c, pay_date: e.target.value }))}
                />
              </Field>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                create.mutate(
                  { ...form, pay_frequency: "monthly" },
                  { onSuccess: () => setOpen(false) },
                );
              }}
              disabled={create.isPending}
            >
              {create.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Create period
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TaxBandsTab() {
  const bands = useTaxBands();

  return (
    <SectionCard
      title="PAYE bands"
      description="Cumulative marginal bands. Tax = (taxable − lower limit) × rate + cumulative tax."
      bodyClassName="p-0"
    >
      {bands.isLoading ? (
        <div className="p-4">
          <TableSkeleton columns={4} rows={4} />
        </div>
      ) : (bands.data?.length ?? 0) === 0 ? (
        <div className="px-5 py-8">
          <EmptyState
            icon={<AlertTriangle className="size-5" />}
            title="No bands configured"
            description="Payroll refuses to calculate without these. They ship empty on purpose — rates change, and a wrong rate silently understates every payslip. Enter the current schedule from ZIMRA."
          />
          <p className="mx-auto mt-4 max-w-xl rounded-lg bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
            Each band needs a lower limit, an optional upper limit, a rate as a decimal (0.20 for
            20%), and the cumulative tax carried from the bands below it. The top band has no upper
            limit. Bands are per currency and pay frequency, effective from a date — adding a new
            set for a later date leaves history intact.
          </p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="p-2 text-left font-semibold">Effective</th>
                <th className="p-2 text-right font-semibold">From</th>
                <th className="p-2 text-right font-semibold">To</th>
                <th className="p-2 text-right font-semibold">Rate</th>
                <th className="p-2 text-right font-semibold">Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {bands.data?.map((band) => (
                <tr key={band.id} className="border-b border-border last:border-0">
                  <td className="p-2">
                    <span className="num text-xs">
                      {format(new Date(band.effective_from), "dd MMM yyyy")}
                    </span>
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      {band.currency_code} · {band.pay_frequency}
                    </span>
                  </td>
                  <td className="num p-2 text-right">{money(band.lower_limit)}</td>
                  <td className="num p-2 text-right">
                    {band.upper_limit === null ? "and above" : money(band.upper_limit)}
                  </td>
                  <td className="num p-2 text-right font-medium">
                    {(Number(band.rate) * 100).toFixed(1)}%
                  </td>
                  <td className="num p-2 text-right text-muted-foreground">
                    {money(band.cumulative_tax)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function ComponentsTab() {
  const components = usePayrollComponents();

  return (
    <SectionCard
      title="Pay components"
      description="Allowances and deductions assigned to staff. Rates are left empty until set."
      bodyClassName="p-0"
    >
      {components.isLoading ? (
        <div className="p-4">
          <TableSkeleton columns={3} rows={6} />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {components.data?.map((component) => (
            <li key={component.id} className="flex items-center gap-3 px-5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{component.name}</p>
                <p className="num text-[11px] text-muted-foreground">
                  {component.code} · {component.calculation.replace(/_/g, " ")}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px]",
                    component.component_type === "earning"
                      ? "bg-success/12 text-success"
                      : "bg-destructive/12 text-destructive",
                  )}
                >
                  {component.component_type}
                </Badge>
                {component.is_statutory && (
                  <Badge variant="secondary" className="text-[10px]">
                    statutory
                  </Badge>
                )}
                {component.is_employer_contribution && (
                  <Badge variant="secondary" className="text-[10px]">
                    employer
                  </Badge>
                )}
                {!component.is_taxable && (
                  <Badge variant="secondary" className="text-[10px]">
                    pre-tax
                  </Badge>
                )}
              </div>
              <span className="num w-20 text-right text-xs text-muted-foreground">
                {component.calculation === "fixed"
                  ? Number(component.default_amount) > 0
                    ? money(component.default_amount)
                    : "not set"
                  : Number(component.default_rate) > 0
                    ? `${(Number(component.default_rate) * 100).toFixed(2)}%`
                    : "not set"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
