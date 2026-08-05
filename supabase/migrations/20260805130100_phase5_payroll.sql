-- =====================================================================
-- Builders Paradise ERP — Payroll
--
-- Pay periods, runs, payslips and the posting that turns them into a
-- payroll journal.
--
-- TAX RATES ARE NOT HARDCODED. PAYE is computed from payroll_tax_bands,
-- which ships EMPTY on purpose. calculate_payroll_run() refuses to run
-- until bands exist for the period's currency. A payroll that silently
-- computes nil tax understates the statutory liability and lands the
-- business in trouble with ZIMRA — refusing is the safer failure.
--
-- Re-runnable. Requires HR core and the accounting core.
-- =====================================================================

insert into public.document_sequences (doc_type, prefix) values
  ('payroll_run', 'PAY'),
  ('payslip',     'PSL')
on conflict (doc_type) do nothing;

-- ---------------------------------------------------------------------
-- Pay components
--
-- Anything on a payslip that is not basic salary: allowances, overtime,
-- union dues, loan repayments, statutory deductions.
-- ---------------------------------------------------------------------

create table if not exists public.payroll_components (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  name          text not null,
  component_type text not null,

  -- How the amount is arrived at. 'fixed' uses the assigned amount;
  -- the percentage forms use rate against basic or gross.
  calculation   text not null default 'fixed',
  default_amount numeric(18, 4) not null default 0,
  default_rate   numeric(9, 6) not null default 0,

  -- Whether it enters the PAYE calculation.
  is_taxable    boolean not null default true,
  -- Statutory components are created by the calculation, not assigned.
  is_statutory  boolean not null default false,
  -- An employer cost that is not deducted from the employee.
  is_employer_contribution boolean not null default false,
  -- Cap on the contributory amount, where one applies. Nil means none.
  ceiling_amount numeric(18, 4),

  account_id    uuid references public.chart_of_accounts (id) on delete restrict,
  sort_order    integer not null default 100,
  status        text not null default 'active',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid,

  constraint component_code_key unique (code),
  constraint component_type_check check (component_type in ('earning', 'deduction')),
  constraint component_calc_check check (
    calculation in ('fixed', 'percent_of_basic', 'percent_of_gross')
  ),
  constraint component_status_check check (status in ('active', 'inactive'))
);

create table if not exists public.employee_components (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete cascade,
  component_id uuid not null references public.payroll_components (id) on delete restrict,
  amount       numeric(18, 4),
  rate         numeric(9, 6),
  effective_from date not null default current_date,
  effective_to   date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid,
  updated_by   uuid,
  constraint employee_component_unique unique (employee_id, component_id, effective_from),
  constraint employee_component_dates check (effective_to is null or effective_to >= effective_from)
);

create index if not exists emp_component_employee_idx on public.employee_components (employee_id);

-- ---------------------------------------------------------------------
-- PAYE bands
--
-- Cumulative marginal bands. For gross taxable pay G falling in a band,
-- tax = (G - lower_limit) * rate + cumulative_tax.
--
-- Seeded empty. Configure per currency before running payroll.
-- ---------------------------------------------------------------------

create table if not exists public.payroll_tax_bands (
  id             uuid primary key default gen_random_uuid(),
  currency_code  char(3) not null default 'USD',
  pay_frequency  text not null default 'monthly',
  effective_from date not null,
  lower_limit    numeric(18, 4) not null,
  upper_limit    numeric(18, 4),
  rate           numeric(9, 6) not null,
  cumulative_tax numeric(18, 4) not null default 0,
  description    text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid,
  updated_by     uuid,

  constraint tax_band_unique unique (currency_code, pay_frequency, effective_from, lower_limit),
  constraint tax_band_rate_check check (rate >= 0 and rate <= 1),
  constraint tax_band_limits_check check (upper_limit is null or upper_limit > lower_limit)
);

/**
 * PAYE on a taxable amount, from the bands in force on a date.
 * Raises rather than returning nil when no bands are configured.
 */
create or replace function public.calculate_paye(
  p_taxable       numeric,
  p_currency      char(3) default 'USD',
  p_frequency     text default 'monthly',
  p_as_at         date default current_date
)
returns numeric
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_effective date;
  v_band      public.payroll_tax_bands%rowtype;
