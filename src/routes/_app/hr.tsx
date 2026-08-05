import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  UserMinus,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/erp/page-header";
import { DataTable } from "@/components/erp/data-table";
import { RequirePermission } from "@/components/erp/permission-gate";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/erp/states";
import { SectionCard } from "@/components/erp/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/erp/form-field";
import {
  ATTENDANCE_STATUS_LABELS,
  EMPLOYEE_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  LEAVE_STATUS_LABELS,
  useAttendance,
  useCreateLeaveRequest,
  useDepartments,
  useEmployees,
  useLeaveRequests,
  useLeaveTypes,
  usePositions,
  useSaveAttendance,
  useSaveEmployee,
  useSetLeaveStatus,
  useTerminateEmployee,
  workingDaysBetween,
  type EmployeeWithRefs,
  type LeaveRequestWithRefs,
} from "@/features/hr/api";
import { useBranches } from "@/features/branches/hooks";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import type {
  AttendanceStatus,
  EmployeeStatus,
  EmploymentType,
  LeaveStatus,
  PayFrequency,
} from "@/lib/database.types";
import { downloadCsv } from "@/lib/export";
import { plural } from "@/lib/format";

export const Route = createFileRoute("/_app/hr")({
  component: HumanResourcesPage,
});

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const EMPLOYEE_TONE: Record<string, string> = {
  active: "bg-success/12 text-success",
  probation: "bg-info/12 text-info",
  suspended: "bg-warning/20 text-warning-foreground",
  terminated: "bg-destructive/12 text-destructive",
  resigned: "bg-muted text-muted-foreground",
  retired: "bg-muted text-muted-foreground",
};

const LEAVE_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-warning/20 text-warning-foreground",
  approved: "bg-success/12 text-success",
  rejected: "bg-destructive/12 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  taken: "bg-info/12 text-info",
};

function HumanResourcesPage() {
  return (
    <RequirePermission require={PERMISSIONS.HR_VIEW} what="human resources">
      <HumanResourcesScreen />
    </RequirePermission>
  );
}

