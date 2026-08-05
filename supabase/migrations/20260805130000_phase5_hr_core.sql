-- =====================================================================
-- Builders Paradise ERP — HR core
--
-- Departments, positions, employees, leave and attendance. No payroll
-- here; that follows in its own migration and depends on this one.
--
-- Re-runnable. Requires Phase 1 core and RBAC.
-- =====================================================================

insert into public.document_sequences (doc_type, prefix) values
  ('employee',      'EMP'),
  ('leave_request', 'LVE')
on conflict (doc_type) do nothing;

-- ---------------------------------------------------------------------
-- Departments and positions
-- ---------------------------------------------------------------------

create table if not exists public.departments (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  name        text not null,
  description text,
  branch_id   uuid references public.branches (id) on delete set null,
  -- Set after employees exist; a department can be created before its head.
  manager_id  uuid,
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid,
  constraint dept_code_key unique (code),
  constraint dept_status_check check (status in ('active', 'inactive'))
);

create table if not exists public.positions (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  title         text not null,
  department_id uuid references public.departments (id) on delete set null,
  grade         text,
  description   text,
  status        text not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid,
  constraint position_code_key unique (code),
  constraint position_status_check check (status in ('active', 'inactive'))
);

-- ---------------------------------------------------------------------
-- Employees
--
-- An employee is a person on the payroll. It is deliberately separate
-- from profiles: most staff never log in, and some system users are not
-- employees. profile_id links the two when both exist.
-- ---------------------------------------------------------------------

create table if not exists public.employees (
  id              uuid primary key default gen_random_uuid(),
  employee_no     text not null,
  profile_id      uuid references public.profiles (id) on delete set null,

  first_name      text not null,
  last_name       text not null,
  other_names     text,
  national_id     text,
  date_of_birth   date,
  gender          text,

  email           text,
  phone           text,
  address         text,
  emergency_contact_name  text,
  emergency_contact_phone text,

  position_id     uuid references public.positions (id) on delete set null,
  department_id   uuid references public.departments (id) on delete set null,
  branch_id       uuid references public.branches (id) on delete set null,
  manager_id      uuid references public.employees (id) on delete set null,

  employment_type text not null default 'permanent',
  hire_date       date not null default current_date,
  probation_end   date,
  contract_end    date,

  -- Pay. basic_salary is per pay period, in the employee's currency.
  basic_salary    numeric(18, 4) not null default 0,
  currency_code   char(3) not null default 'USD',
  pay_frequency   text not null default 'monthly',

  bank_name       text,
  bank_account_number text,
  bank_branch     text,

  -- Statutory identifiers. Payroll cannot file a return without these.
  tax_number      text,
  nssa_number     text,

  status          text not null default 'active',
  termination_date   date,
  termination_reason text,

  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid,
  updated_by      uuid,

  constraint employee_no_key unique (employee_no),
  constraint employee_national_id_key unique (national_id),
  constraint employee_salary_check check (basic_salary >= 0),
  constraint employee_gender_check check (
    gender is null or gender in ('female', 'male', 'other', 'undisclosed')
  ),
  constraint employee_type_check check (
    employment_type in ('permanent', 'contract', 'casual', 'intern', 'part_time')
  ),
  constraint employee_frequency_check check (
    pay_frequency in ('monthly', 'fortnightly', 'weekly', 'daily')
  ),
  constraint employee_status_check check (
    status in ('active', 'probation', 'suspended', 'terminated', 'resigned', 'retired')
  ),
  -- Someone who has left needs a leaving date, or reports of headcount
  -- and of payroll cost quietly disagree.
  constraint employee_termination_check check (
    status not in ('terminated', 'resigned', 'retired') or termination_date is not null
  )
);

create index if not exists employee_status_idx on public.employees (status);
create index if not exists employee_department_idx on public.employees (department_id);
create index if not exists employee_branch_idx on public.employees (branch_id);
create index if not exists employee_name_idx on public.employees (last_name, first_name);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dept_manager_fk') then
    alter table public.departments
      add constraint dept_manager_fk
      foreign key (manager_id) references public.employees (id) on delete set null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Leave
-- ---------------------------------------------------------------------

create table if not exists public.leave_types (
  id             uuid primary key default gen_random_uuid(),
  code           text not null,
  name           text not null,
  days_per_year  numeric(6, 2) not null default 0,
  is_paid        boolean not null default true,
  carry_forward  boolean not null default false,
  max_carry_days numeric(6, 2) not null default 0,
  requires_document boolean not null default false,
  status         text not null default 'active',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid,
  updated_by     uuid,
  constraint leave_type_code_key unique (code),
  constraint leave_type_status_check check (status in ('active', 'inactive'))
);