begin
  if p_taxable is null or p_taxable <= 0 then
    return 0;
  end if;

  select max(effective_from) into v_effective
  from public.payroll_tax_bands
  where currency_code = p_currency
    and pay_frequency = p_frequency
    and effective_from <= p_as_at;

  if v_effective is null then
    raise exception
      'No PAYE bands are configured for % % pay on or before %. Set them up in Payroll settings before running payroll.',
      p_currency, p_frequency, p_as_at;
  end if;

  select * into v_band
  from public.payroll_tax_bands
  where currency_code = p_currency
    and pay_frequency = p_frequency
    and effective_from = v_effective
    and lower_limit <= p_taxable
    and (upper_limit is null or upper_limit >= p_taxable)
  order by lower_limit desc
  limit 1;

  if not found then
    -- Below the lowest band is untaxed.
    return 0;
  end if;

  return round(
    greatest(0, (p_taxable - v_band.lower_limit) * v_band.rate + v_band.cumulative_tax), 2
  );
end;
$$;

grant execute on function public.calculate_paye(numeric, char, text, date) to authenticated;

-- ---------------------------------------------------------------------
-- Periods, runs and payslips
-- ---------------------------------------------------------------------

create table if not exists public.payroll_periods (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  fiscal_year  integer not null,
  period_no    integer not null,
  start_date   date not null,
  end_date     date not null,
  pay_date     date not null,
  pay_frequency text not null default 'monthly',
  status       text not null default 'open',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid,
  updated_by   uuid,
  constraint payroll_period_unique unique (fiscal_year, period_no, pay_frequency),
  constraint payroll_period_dates check (end_date >= start_date),
  constraint payroll_period_status check (status in ('open', 'closed'))
);

create table if not exists public.payroll_runs (
  id            uuid primary key default gen_random_uuid(),
  run_no        text not null,
  period_id     uuid not null references public.payroll_periods (id) on delete restrict,
  branch_id     uuid references public.branches (id) on delete set null,
  description   text,

  status        text not null default 'draft',
  employee_count integer not null default 0,
  total_gross   numeric(18, 4) not null default 0,
  total_paye    numeric(18, 4) not null default 0,
  total_statutory numeric(18, 4) not null default 0,
  total_deductions numeric(18, 4) not null default 0,
  total_net     numeric(18, 4) not null default 0,
  total_employer_cost numeric(18, 4) not null default 0,

  calculated_at timestamptz,
  approved_by   uuid references public.profiles (id) on delete set null,
  approved_at   timestamptz,
  posted_at     timestamptz,
  posted_by     uuid references public.profiles (id) on delete set null,
  paid_at       timestamptz,
  journal_entry_id uuid references public.journal_entries (id) on delete restrict,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid,

  constraint payroll_run_no_key unique (run_no),
  constraint payroll_run_status_check check (
    status in ('draft', 'calculated', 'approved', 'posted', 'paid', 'cancelled')
  )
);

create index if not exists payroll_run_period_idx on public.payroll_runs (period_id);
create index if not exists payroll_run_status_idx on public.payroll_runs (status);

create table if not exists public.payslips (
  id            uuid primary key default gen_random_uuid(),
  payslip_no    text not null,
  run_id        uuid not null references public.payroll_runs (id) on delete cascade,
  employee_id   uuid not null references public.employees (id) on delete restrict,

  basic_salary  numeric(18, 4) not null default 0,
  total_earnings numeric(18, 4) not null default 0,
  taxable_income numeric(18, 4) not null default 0,
  gross_pay     numeric(18, 4) not null default 0,

  paye          numeric(18, 4) not null default 0,
  statutory_deductions numeric(18, 4) not null default 0,
  other_deductions numeric(18, 4) not null default 0,
  total_deductions numeric(18, 4) not null default 0,
  net_pay       numeric(18, 4) not null default 0,
  employer_contributions numeric(18, 4) not null default 0,

  days_worked   numeric(6, 2),
  days_absent   numeric(6, 2) not null default 0,
  currency_code char(3) not null default 'USD',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid,

  constraint payslip_no_key unique (payslip_no),
  constraint payslip_run_employee_unique unique (run_id, employee_id),
  -- Net pay below nil means deductions exceeded earnings; that is a
  -- calculation error, not something to hand an employee.
  constraint payslip_net_check check (net_pay >= 0)
);

