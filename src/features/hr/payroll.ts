import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { db, unwrap } from "@/lib/supabase";
import type {
  PayrollComponentRow,
  PayrollPeriodRow,
  PayrollRunRow,
  PayrollRunStatus,
  PayrollTaxBandRow,
  PayFrequency,
  PayslipRow,
} from "@/lib/database.types";

export type PayrollRunWithPeriod = PayrollRunRow & {
  period: { name: string; start_date: string; end_date: string; pay_date: string } | null;
  branch: { name: string } | null;
};

export type PayslipWithEmployee = PayslipRow & {
  employee: {
    employee_no: string;
    first_name: string;
    last_name: string;
    bank_name: string | null;
    bank_account_number: string | null;
  } | null;
};

export async function listPayrollRuns(status: PayrollRunStatus | null) {
  let query = db
    .from("payroll_runs")
    .select(
      `*,
       period:payroll_periods!payroll_runs_period_id_fkey(name, start_date, end_date, pay_date),
       branch:branches!payroll_runs_branch_id_fkey(name)`,
    )
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  return unwrap(await query) as unknown as PayrollRunWithPeriod[];
}

export async function listPayslips(runId: string): Promise<PayslipWithEmployee[]> {
  return unwrap(
    await db
      .from("payslips")
      .select(
        `*, employee:employees!payslips_employee_id_fkey(
           employee_no, first_name, last_name, bank_name, bank_account_number)`,
      )
      .eq("run_id", runId)
      .order("payslip_no"),
  ) as unknown as PayslipWithEmployee[];
}

export async function listPayrollPeriods(): Promise<PayrollPeriodRow[]> {
  return unwrap(
    await db
      .from("payroll_periods")
      .select("*")
      .order("fiscal_year", { ascending: false })
      .order("period_no", { ascending: false }),
  ) as PayrollPeriodRow[];
}

export async function listPayrollComponents(): Promise<PayrollComponentRow[]> {
  return unwrap(
    await db.from("payroll_components").select("*").order("sort_order"),
  ) as PayrollComponentRow[];
}

export async function listTaxBands(): Promise<PayrollTaxBandRow[]> {
  return unwrap(
    await db
      .from("payroll_tax_bands")
      .select("*")
      .order("currency_code")
      .order("effective_from", { ascending: false })
      .order("lower_limit"),
  ) as PayrollTaxBandRow[];
}

export type PayrollPeriodInput = {
  name: string;
  fiscal_year: number;
  period_no: number;
  start_date: string;
  end_date: string;
  pay_date: string;
  pay_frequency: PayFrequency;
};

export async function createPayrollPeriod(input: PayrollPeriodInput): Promise<void> {
  const rows = unwrap(await db.from("payroll_periods").insert(input).select("id")) as {
    id: string;
  }[];
  if (rows.length === 0) throw new Error("The period could not be created.");
}

export async function createPayrollRun(input: {
  period_id: string;
  branch_id: string | null;
  description: string | null;
}): Promise<string> {
  const { data: number, error } = await db.rpc("next_document_number", {
    p_doc_type: "payroll_run",
  });
  if (error) throw new Error(error.message);

  const rows = unwrap(
    await db
      .from("payroll_runs")
      .insert({ ...input, run_no: number as unknown as string, status: "draft" })
      .select("run_no"),
  ) as { run_no: string }[];

  return rows[0]?.run_no ?? (number as unknown as string);
}

export async function calculatePayrollRun(runId: string): Promise<number> {
  const { data, error } = await db.rpc("calculate_payroll_run", { p_run_id: runId });
  if (error) throw new Error(error.message);
  return data as unknown as number;
}

export async function postPayrollRun(runId: string): Promise<string> {
  const { data, error } = await db.rpc("post_payroll_run", { p_run_id: runId });
  if (error) throw new Error(error.message);
  return data as unknown as string;
}

export async function setRunStatus(id: string, status: PayrollRunStatus): Promise<void> {
  const now = new Date().toISOString();
  const patch: Partial<
    Omit<PayrollRunRow, "id" | "created_at" | "updated_at" | "created_by" | "updated_by">
  > = {
    status,
    ...(status === "approved" ? { approved_at: now } : {}),
    ...(status === "paid" ? { paid_at: now } : {}),
  };

  const rows = unwrap(await db.from("payroll_runs").update(patch).eq("id", id).select("id")) as {
    id: string;
  }[];
  if (rows.length === 0) {
    throw new Error("The run could not be updated. You may not have permission.");
  }
}

export async function saveTaxBands(
  bands: Omit<
    PayrollTaxBandRow,
    "id" | "created_at" | "updated_at" | "created_by" | "updated_by"
  >[],
): Promise<void> {
  if (bands.length === 0) return;
  unwrap(await db.from("payroll_tax_bands").insert(bands).select("id"));
}

// ---------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------

export const payrollKeys = {
  all: ["payroll"] as const,
  runs: (status: string | null) => ["payroll", "runs", status ?? "all"] as const,
  payslips: (runId: string) => ["payroll", "payslips", runId] as const,
  periods: ["payroll", "periods"] as const,
  components: ["payroll", "components"] as const,
  taxBands: ["payroll", "tax-bands"] as const,
};

export function usePayrollRuns(status: PayrollRunStatus | null) {
  return useQuery({
    queryKey: payrollKeys.runs(status),
    queryFn: () => listPayrollRuns(status),
    staleTime: 30_000,
  });
}

export function usePayslips(runId: string | null) {
  return useQuery({
    queryKey: payrollKeys.payslips(runId ?? ""),
    queryFn: () => listPayslips(runId as string),
    enabled: Boolean(runId),
    staleTime: 30_000,
  });
}

export function usePayrollPeriods() {
  return useQuery({
    queryKey: payrollKeys.periods,
    queryFn: listPayrollPeriods,
    staleTime: 5 * 60_000,
  });
}

export function usePayrollComponents() {
  return useQuery({
    queryKey: payrollKeys.components,
    queryFn: listPayrollComponents,
    staleTime: 5 * 60_000,
  });
}

export function useTaxBands() {
  return useQuery({ queryKey: payrollKeys.taxBands, queryFn: listTaxBands, staleTime: 5 * 60_000 });
}

export function useCreatePayrollPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPayrollPeriod,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: payrollKeys.all });
      toast.success("Pay period created");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCreatePayrollRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPayrollRun,
    onSuccess: (number) => {
      void queryClient.invalidateQueries({ queryKey: payrollKeys.all });
      toast.success(`${number} created — calculate it next`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCalculatePayrollRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: calculatePayrollRun,
    onSuccess: (count) => {
      void queryClient.invalidateQueries({ queryKey: payrollKeys.all });
      toast.success(`${count} payslip${count === 1 ? "" : "s"} calculated`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function usePostPayrollRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postPayrollRun,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: payrollKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      toast.success("Payroll posted to the ledger");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetRunStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PayrollRunStatus }) =>
      setRunStatus(id, status),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: payrollKeys.all });
      const labels: Record<string, string> = {
        approved: "Run approved — it can now be posted",
        paid: "Marked as paid",
        cancelled: "Run cancelled",
      };
      toast.success(labels[variables.status] ?? "Run updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSaveTaxBands() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveTaxBands,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: payrollKeys.taxBands });
      toast.success("Tax bands saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export const RUN_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  calculated: "Calculated",
  approved: "Approved",
  posted: "Posted",
  paid: "Paid",
  cancelled: "Cancelled",
};