create table if not exists public.leave_requests (
  id            uuid primary key default gen_random_uuid(),
  request_no    text not null,
  employee_id   uuid not null references public.employees (id) on delete restrict,
  leave_type_id uuid not null references public.leave_types (id) on delete restrict,

  start_date    date not null,
  end_date      date not null,
  days          numeric(6, 2) not null,
  reason        text,
  document_url  text,

  status        text not null default 'submitted',
  approved_by   uuid references public.profiles (id) on delete set null,
  approved_at   timestamptz,
  rejected_reason text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid,

  constraint leave_request_no_key unique (request_no),
  constraint leave_dates_check check (end_date >= start_date),
  constraint leave_days_check check (days > 0),
  constraint leave_status_check check (
    status in ('draft', 'submitted', 'approved', 'rejected', 'cancelled', 'taken')
  )
);

create index if not exists leave_employee_idx on public.leave_requests (employee_id, start_date desc);
create index if not exists leave_status_idx on public.leave_requests (status);

/**
 * Days already approved or taken against a leave type this year.
 * Used to show what is left of an entitlement.
 */
create or replace function public.leave_days_taken(
  p_employee_id   uuid,
  p_leave_type_id uuid,
  p_year          integer default extract(year from current_date)::integer
)
returns numeric
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(sum(days), 0)
  from public.leave_requests
  where employee_id = p_employee_id
    and leave_type_id = p_leave_type_id
    and status in ('approved', 'taken')
    and extract(year from start_date)::integer = p_year;
$$;

grant execute on function public.leave_days_taken(uuid, uuid, integer) to authenticated;

-- Overlapping approved leave for one person is a data error, not a
-- workflow choice — it would double-count against the entitlement.
create or replace function public.fn_guard_overlapping_leave()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_clash text;
begin
  if new.status not in ('approved', 'taken') then
    return new;
  end if;

  select request_no into v_clash
  from public.leave_requests
  where employee_id = new.employee_id
    and id <> new.id
    and status in ('approved', 'taken')
    and daterange(start_date, end_date, '[]') && daterange(new.start_date, new.end_date, '[]')
  limit 1;

  if v_clash is not null then
    raise exception 'This overlaps approved leave already recorded on %', v_clash;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_leave_overlap on public.leave_requests;
create trigger trg_leave_overlap
  before insert or update on public.leave_requests
  for each row execute function public.fn_guard_overlapping_leave();

-- ---------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------

create table if not exists public.attendance (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees (id) on delete cascade,
  attendance_date date not null default current_date,
  status         text not null default 'present',
  time_in        time,
  time_out       time,
  hours_worked   numeric(6, 2),
  overtime_hours numeric(6, 2) not null default 0,
  notes          text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid,
  updated_by     uuid,

  constraint attendance_unique unique (employee_id, attendance_date),
  constraint attendance_status_check check (
    status in ('present', 'absent', 'late', 'half_day', 'leave', 'holiday', 'sick')
  ),
  constraint attendance_hours_check check (
    hours_worked is null or (hours_worked >= 0 and hours_worked <= 24)
  ),
  constraint attendance_overtime_check check (overtime_hours >= 0)
);

create index if not exists attendance_date_idx on public.attendance (attendance_date desc);
create index if not exists attendance_employee_idx on public.attendance (employee_id, attendance_date desc);

