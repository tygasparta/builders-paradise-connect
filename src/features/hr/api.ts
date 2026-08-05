import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { db, unwrap } from "@/lib/supabase";
import type {
  AttendanceRow,
  AttendanceStatus,
  DepartmentRow,
  EmployeeSecureRow,
  EmployeeStatus,
  EmploymentType,
  LeaveRequestRow,
  LeaveStatus,
  LeaveTypeRow,
  PayFrequency,
  PositionRow,
} from "@/lib/database.types";

export type EmployeeWithRefs = EmployeeSecureRow & {
  department: { name: string } | null;
  position: { title: string } | null;
  branch: { name: string } | null;
};

const EMPLOYEE_SELECT: string = `
  *,
  department:departments!employees_department_id_fkey(name),
  position:positions!employees_position_id_fkey(title),
  branch:branches!employees_branch_id_fkey(name)
`;

/**
 * Reads the masking view, not the table: it nulls pay columns for anyone
 * without employees.salary.view. Postgres RLS cannot hide one column.
 */
export async function listEmployees(includeInactive: boolean): Promise<EmployeeWithRefs[]> {
  let query = db.from("employees_secure").select(EMPLOYEE_SELECT).order("employee_no");
  if (!includeInactive) query = query.in("status", ["active", "probation", "suspended"]);
  return unwrap(await query) as unknown as EmployeeWithRefs[];
}

export async function listDepartments(): Promise<DepartmentRow[]> {
  return unwrap(await db.from("departments").select("*").order("name")) as DepartmentRow[];
}

export async function listPositions(): Promise<PositionRow[]> {
  return unwrap(await db.from("positions").select("*").order("title")) as PositionRow[];
}

export async function listLeaveTypes(): Promise<LeaveTypeRow[]> {
  return unwrap(
    await db.from("leave_types").select("*").eq("status", "active").order("name"),
  ) as LeaveTypeRow[];
}

export type LeaveRequestWithRefs = LeaveRequestRow & {
  employee: { employee_no: string; first_name: string; last_name: string } | null;
  leave_type: { code: string; name: string; is_paid: boolean } | null;
};