create index if not exists payslip_run_idx on public.payslips (run_id);
create index if not exists payslip_employee_idx on public.payslips (employee_id);

create table if not exists public.payslip_lines (
  id           uuid primary key default gen_random_uuid(),
  payslip_id   uuid not null references public.payslips (id) on delete cascade,
  component_id uuid references public.payroll_components (id) on delete set null,
  line_no      integer not null default 1,
  line_type    text not null,
  description  text not null,
  amount       numeric(18, 4) not null,
  is_employer_contribution boolean not null default false,
  created_at   timestamptz not null default now(),
  constraint payslip_line_type_check check (line_type in ('earning', 'deduction'))
);

create index if not exists payslip_line_payslip_idx on public.payslip_lines (payslip_id);

-- A posted run is in the ledger and cannot be recalculated.
create or replace function public.fn_guard_posted_payroll()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('posted', 'paid') then
      raise exception 'Payroll run % is posted and cannot be deleted', old.run_no;
    end if;
    return old;
  end if;
  if old.status in ('posted', 'paid')
     and new.status not in ('posted', 'paid')
  then
    raise exception
      'Payroll run % is posted. Reverse its journal rather than reopening it.', old.run_no;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payroll_posted_guard on public.payroll_runs;
create trigger trg_payroll_posted_guard
  before update or delete on public.payroll_runs
  for each row execute function public.fn_guard_posted_payroll();

-- ---------------------------------------------------------------------
-- Calculation
-- ---------------------------------------------------------------------

/**
 * Builds payslips for every active employee in a run.
 *
 * Recalculating wipes the previous payslips: a run is a snapshot, and
 * leaving stale slips behind would double the totals.
 */