function HumanResourcesScreen() {
  return (
    <>
      <PageHeader
        title="Human resources"
        description="People, leave and attendance. Pay is set here and used by payroll — it is never typed twice."
        breadcrumbs={[{ label: "People" }, { label: "Human resources" }]}
      />

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="structure">Structure</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="mt-4">
          <EmployeesTab />
        </TabsContent>
        <TabsContent value="leave" className="mt-4">
          <LeaveTab />
        </TabsContent>
        <TabsContent value="attendance" className="mt-4">
          <AttendanceTab />
        </TabsContent>
        <TabsContent value="structure" className="mt-4">
          <StructureTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

// ---------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------

function EmployeesTab() {
  const { can } = usePermissions();
  const canCreate = can(PERMISSIONS.EMPLOYEES_CREATE);
  const canUpdate = can(PERMISSIONS.EMPLOYEES_UPDATE);
  const canTerminate = can(PERMISSIONS.EMPLOYEES_TERMINATE);
  const canSeeSalary = can(PERMISSIONS.EMPLOYEES_SALARY_VIEW);
  const canExport = can(PERMISSIONS.REPORTS_EXPORT);

  const [includeInactive, setIncludeInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeWithRefs | null>(null);
  const [terminating, setTerminating] = useState<EmployeeWithRefs | null>(null);

  const employees = useEmployees(includeInactive);

  const exportEmployees = () => {
    const rows = employees.data ?? [];
    downloadCsv("Employees", rows, [
      { header: "Number", value: (e) => e.employee_no },
      { header: "First name", value: (e) => e.first_name },
      { header: "Last name", value: (e) => e.last_name },
      { header: "National ID", value: (e) => e.national_id },
      { header: "Department", value: (e) => e.department?.name },
      { header: "Position", value: (e) => e.position?.title },
      { header: "Type", value: (e) => EMPLOYMENT_TYPE_LABELS[e.employment_type] },
      { header: "Hired", value: (e) => e.hire_date },
      ...(canSeeSalary
        ? [
            {
              header: "Basic salary",
              value: (e: EmployeeWithRefs) =>
                e.basic_salary === null ? "" : Number(e.basic_salary).toFixed(2),
            },
          ]
        : []),
      { header: "Status", value: (e) => EMPLOYEE_STATUS_LABELS[e.status] ?? e.status },
    ]);
    toast.success(`${plural(rows.length, "employee")} exported`);
  };

  const columns = useMemo<ColumnDef<EmployeeWithRefs, unknown>[]>(() => {
    const base: ColumnDef<EmployeeWithRefs, unknown>[] = [
      {
        id: "name",
        header: "Employee",
        accessorFn: (row) => `${row.first_name} ${row.last_name}`,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">
              {row.original.first_name} {row.original.last_name}
            </p>
            <p className="num truncate text-xs text-muted-foreground">
              {row.original.employee_no}
              {row.original.phone ? ` · ${row.original.phone}` : ""}
            </p>
          </div>
        ),
      },
      {
        id: "role",
        header: "Role",
        accessorFn: (row) => row.position?.title ?? "",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">{row.original.position?.title ?? "—"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.department?.name ?? "No department"}
            </p>
          </div>
        ),
      },
      {
        id: "type",
        header: "Type",
        accessorFn: (row) => row.employment_type,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-sm">{EMPLOYMENT_TYPE_LABELS[row.original.employment_type]}</p>
            <p className="num text-xs text-muted-foreground">
              since {format(new Date(row.original.hire_date), "MMM yyyy")}
            </p>
          </div>
        ),
      },
    ];

    if (canSeeSalary) {
      base.push({
        id: "salary",
        header: "Basic pay",
        accessorFn: (row) => row.basic_salary ?? 0,
        cell: ({ row }) => (
          <div className="text-right">
            <span className="num font-medium">{money(row.original.basic_salary)}</span>
            <p className="text-[11px] text-muted-foreground">
              {row.original.currency_code} · {row.original.pay_frequency}
            </p>
          </div>
        ),
      });
    }

    base.push({
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            EMPLOYEE_TONE[row.original.status] ?? "bg-muted text-muted-foreground"
          }`}
        >
          {EMPLOYEE_STATUS_LABELS[row.original.status] ?? row.original.status}
        </span>
      ),
    });

    if (canUpdate || canTerminate) {
      base.push({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const employee = row.original;
          const gone = ["terminated", "resigned", "retired"].includes(employee.status);
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Actions for ${employee.first_name} ${employee.last_name}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {canUpdate && (
                    <DropdownMenuItem
                      onSelect={() => {
                        setEditing(employee);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                      Edit details
                    </DropdownMenuItem>
                  )}
                  {canTerminate && !gone && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setTerminating(employee)}>
                        <UserMinus className="size-4" />
                        End employment
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      });
    }

    return base;
  }, [canSeeSalary, canUpdate, canTerminate]);

  return (
    <>
      <DataTable
        columns={columns}
        data={employees.data}
        isLoading={employees.isLoading}
        error={employees.error}
        onRetry={() => void employees.refetch()}
        searchPlaceholder="Search by name, number or department…"
        emptyTitle="No employees yet"
        emptyDescription="Add your staff here. Their pay feeds payroll directly."
        emptyAction={
          canCreate ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add employee
            </Button>
          ) : undefined
        }
        pageSize={25}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={includeInactive ? "all" : "current"}
              onValueChange={(v) => setIncludeInactive(v === "all")}
            >
              <SelectTrigger className="h-9 w-40" aria-label="Filter employees">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current staff</SelectItem>
                <SelectItem value="all">Including past</SelectItem>
              </SelectContent>
            </Select>
            {canExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={exportEmployees}
                disabled={!employees.data?.length}
              >
                <Download className="size-4" />
                Export
              </Button>
            )}
            {canCreate && (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="size-4" />
                Add employee
              </Button>
            )}
          </div>
        }
      />

      <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} employee={editing} />
      <TerminateDialog employee={terminating} onOpenChange={() => setTerminating(null)} />

      {!canSeeSalary && (
        <p className="mt-3 text-xs text-muted-foreground">
          Pay and bank details are hidden. They need the &ldquo;View salaries&rdquo; permission, and
          the database returns them as empty rather than relying on this screen to hide them.
        </p>
      )}
    </>
  );
}

function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeWithRefs | null;
}) {
  const { can } = usePermissions();
  const canSeeSalary = can(PERMISSIONS.EMPLOYEES_SALARY_VIEW);
  const save = useSaveEmployee();
  const { data: departments } = useDepartments();
  const { data: positions } = usePositions();
  const { data: branches } = useBranches();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    other_names: "",
    national_id: "",
    date_of_birth: "",
    gender: "",
    email: "",
    phone: "",
    address: "",
    position_id: "",
    department_id: "",
    branch_id: "",
    employment_type: "permanent" as EmploymentType,
    hire_date: new Date().toISOString().slice(0, 10),
    basic_salary: 0,
    currency_code: "USD",
    pay_frequency: "monthly" as PayFrequency,
    bank_name: "",
    bank_account_number: "",
    tax_number: "",
    nssa_number: "",
    status: "active" as EmployeeStatus,
    notes: "",
  });
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    setForm({
      first_name: employee?.first_name ?? "",
      last_name: employee?.last_name ?? "",
      other_names: employee?.other_names ?? "",
      national_id: employee?.national_id ?? "",
      date_of_birth: employee?.date_of_birth ?? "",
      gender: employee?.gender ?? "",
      email: employee?.email ?? "",
      phone: employee?.phone ?? "",
      address: employee?.address ?? "",
      position_id: employee?.position_id ?? "",
      department_id: employee?.department_id ?? "",
      branch_id: employee?.branch_id ?? "",
      employment_type: employee?.employment_type ?? "permanent",
      hire_date: employee?.hire_date ?? new Date().toISOString().slice(0, 10),
      basic_salary: Number(employee?.basic_salary ?? 0),
      currency_code: employee?.currency_code ?? "USD",
      pay_frequency: employee?.pay_frequency ?? "monthly",
      bank_name: employee?.bank_name ?? "",
      bank_account_number: employee?.bank_account_number ?? "",
      tax_number: employee?.tax_number ?? "",
      nssa_number: employee?.nssa_number ?? "",
      status: employee?.status ?? "active",
      notes: employee?.notes ?? "",
    });
  }, [open, employee]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const onSubmit = async () => {
    setServerError(null);
    if (form.first_name.trim() === "" || form.last_name.trim() === "") {
      return setServerError("A first and last name are both needed.");
    }

    try {
      await save.mutateAsync({
        ...(employee ? { id: employee.id } : {}),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        other_names: form.other_names.trim() || null,
        national_id: form.national_id.trim() || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        position_id: form.position_id || null,
        department_id: form.department_id || null,
        branch_id: form.branch_id || null,
        employment_type: form.employment_type,
        hire_date: form.hire_date,
        basic_salary: form.basic_salary,
        currency_code: form.currency_code,
        pay_frequency: form.pay_frequency,
        bank_name: form.bank_name.trim() || null,
        bank_account_number: form.bank_account_number.trim() || null,
        tax_number: form.tax_number.trim() || null,
        nssa_number: form.nssa_number.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null,
      });
      onOpenChange(false);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "The employee could not be saved.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {employee ? `${employee.first_name} ${employee.last_name}` : "Add employee"}
          </DialogTitle>
          <DialogDescription>
            Pay set here is what payroll uses. Statutory numbers are needed before a return can be
            filed.
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

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="First name" htmlFor="emp_first" required>
              <Input
                id="emp_first"
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
              />
            </Field>
            <Field label="Last name" htmlFor="emp_last" required>
              <Input
                id="emp_last"
                value={form.last_name}
                onChange={(e) => set("last_name", e.target.value)}
              />
            </Field>
            <Field label="Other names" htmlFor="emp_other">
              <Input
                id="emp_other"
                value={form.other_names}
                onChange={(e) => set("other_names", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="National ID" htmlFor="emp_nid">
              <Input
                id="emp_nid"
                className="num"
                value={form.national_id}
                onChange={(e) => set("national_id", e.target.value)}
              />
            </Field>
            <Field label="Date of birth" htmlFor="emp_dob">
              <Input
                id="emp_dob"
                type="date"
                value={form.date_of_birth}
                onChange={(e) => set("date_of_birth", e.target.value)}
              />
            </Field>
            <Field label="Gender" htmlFor="emp_gender">
              <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                <SelectTrigger id="emp_gender">
                  <SelectValue placeholder="Not stated" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="undisclosed">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="emp_phone">
              <Input
                id="emp_phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
            <Field label="Email" htmlFor="emp_email">
              <Input
                id="emp_email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Department" htmlFor="emp_dept">
              <Select value={form.department_id} onValueChange={(v) => set("department_id", v)}>
                <SelectTrigger id="emp_dept">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Position" htmlFor="emp_position">
              <Select value={form.position_id} onValueChange={(v) => set("position_id", v)}>
                <SelectTrigger id="emp_position">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {positions?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Branch" htmlFor="emp_branch">
              <Select value={form.branch_id} onValueChange={(v) => set("branch_id", v)}>
                <SelectTrigger id="emp_branch">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {branches?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Employment type" htmlFor="emp_type" required>
              <Select
                value={form.employment_type}
                onValueChange={(v) => set("employment_type", v as EmploymentType)}
              >
                <SelectTrigger id="emp_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Hired on" htmlFor="emp_hired" required>
              <Input
                id="emp_hired"
                type="date"
                value={form.hire_date}
                onChange={(e) => set("hire_date", e.target.value)}
              />
            </Field>
            <Field label="Status" htmlFor="emp_status" required>
              <Select value={form.status} onValueChange={(v) => set("status", v as EmployeeStatus)}>
                <SelectTrigger id="emp_status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["active", "probation", "suspended"].map((value) => (
                    <SelectItem key={value} value={value}>
                      {EMPLOYEE_STATUS_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {canSeeSalary && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Basic pay" htmlFor="emp_salary" hint="Per pay period.">
                  <Input
                    id="emp_salary"
                    type="number"
                    min="0"
                    step="0.01"
                    className="num text-right"
                    value={form.basic_salary}
                    onChange={(e) => set("basic_salary", Number(e.target.value || 0))}
                  />
                </Field>
                <Field label="Currency" htmlFor="emp_currency">
                  <Select value={form.currency_code} onValueChange={(v) => set("currency_code", v)}>
                    <SelectTrigger id="emp_currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["USD", "ZWG", "ZAR"].map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Paid" htmlFor="emp_frequency">
                  <Select
                    value={form.pay_frequency}
                    onValueChange={(v) => set("pay_frequency", v as PayFrequency)}
                  >
                    <SelectTrigger id="emp_frequency">
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
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Bank" htmlFor="emp_bank">
                  <Input
                    id="emp_bank"
                    value={form.bank_name}
                    onChange={(e) => set("bank_name", e.target.value)}
                  />
                </Field>
                <Field label="Account number" htmlFor="emp_bank_no">
                  <Input
                    id="emp_bank_no"
                    className="num"
                    value={form.bank_account_number}
                    onChange={(e) => set("bank_account_number", e.target.value)}
                  />
                </Field>
              </div>
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tax number" htmlFor="emp_tax" hint="Needed for PAYE returns.">
              <Input
                id="emp_tax"
                className="num"
                value={form.tax_number}
                onChange={(e) => set("tax_number", e.target.value)}
              />
            </Field>
            <Field label="NSSA number" htmlFor="emp_nssa">
              <Input
                id="emp_nssa"
                className="num"
                value={form.nssa_number}
                onChange={(e) => set("nssa_number", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Notes" htmlFor="emp_notes">
            <Textarea
              id="emp_notes"
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {employee ? "Save changes" : "Add employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TerminateDialog({
  employee,
  onOpenChange,
}: {
  employee: EmployeeWithRefs | null;
  onOpenChange: (open: boolean) => void;
}) {
  const terminate = useTerminateEmployee();
  const [status, setStatus] = useState<EmployeeStatus>("resigned");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!employee) return;
    setStatus("resigned");
    setDate(new Date().toISOString().slice(0, 10));
    setReason("");
  }, [employee]);

  return (
    <Dialog open={Boolean(employee)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            End employment — {employee?.first_name} {employee?.last_name}
          </DialogTitle>
          <DialogDescription>
            They stop appearing in payroll runs from this date. The record and its history stay.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Reason" htmlFor="term_status" required>
              <Select value={status} onValueChange={(v) => setStatus(v as EmployeeStatus)}>
                <SelectTrigger id="term_status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resigned">Resigned</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Last day" htmlFor="term_date" required>
              <Input
                id="term_date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Notes" htmlFor="term_reason">
            <Textarea
              id="term_reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (employee) {
                terminate.mutate({ id: employee.id, status, date, reason: reason.trim() });
              }
              onOpenChange(false);
            }}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Leave
// ---------------------------------------------------------------------

function LeaveTab() {
  const { can } = usePermissions();
  const canApprove = can(PERMISSIONS.LEAVE_APPROVE);
  const canRequest = can(PERMISSIONS.LEAVE_REQUEST);

  const [status, setStatus] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const requests = useLeaveRequests(status === "all" ? null : (status as LeaveStatus));
  const setLeaveStatus = useSetLeaveStatus();

  return (
    <>
      <SectionCard
        title="Leave requests"
        description="Approved leave that overlaps existing leave is refused by the database."
        bodyClassName="p-0"
        actions={
          <div className="flex gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 w-36" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {Object.entries(LEAVE_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canRequest && (
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="size-3.5" />
                Request
              </Button>
            )}
          </div>
        }
      >
        {requests.isLoading ? (
          <div className="p-4">
            <TableSkeleton columns={4} rows={5} />
          </div>
        ) : requests.isError ? (
          <ErrorState error={requests.error} onRetry={() => void requests.refetch()} />
        ) : (requests.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-5" />}
            title="No leave requests"
            description="Requests appear here for approval."
          />
        ) : (
          <ul className="divide-y divide-border">
            {requests.data?.map((request) => (
              <LeaveRow
                key={request.id}
                request={request}
                canApprove={canApprove}
                onSetStatus={(next) => setLeaveStatus.mutate({ id: request.id, status: next })}
              />
            ))}
          </ul>
        )}
      </SectionCard>

      <LeaveFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </>
  );
}

function LeaveRow({
  request,
  canApprove,
  onSetStatus,
}: {
  request: LeaveRequestWithRefs;
  canApprove: boolean;
  onSetStatus: (status: LeaveStatus) => void;
}) {
  const pending = ["submitted", "draft"].includes(request.status);

  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {request.employee?.first_name} {request.employee?.last_name}
        </p>
        <p className="num truncate text-[11px] text-muted-foreground">
          {request.request_no} · {format(new Date(request.start_date), "dd MMM")} –{" "}
          {format(new Date(request.end_date), "dd MMM yyyy")}
        </p>
      </div>

      <div className="text-right">
        <p className="text-xs">{request.leave_type?.name}</p>
        <p className="num text-[11px] text-muted-foreground">
          {request.days} {request.days === 1 ? "day" : "days"}
          {request.leave_type?.is_paid === false && " · unpaid"}
        </p>
      </div>

      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          LEAVE_TONE[request.status] ?? "bg-muted text-muted-foreground"
        }`}
      >
        {LEAVE_STATUS_LABELS[request.status] ?? request.status}
      </span>

      {canApprove && pending && (
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => onSetStatus("approved")}
          >
            <CheckCircle2 className="size-3.5" />
            Approve
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Reject ${request.request_no}`}
            onClick={() => onSetStatus("rejected")}
          >
            <XCircle className="size-4" />
          </Button>
        </div>
      )}
    </li>
  );
}

function LeaveFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateLeaveRequest();
  const { data: employees } = useEmployees(false);
  const { data: leaveTypes } = useLeaveTypes();

  const [employeeId, setEmployeeId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmployeeId("");
    setTypeId("");
    setStart(new Date().toISOString().slice(0, 10));
    setEnd(new Date().toISOString().slice(0, 10));
    setReason("");
    setServerError(null);
  }, [open]);

  // Weekends are not leave days, so the count follows working days.
  const days = workingDaysBetween(start, end);

  const onSubmit = async () => {
    setServerError(null);
    if (!employeeId) return setServerError("Choose who the leave is for.");
    if (!typeId) return setServerError("Choose a leave type.");
    if (days <= 0) return setServerError("The end date must be on or after the start date.");

    try {
      await create.mutateAsync({
        employee_id: employeeId,
        leave_type_id: typeId,
        start_date: start,
        end_date: end,
        days,
        reason: reason.trim() || null,
      });
      onOpenChange(false);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "The request could not be saved.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request leave</DialogTitle>
          <DialogDescription>
            Days are counted excluding weekends. Overlapping approved leave is refused.
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

          <Field label="Employee" htmlFor="leave_employee" required>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger id="leave_employee">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {employees?.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.employee_no} — {e.first_name} {e.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Leave type" htmlFor="leave_type" required>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger id="leave_type">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.is_paid ? "" : " (unpaid)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From" htmlFor="leave_start" required>
              <Input
                id="leave_start"
                type="date"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  if (end < e.target.value) setEnd(e.target.value);
                }}
              />
            </Field>
            <Field label="To" htmlFor="leave_end" required>
              <Input
                id="leave_end"
                type="date"
                min={start}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
          </div>

          <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <span className="num font-semibold text-foreground">{days}</span> working{" "}
            {days === 1 ? "day" : "days"}, weekends excluded.
          </p>

          <Field label="Reason" htmlFor="leave_reason">
            <Textarea
              id="leave_reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={create.isPending}>
            {create.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------

function AttendanceTab() {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.ATTENDANCE_MANAGE);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [marks, setMarks] = useState<Record<string, string>>({});

  const employees = useEmployees(false);
  const attendance = useAttendance(date);
  const save = useSaveAttendance();

  // Start from what is already recorded for the day.
  useEffect(() => {
    const existing: Record<string, string> = {};
    for (const row of attendance.data ?? []) existing[row.employee_id] = row.status;
    setMarks(existing);
  }, [attendance.data]);

  const onSave = () => {
    const rows = Object.entries(marks).map(([employee_id, status]) => ({
      employee_id,
      attendance_date: date,
      status: status as AttendanceStatus,
      hours_worked: null,
      overtime_hours: 0,
    }));
    save.mutate(rows);
  };

  const marked = Object.keys(marks).length;

  return (
    <SectionCard
      title="Daily attendance"
      description="One record per person per day; saving again updates the day rather than duplicating it."
      bodyClassName="p-0"
      actions={
        <div className="flex flex-wrap gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 w-36"
            aria-label="Attendance date"
          />
          {canManage && (
            <Button size="sm" onClick={onSave} disabled={marked === 0 || save.isPending}>
              {save.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              Save {marked > 0 ? marked : ""}
            </Button>
          )}
        </div>
      }
    >
      {employees.isLoading ? (
        <div className="p-4">
          <TableSkeleton columns={2} rows={6} />
        </div>
      ) : (employees.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title="No employees to mark"
          description="Add staff on the Employees tab first."
        />
      ) : (
        <ul className="divide-y divide-border">
          {employees.data?.map((employee) => (
            <li key={employee.id} className="flex items-center gap-3 px-5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {employee.first_name} {employee.last_name}
                </p>
                <p className="num text-[11px] text-muted-foreground">{employee.employee_no}</p>
              </div>
              <Select
                value={marks[employee.id] ?? ""}
                onValueChange={(v) => setMarks((c) => ({ ...c, [employee.id]: v }))}
                disabled={!canManage}
              >
                <SelectTrigger
                  className="h-8 w-36"
                  aria-label={`Attendance for ${employee.first_name} ${employee.last_name}`}
                >
                  <SelectValue placeholder="Not marked" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------

function StructureTab() {
  const departments = useDepartments();
  const positions = usePositions();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard
        title="Departments"
        description={`${plural(departments.data?.length ?? 0, "department")}`}
        bodyClassName="p-0"
      >
        {departments.isLoading ? (
          <div className="p-4">
            <TableSkeleton columns={2} rows={4} />
          </div>
        ) : (departments.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="No departments"
            description="Departments group staff for reporting and payroll runs."
          />
        ) : (
          <ul className="divide-y divide-border">
            {departments.data?.map((department) => (
              <li key={department.id} className="flex items-center justify-between px-5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{department.name}</p>
                  <p className="num text-[11px] text-muted-foreground">{department.code}</p>
                </div>
                {department.status !== "active" && (
                  <Badge variant="secondary" className="text-[10px]">
                    Inactive
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Positions"
        description={`${plural(positions.data?.length ?? 0, "position")}`}
        bodyClassName="p-0"
      >
        {positions.isLoading ? (
          <div className="p-4">
            <TableSkeleton columns={2} rows={4} />
          </div>
        ) : (positions.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="No positions"
            description="Job titles staff are assigned to."
          />
        ) : (
          <ul className="divide-y divide-border">
            {positions.data?.map((position) => (
              <li key={position.id} className="flex items-center justify-between px-5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{position.title}</p>
                  <p className="num text-[11px] text-muted-foreground">
                    {position.code}
                    {position.grade ? ` · grade ${position.grade}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