export async function listLeaveRequests(
  status: LeaveStatus | null,
): Promise<LeaveRequestWithRefs[]> {
  let query = db
    .from("leave_requests")
    .select(
      `*,
       employee:employees!leave_requests_employee_id_fkey(employee_no, first_name, last_name),
       leave_type:leave_types!leave_requests_leave_type_id_fkey(code, name, is_paid)`,
    )
    .order("start_date", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  return unwrap(await query) as unknown as LeaveRequestWithRefs[];
}

export type AttendanceWithEmployee = AttendanceRow & {
  employee: { employee_no: string; first_name: string; last_name: string } | null;
};

export async function listAttendance(date: string): Promise<AttendanceWithEmployee[]> {
  return unwrap(
    await db
      .from("attendance")
      .select(
        `*, employee:employees!attendance_employee_id_fkey(employee_no, first_name, last_name)`,
      )
      .eq("attendance_date", date)
      .order("created_at"),
  ) as unknown as AttendanceWithEmployee[];
}

// ---------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------

export type EmployeeInput = {
  first_name: string;
  last_name: string;
  other_names: string | null;
  national_id: string | null;
  date_of_birth: string | null;
  gender: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  position_id: string | null;
  department_id: string | null;
  branch_id: string | null;
  employment_type: EmploymentType;
  hire_date: string;
  basic_salary: number;
  currency_code: string;
  pay_frequency: PayFrequency;
  bank_name: string | null;
  bank_account_number: string | null;
  tax_number: string | null;
  nssa_number: string | null;
  status: EmployeeStatus;
  notes: string | null;
};

export async function saveEmployee(input: EmployeeInput & { id?: string }): Promise<void> {
  const { id, ...values } = input;

  if (id) {
    const rows = unwrap(await db.from("employees").update(values).eq("id", id).select("id")) as {
      id: string;
    }[];
    if (rows.length === 0) throw new Error("The employee could not be saved.");
    return;
  }

  const { data: number, error } = await db.rpc("next_document_number", {
    p_doc_type: "employee",
  });
  if (error) throw new Error(error.message);

  const rows = unwrap(
    await db
      .from("employees")
      .insert({ ...values, employee_no: number as unknown as string })
      .select("id"),
  ) as { id: string }[];
  if (rows.length === 0) throw new Error("The employee could not be created.");
}

export async function terminateEmployee(
  id: string,
  status: EmployeeStatus,
  date: string,
  reason: string,
): Promise<void> {
  const rows = unwrap(
    await db
      .from("employees")
      .update({ status, termination_date: date, termination_reason: reason })
      .eq("id", id)
      .select("id"),
  ) as { id: string }[];
  if (rows.length === 0) throw new Error("The employee could not be updated.");
}

export type LeaveRequestInput = {
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
};

export async function createLeaveRequest(input: LeaveRequestInput): Promise<string> {
  const { data: number, error } = await db.rpc("next_document_number", {
    p_doc_type: "leave_request",
  });
  if (error) throw new Error(error.message);

  const rows = unwrap(
    await db
      .from("leave_requests")
      .insert({ ...input, request_no: number as unknown as string, status: "submitted" })
      .select("request_no"),
  ) as { request_no: string }[];

  return rows[0]?.request_no ?? (number as unknown as string);
}

export async function setLeaveStatus(id: string, status: LeaveStatus): Promise<void> {
  const patch: Partial<
    Omit<LeaveRequestRow, "id" | "created_at" | "updated_at" | "created_by" | "updated_by">
  > = {
    status,
    ...(status === "approved" ? { approved_at: new Date().toISOString() } : {}),
  };
  const rows = unwrap(await db.from("leave_requests").update(patch).eq("id", id).select("id")) as {
    id: string;
  }[];
  if (rows.length === 0) {
    throw new Error("The request could not be updated. You may not have permission.");
  }
}

export async function upsertAttendance(
  rows: {
    employee_id: string;
    attendance_date: string;
    status: string;
    hours_worked: number | null;
    overtime_hours: number;
  }[],
): Promise<void> {
  if (rows.length === 0) return;
  unwrap(
    await db
      .from("attendance")
      .upsert(rows, { onConflict: "employee_id,attendance_date" })
      .select("id"),
  );
}

// ---------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------

export const hrKeys = {
  all: ["hr"] as const,
  employees: (inactive: boolean) => ["hr", "employees", inactive] as const,
  departments: ["hr", "departments"] as const,
  positions: ["hr", "positions"] as const,
  leaveTypes: ["hr", "leave-types"] as const,
  leaveRequests: (status: string | null) => ["hr", "leave", status ?? "all"] as const,
  attendance: (date: string) => ["hr", "attendance", date] as const,
};

export function useEmployees(includeInactive = false) {
  return useQuery({
    queryKey: hrKeys.employees(includeInactive),
    queryFn: () => listEmployees(includeInactive),
    staleTime: 60_000,
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: hrKeys.departments,
    queryFn: listDepartments,
    staleTime: 5 * 60_000,
  });
}

export function usePositions() {
  return useQuery({ queryKey: hrKeys.positions, queryFn: listPositions, staleTime: 5 * 60_000 });
}

export function useLeaveTypes() {
  return useQuery({ queryKey: hrKeys.leaveTypes, queryFn: listLeaveTypes, staleTime: 5 * 60_000 });
}

export function useLeaveRequests(status: LeaveStatus | null) {
  return useQuery({
    queryKey: hrKeys.leaveRequests(status),
    queryFn: () => listLeaveRequests(status),
    staleTime: 30_000,
  });
}

export function useAttendance(date: string) {
  return useQuery({
    queryKey: hrKeys.attendance(date),
    queryFn: () => listAttendance(date),
    staleTime: 30_000,
  });
}

export function useSaveEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveEmployee,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: hrKeys.all });
      toast.success(variables.id ? "Employee updated" : "Employee added");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useTerminateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      date,
      reason,
    }: {
      id: string;
      status: EmployeeStatus;
      date: string;
      reason: string;
    }) => terminateEmployee(id, status, date, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hrKeys.all });
      toast.success("Employee record closed");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createLeaveRequest,
    onSuccess: (number) => {
      void queryClient.invalidateQueries({ queryKey: hrKeys.all });
      toast.success(`${number} submitted for approval`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetLeaveStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeaveStatus }) => setLeaveStatus(id, status),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: hrKeys.all });
      const labels: Record<string, string> = {
        approved: "Leave approved",
        rejected: "Leave rejected",
        cancelled: "Request cancelled",
        taken: "Marked as taken",
      };
      toast.success(labels[variables.status] ?? "Request updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSaveAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: upsertAttendance,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hrKeys.all });
      toast.success("Attendance saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export const EMPLOYEE_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  probation: "On probation",
  suspended: "Suspended",
  terminated: "Terminated",
  resigned: "Resigned",
  retired: "Retired",
};

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  permanent: "Permanent",
  contract: "Contract",
  casual: "Casual",
  intern: "Intern",
  part_time: "Part time",
};

export const LEAVE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  taken: "Taken",
};

export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half day",
  leave: "On leave",
  holiday: "Holiday",
  sick: "Sick",
};

/** Working days between two dates, excluding weekends. */
export function workingDaysBetween(start: string, end: string): number {
  const from = new Date(`${start}T00:00:00Z`);
  const to = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0;

  let days = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) days += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