create or replace function public.calculate_payroll_run(p_run_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run      public.payroll_runs%rowtype;
  v_period   public.payroll_periods%rowtype;
  v_emp      record;
  v_comp     record;
  v_payslip_id uuid;
  v_line_no  integer;
  v_amount   numeric(18, 4);
  v_earnings numeric(18, 4);
  v_taxable  numeric(18, 4);
  v_gross    numeric(18, 4);
  v_paye     numeric(18, 4);
  v_statutory numeric(18, 4);
  v_other    numeric(18, 4);
  v_employer numeric(18, 4);
  v_count    integer := 0;
begin
  select * into v_run from public.payroll_runs where id = p_run_id for update;
  if not found then
    raise exception 'Payroll run % does not exist', p_run_id;
  end if;
  if v_run.status in ('posted', 'paid') then
    raise exception 'Payroll run % is posted and cannot be recalculated', v_run.run_no;
  end if;

  if auth.uid() is not null and not public.has_permission('payroll.runs.calculate') then
    raise exception 'Calculating payroll needs the "Calculate payroll" permission';
  end if;

  select * into v_period from public.payroll_periods where id = v_run.period_id;

  -- A run is a snapshot; stale slips would double the totals.
  delete from public.payslips where run_id = p_run_id;

  for v_emp in
    select * from public.employees
    where status in ('active', 'probation')
      and (v_run.branch_id is null or branch_id = v_run.branch_id)
      and hire_date <= v_period.end_date
      and (termination_date is null or termination_date >= v_period.start_date)
    order by employee_no
  loop
    v_earnings := 0;
    v_taxable  := v_emp.basic_salary;
    v_statutory := 0;
    v_other    := 0;
    v_employer := 0;
    v_line_no  := 1;

    insert into public.payslips (
      payslip_no, run_id, employee_id, basic_salary, currency_code
    ) values (
      public.next_document_number('payslip'), p_run_id, v_emp.id,
      v_emp.basic_salary, v_emp.currency_code
    ) returning id into v_payslip_id;

    insert into public.payslip_lines (payslip_id, line_no, line_type, description, amount)
    values (v_payslip_id, v_line_no, 'earning', 'Basic salary', v_emp.basic_salary);
    v_line_no := v_line_no + 1;

    -- Assigned components, in force for this period.
    for v_comp in
      select c.*, ec.amount as assigned_amount, ec.rate as assigned_rate
      from public.employee_components ec
      join public.payroll_components c on c.id = ec.component_id
      where ec.employee_id = v_emp.id
        and c.status = 'active'
        and ec.effective_from <= v_period.end_date
        and (ec.effective_to is null or ec.effective_to >= v_period.start_date)
      order by c.sort_order, c.code
    loop
      v_amount := case v_comp.calculation
        when 'percent_of_basic' then
          v_emp.basic_salary * coalesce(v_comp.assigned_rate, v_comp.default_rate)
        when 'percent_of_gross' then
          (v_emp.basic_salary + v_earnings) * coalesce(v_comp.assigned_rate, v_comp.default_rate)
        else coalesce(v_comp.assigned_amount, v_comp.default_amount)
      end;

      if v_comp.ceiling_amount is not null then
        v_amount := least(v_amount, v_comp.ceiling_amount);
      end if;

      v_amount := round(coalesce(v_amount, 0), 2);
      if v_amount = 0 then
        continue;
      end if;

      if v_comp.is_employer_contribution then
        v_employer := v_employer + v_amount;
        insert into public.payslip_lines (
          payslip_id, component_id, line_no, line_type, description, amount,
          is_employer_contribution
        ) values (
          v_payslip_id, v_comp.id, v_line_no, v_comp.component_type, v_comp.name, v_amount, true
        );
      elsif v_comp.component_type = 'earning' then
        v_earnings := v_earnings + v_amount;
        if v_comp.is_taxable then
          v_taxable := v_taxable + v_amount;
        end if;
        insert into public.payslip_lines (
          payslip_id, component_id, line_no, line_type, description, amount
        ) values (v_payslip_id, v_comp.id, v_line_no, 'earning', v_comp.name, v_amount);
      else
        if v_comp.is_statutory then
          v_statutory := v_statutory + v_amount;
        else
          v_other := v_other + v_amount;
        end if;
        -- Statutory employee contributions reduce taxable pay.
        if v_comp.is_statutory and v_comp.is_taxable = false then
          v_taxable := v_taxable - v_amount;
        end if;
        insert into public.payslip_lines (
          payslip_id, component_id, line_no, line_type, description, amount
        ) values (v_payslip_id, v_comp.id, v_line_no, 'deduction', v_comp.name, v_amount);
      end if;

      v_line_no := v_line_no + 1;
    end loop;

    v_gross := round(v_emp.basic_salary + v_earnings, 2);
    v_taxable := round(greatest(0, v_taxable), 2);

    -- Raises when no bands are configured, which fails the whole run.
    v_paye := public.calculate_paye(
      v_taxable, v_emp.currency_code, v_emp.pay_frequency, v_period.end_date
    );

    if v_paye > 0 then
      insert into public.payslip_lines (payslip_id, line_no, line_type, description, amount)
      values (v_payslip_id, v_line_no, 'deduction', 'PAYE', v_paye);
    end if;

    update public.payslips
       set total_earnings = v_earnings,
           taxable_income = v_taxable,
           gross_pay      = v_gross,
           paye           = v_paye,
           statutory_deductions = v_statutory,
           other_deductions = v_other,
           total_deductions = round(v_paye + v_statutory + v_other, 2),
           net_pay        = round(v_gross - v_paye - v_statutory - v_other, 2),
           employer_contributions = v_employer
     where id = v_payslip_id;

    v_count := v_count + 1;
  end loop;

  update public.payroll_runs r
     set status = 'calculated',
         calculated_at = now(),
         employee_count = v_count,
         total_gross = coalesce(s.gross, 0),
         total_paye = coalesce(s.paye, 0),
         total_statutory = coalesce(s.statutory, 0),
         total_deductions = coalesce(s.deductions, 0),
         total_net = coalesce(s.net, 0),
         total_employer_cost = coalesce(s.employer, 0)
    from (
      select sum(gross_pay) gross, sum(paye) paye, sum(statutory_deductions) statutory,
             sum(total_deductions) deductions, sum(net_pay) net,
             sum(employer_contributions) employer
      from public.payslips where run_id = p_run_id
    ) s
   where r.id = p_run_id;

  return v_count;
end;
$$;

grant execute on function public.calculate_payroll_run(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Posting
-- ---------------------------------------------------------------------

/**
 * Posts an approved payroll run.
 *   Dr Salaries and Wages            gross
 *   Dr Employer Statutory Contributions  employer cost
 *   Cr Statutory Deductions Payable  PAYE + employee statutory + employer
 *   Cr Payroll Liabilities           net pay
 * Other deductions (loans, union dues) credit their component account
 * where one is set, and Payroll Liabilities otherwise.
 */
create or replace function public.post_payroll_run(p_run_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run      public.payroll_runs%rowtype;
  v_period   public.payroll_periods%rowtype;
  v_lines    jsonb := '[]'::jsonb;
  v_journal_id uuid;
  v_other    numeric(18, 4);
begin
  select * into v_run from public.payroll_runs where id = p_run_id for update;
  if not found then
    raise exception 'Payroll run % does not exist', p_run_id;
  end if;
  if v_run.status in ('posted', 'paid') then
    raise exception 'Payroll run % has already been posted', v_run.run_no;
  end if;
  if v_run.status <> 'approved' then
    raise exception
      'Payroll run % must be approved before posting (it is currently %)',
      v_run.run_no, v_run.status;
  end if;

  if auth.uid() is not null and not public.has_permission('payroll.runs.post') then
    raise exception 'Posting payroll needs the "Post payroll" permission';
  end if;

  select * into v_period from public.payroll_periods where id = v_run.period_id;

  v_other := v_run.total_deductions - v_run.total_paye - v_run.total_statutory;

  v_lines := jsonb_build_array(
    jsonb_build_object('account_code', '6100', 'debit', v_run.total_gross, 'credit', 0,
                       'description', 'Gross pay ' || v_period.name),
    jsonb_build_object('account_code', '2300', 'debit', 0, 'credit', v_run.total_net,
                       'description', 'Net pay ' || v_period.name)
  );

  if v_run.total_paye + v_run.total_statutory > 0 then
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_code', '2310', 'debit', 0,
                         'credit', v_run.total_paye + v_run.total_statutory,
                         'description', 'PAYE and statutory deductions ' || v_period.name)
    );
  end if;

  if v_other > 0 then
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_code', '2300', 'debit', 0, 'credit', v_other,
                         'description', 'Other deductions ' || v_period.name)
    );
  end if;

  if v_run.total_employer_cost > 0 then
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_code', '6110', 'debit', v_run.total_employer_cost, 'credit', 0,
                         'description', 'Employer contributions ' || v_period.name),
      jsonb_build_object('account_code', '2310', 'debit', 0, 'credit', v_run.total_employer_cost,
                         'description', 'Employer contributions payable ' || v_period.name)
    );
  end if;

  v_journal_id := public.post_journal_entry(
    p_reference              => 'JNL-' || v_run.run_no,
    p_description            => 'Payroll ' || v_period.name,
    p_lines                  => v_lines,
    p_journal_date           => v_period.pay_date,
    p_source_module          => 'payroll',
    p_source_document_type   => 'PAYROLL_RUN',
    p_source_document_id     => v_run.id,
    p_source_document_number => v_run.run_no,
    p_branch_id              => v_run.branch_id,
    p_is_system              => true
  );

  update public.payroll_runs
     set status = 'posted', posted_at = now(), posted_by = auth.uid(),
         journal_entry_id = v_journal_id
   where id = p_run_id;

  return v_journal_id;