-- ---------------------------------------------------------------------
-- Row stamps and audit
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'departments', 'positions', 'employees', 'leave_types', 'leave_requests', 'attendance'
  ]
  loop
    execute format('drop trigger if exists trg_%1$s_stamp on public.%1$I', t);
    execute format(
      'create trigger trg_%1$s_stamp before insert or update on public.%1$I
         for each row execute function public.set_row_audit_fields()', t);

    execute format('drop trigger if exists trg_%1$s_audit on public.%1$I', t);
    execute format(
      'create trigger trg_%1$s_audit after insert or update or delete on public.%1$I
         for each row execute function public.fn_audit(''hr'')', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
--
-- Salary is the sensitive column here. Postgres RLS cannot hide a single
-- column, so the employees table is readable by anyone with hr.view and
-- the salary is masked by a view instead — see employees_secure below.
-- ---------------------------------------------------------------------

alter table public.departments    enable row level security;
alter table public.positions      enable row level security;
alter table public.employees      enable row level security;
alter table public.leave_types    enable row level security;
alter table public.leave_requests enable row level security;
alter table public.attendance     enable row level security;

drop policy if exists departments_select on public.departments;
create policy departments_select on public.departments
  for select to authenticated using (public.has_permission('hr.view'));

drop policy if exists departments_write on public.departments;
create policy departments_write on public.departments
  for all to authenticated
  using (public.has_permission('departments.manage'))
  with check (public.has_permission('departments.manage'));

drop policy if exists positions_select on public.positions;
create policy positions_select on public.positions
  for select to authenticated using (public.has_permission('hr.view'));

drop policy if exists positions_write on public.positions;
create policy positions_write on public.positions
  for all to authenticated
  using (public.has_permission('positions.manage'))
  with check (public.has_permission('positions.manage'));

-- An employee may always see their own record.
drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees
  for select to authenticated
  using (public.has_permission('employees.view') or profile_id = auth.uid());

drop policy if exists employees_insert on public.employees;
create policy employees_insert on public.employees
  for insert to authenticated with check (public.has_permission('employees.create'));

drop policy if exists employees_update on public.employees;
create policy employees_update on public.employees
  for update to authenticated
  using (public.has_any_permission(array['employees.update', 'employees.terminate']))
  with check (public.has_any_permission(array['employees.update', 'employees.terminate']));

drop policy if exists leave_types_select on public.leave_types;
create policy leave_types_select on public.leave_types
  for select to authenticated using (public.has_permission('leave.view'));

drop policy if exists leave_types_write on public.leave_types;
create policy leave_types_write on public.leave_types
  for all to authenticated
  using (public.has_permission('hr.documents.manage'))
  with check (public.has_permission('hr.documents.manage'));

-- Staff see and raise their own leave; approvers see everyone's.
drop policy if exists leave_requests_select on public.leave_requests;
create policy leave_requests_select on public.leave_requests
  for select to authenticated
  using (
    public.has_permission('leave.view')
    or employee_id in (select id from public.employees where profile_id = auth.uid())
  );

drop policy if exists leave_requests_insert on public.leave_requests;
create policy leave_requests_insert on public.leave_requests
  for insert to authenticated
  with check (
    public.has_permission('leave.request')
    and (
      public.has_permission('leave.approve')
      or employee_id in (select id from public.employees where profile_id = auth.uid())
    )
  );

drop policy if exists leave_requests_update on public.leave_requests;
create policy leave_requests_update on public.leave_requests
  for update to authenticated
  using (
    public.has_permission('leave.approve')
    or (
      employee_id in (select id from public.employees where profile_id = auth.uid())
      and status in ('draft', 'submitted')
    )
  )
  with check (
    public.has_permission('leave.approve')
    or (
      employee_id in (select id from public.employees where profile_id = auth.uid())
      and status in ('draft', 'submitted', 'cancelled')
    )
  );

drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance
  for select to authenticated
  using (
    public.has_permission('attendance.view')
    or employee_id in (select id from public.employees where profile_id = auth.uid())
  );

drop policy if exists attendance_write on public.attendance;
create policy attendance_write on public.attendance
  for all to authenticated
  using (public.has_permission('attendance.manage'))
  with check (public.has_permission('attendance.manage'));

-- ---------------------------------------------------------------------
-- Salary masking
--
-- Returns every employee, but nulls the pay columns unless the caller
-- holds employees.salary.view or the row is their own. The client reads
-- this view rather than the table wherever a list is shown.
-- ---------------------------------------------------------------------

create or replace view public.employees_secure
with (security_invoker = true)
as
select
  e.id, e.employee_no, e.profile_id,
  e.first_name, e.last_name, e.other_names,
  e.national_id, e.date_of_birth, e.gender,
  e.email, e.phone, e.address,
  e.emergency_contact_name, e.emergency_contact_phone,
  e.position_id, e.department_id, e.branch_id, e.manager_id,
  e.employment_type, e.hire_date, e.probation_end, e.contract_end,
  case when public.has_permission('employees.salary.view') or e.profile_id = auth.uid()
       then e.basic_salary end as basic_salary,
  e.currency_code, e.pay_frequency,
  case when public.has_permission('employees.salary.view') or e.profile_id = auth.uid()
       then e.bank_name end as bank_name,
  case when public.has_permission('employees.salary.view') or e.profile_id = auth.uid()
       then e.bank_account_number end as bank_account_number,
  case when public.has_permission('employees.salary.view') or e.profile_id = auth.uid()
       then e.bank_branch end as bank_branch,
  e.tax_number, e.nssa_number,
  e.status, e.termination_date, e.termination_reason,
  e.notes, e.created_at, e.updated_at
from public.employees e;

grant select on public.employees_secure to authenticated;

-- ---------------------------------------------------------------------
-- Starter leave types
-- ---------------------------------------------------------------------

insert into public.leave_types (code, name, days_per_year, is_paid, carry_forward, max_carry_days, requires_document) values
  ('ANNUAL',    'Annual leave',      22, true,  true,  10, false),
  ('SICK',      'Sick leave',        10, true,  false,  0, true),
  ('COMPAS',    'Compassionate',      5, true,  false,  0, false),
  ('MATERNITY', 'Maternity leave',   98, true,  false,  0, true),
  ('PATERNITY', 'Paternity leave',   14, true,  false,  0, false),
  ('UNPAID',    'Unpaid leave',       0, false, false,  0, false),
  ('STUDY',     'Study leave',        5, true,  false,  0, true)
on conflict (code) do nothing;