end;
$$;

grant execute on function public.post_payroll_run(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Row stamps and audit
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'payroll_components', 'employee_components', 'payroll_tax_bands',
    'payroll_periods', 'payroll_runs', 'payslips'
  ]
  loop
    execute format('drop trigger if exists trg_%1$s_stamp on public.%1$I', t);
    execute format(
      'create trigger trg_%1$s_stamp before insert or update on public.%1$I
         for each row execute function public.set_row_audit_fields()', t);

    execute format('drop trigger if exists trg_%1$s_audit on public.%1$I', t);
    execute format(
      'create trigger trg_%1$s_audit after insert or update or delete on public.%1$I
         for each row execute function public.fn_audit(''payroll'')', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.payroll_components  enable row level security;
alter table public.employee_components enable row level security;
alter table public.payroll_tax_bands   enable row level security;
alter table public.payroll_periods     enable row level security;
alter table public.payroll_runs        enable row level security;
alter table public.payslips            enable row level security;
alter table public.payslip_lines       enable row level security;

drop policy if exists components_select on public.payroll_components;
create policy components_select on public.payroll_components
  for select to authenticated using (public.has_permission('payroll.view'));

drop policy if exists components_write on public.payroll_components;
create policy components_write on public.payroll_components
  for all to authenticated
  using (public.has_permission('payroll.components.manage'))
  with check (public.has_permission('payroll.components.manage'));

drop policy if exists emp_components_select on public.employee_components;
create policy emp_components_select on public.employee_components
  for select to authenticated using (public.has_permission('payroll.view'));

drop policy if exists emp_components_write on public.employee_components;
create policy emp_components_write on public.employee_components
  for all to authenticated
  using (public.has_permission('payroll.components.manage'))
  with check (public.has_permission('payroll.components.manage'));

drop policy if exists tax_bands_select on public.payroll_tax_bands;
create policy tax_bands_select on public.payroll_tax_bands
  for select to authenticated using (public.has_permission('payroll.view'));

drop policy if exists tax_bands_write on public.payroll_tax_bands;
create policy tax_bands_write on public.payroll_tax_bands
  for all to authenticated
  using (public.has_permission('payroll.components.manage'))
  with check (public.has_permission('payroll.components.manage'));

drop policy if exists periods_select on public.payroll_periods;
create policy periods_select on public.payroll_periods
  for select to authenticated using (public.has_permission('payroll.view'));

drop policy if exists periods_write on public.payroll_periods;
create policy periods_write on public.payroll_periods
  for all to authenticated
  using (public.has_permission('payroll.runs.create'))
  with check (public.has_permission('payroll.runs.create'));

drop policy if exists runs_select on public.payroll_runs;
create policy runs_select on public.payroll_runs
  for select to authenticated using (public.has_permission('payroll.view'));

drop policy if exists runs_insert on public.payroll_runs;
create policy runs_insert on public.payroll_runs
  for insert to authenticated with check (public.has_permission('payroll.runs.create'));

drop policy if exists runs_update on public.payroll_runs;
create policy runs_update on public.payroll_runs
  for update to authenticated
  using (public.has_any_permission(array[
    'payroll.runs.create', 'payroll.runs.approve', 'payroll.runs.mark_paid'
  ]))
  with check (public.has_any_permission(array[
    'payroll.runs.create', 'payroll.runs.approve', 'payroll.runs.mark_paid'
  ]));

-- An employee may always read their own payslip.
drop policy if exists payslips_select on public.payslips;
create policy payslips_select on public.payslips
  for select to authenticated
  using (
    public.has_permission('payslips.view_all')
    or employee_id in (select id from public.employees where profile_id = auth.uid())
  );

drop policy if exists payslip_lines_select on public.payslip_lines;
create policy payslip_lines_select on public.payslip_lines
  for select to authenticated
  using (
    public.has_permission('payslips.view_all')
    or payslip_id in (
      select p.id from public.payslips p
      join public.employees e on e.id = p.employee_id
      where e.profile_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- Starter components
--
-- Rates are left at nil deliberately. NSSA and any other statutory rate
-- must be set from the current schedule before payroll is run — see the
-- note at the top of this file.
-- ---------------------------------------------------------------------

insert into public.payroll_components
  (code, name, component_type, calculation, is_taxable, is_statutory,
   is_employer_contribution, sort_order, account_id)
select c.code, c.name, c.component_type, c.calculation, c.is_taxable, c.is_statutory,
       c.is_employer, c.sort_order, a.id
from (values
  ('HOUSING',   'Housing allowance',        'earning',   'fixed',            true,  false, false, 10, '6100'),
  ('TRANSPORT', 'Transport allowance',      'earning',   'fixed',            true,  false, false, 20, '6100'),
  ('OVERTIME',  'Overtime',                 'earning',   'fixed',            true,  false, false, 30, '6100'),
  ('BONUS',     'Bonus',                    'earning',   'fixed',            true,  false, false, 40, '6100'),
  ('NSSA_EE',   'NSSA (employee)',          'deduction', 'percent_of_basic', false, true,  false, 50, '2310'),
  ('NSSA_ER',   'NSSA (employer)',          'deduction', 'percent_of_basic', false, true,  true,  60, '6110'),
  ('LOAN',      'Staff loan repayment',     'deduction', 'fixed',            true,  false, false, 70, '2300'),
  ('UNION',     'Union dues',               'deduction', 'fixed',            true,  false, false, 80, '2300')
) as c(code, name, component_type, calculation, is_taxable, is_statutory, is_employer, sort_order, account_code)
join public.chart_of_accounts a on a.account_code = c.account_code
on conflict (code) do nothing;
