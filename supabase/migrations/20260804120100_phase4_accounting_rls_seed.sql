-- =====================================================================
-- Builders Paradise ERP — Accounting: RLS, chart of accounts, periods
-- =====================================================================

alter table public.chart_of_accounts   enable row level security;
alter table public.accounting_periods  enable row level security;
alter table public.journal_entries     enable row level security;
alter table public.journal_entry_lines enable row level security;

alter table public.journal_entries     force row level security;
alter table public.journal_entry_lines force row level security;

-- ---------------------------------------------------------------------
-- Chart of accounts
-- ---------------------------------------------------------------------
drop policy if exists coa_select on public.chart_of_accounts;
create policy coa_select on public.chart_of_accounts
  for select to authenticated
  using (public.has_permission('coa.view'));

drop policy if exists coa_insert on public.chart_of_accounts;
create policy coa_insert on public.chart_of_accounts
  for insert to authenticated
  with check (public.has_permission('coa.manage'));

drop policy if exists coa_update on public.chart_of_accounts;
create policy coa_update on public.chart_of_accounts
  for update to authenticated
  using (public.has_permission('coa.manage'))
  with check (public.has_permission('coa.manage'));

-- A system account is referenced by the posting service by code. Renaming
-- or deactivating one would silently break GRN and sales posting.
create or replace function public.fn_guard_system_account()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system then
      raise exception 'System account % "%" cannot be deleted', old.account_code, old.name;
    end if;
    return old;
  end if;

  if old.is_system and (
       new.account_code is distinct from old.account_code
    or new.is_system   is distinct from old.is_system
    or new.status      is distinct from old.status
    or new.is_postable is distinct from old.is_postable
  ) then
    raise exception
      'System account % is used by automatic posting and cannot be recoded or deactivated',
      old.account_code;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_coa_system_guard on public.chart_of_accounts;
create trigger trg_coa_system_guard
  before update or delete on public.chart_of_accounts
  for each row execute function public.fn_guard_system_account();

-- ---------------------------------------------------------------------
-- Periods
-- ---------------------------------------------------------------------
drop policy if exists periods_select on public.accounting_periods;
create policy periods_select on public.accounting_periods
  for select to authenticated
  using (public.has_permission('accounting.view'));

drop policy if exists periods_write on public.accounting_periods;
create policy periods_write on public.accounting_periods
  for all to authenticated
  using (public.has_permission('accounting.periods.manage'))
  with check (public.has_permission('accounting.periods.manage'));

-- Reopening a closed period would let history change underneath a
-- filed return. Locked can go back to open; closed is final.
create or replace function public.fn_guard_period_reopen()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'closed' and new.status <> 'closed' then
    raise exception
      'Period "%" is closed. A closed period cannot be reopened — post an adjusting entry in the current period instead.',
      old.name;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_period_reopen_guard on public.accounting_periods;
create trigger trg_period_reopen_guard
  before update on public.accounting_periods
  for each row execute function public.fn_guard_period_reopen();

-- ---------------------------------------------------------------------
-- Journals: read by permission, written only by the posting service
-- ---------------------------------------------------------------------
drop policy if exists journal_select on public.journal_entries;
create policy journal_select on public.journal_entries
  for select to authenticated
  using (public.has_any_permission(array['journals.view', 'gl.view', 'accounting.view']));

drop policy if exists journal_lines_select on public.journal_entry_lines;
create policy journal_lines_select on public.journal_entry_lines
  for select to authenticated
  using (public.has_any_permission(array['journals.view', 'gl.view', 'accounting.view']));

-- Deliberately no insert/update/delete policies. post_journal_entry() is
-- SECURITY DEFINER and is the only way a journal is ever written.

-- ---------------------------------------------------------------------
-- Chart of accounts — a hardware retailer's starting set.
--
-- Codes marked is_system are referenced by name in the posting service;
-- everything else is yours to extend.
-- ---------------------------------------------------------------------

insert into public.chart_of_accounts (account_code, name, account_type, is_postable, is_system) values
  -- Assets
  ('1000', 'ASSETS',                        'asset',         false, false),
  ('1100', 'Cash and Cash Equivalents',     'asset',         false, false),
  ('1110', 'Cash on Hand',                  'asset',         true,  true),
  ('1120', 'Till Float',                    'asset',         true,  true),
  ('1130', 'Bank — Current Account',        'asset',         true,  true),
  ('1140', 'Bank — Call Account',           'asset',         true,  false),
  ('1200', 'Accounts Receivable',           'asset',         true,  true),
  ('1210', 'Allowance for Doubtful Debts',  'asset',         true,  false),
  ('1300', 'Inventory',                     'asset',         true,  true),
  ('1310', 'Goods in Transit',              'asset',         true,  true),
  ('1320', 'Stock Received Not Invoiced',   'asset',         true,  true),
  ('1400', 'Prepayments and Deposits',      'asset',         true,  false),
  ('1500', 'Property, Plant and Equipment', 'asset',         true,  false),
  ('1590', 'Accumulated Depreciation',      'asset',         true,  false),

  -- Liabilities
  ('2000', 'LIABILITIES',                   'liability',     false, false),
  ('2100', 'Accounts Payable',              'liability',     true,  true),
  ('2200', 'Tax Payable',                   'liability',     true,  true),
  ('2210', 'VAT Input',                     'liability',     true,  true),
  ('2220', 'VAT Output',                    'liability',     true,  true),
  ('2300', 'Payroll Liabilities',           'liability',     true,  true),
  ('2310', 'Statutory Deductions Payable',  'liability',     true,  true),
  ('2400', 'Accruals',                      'liability',     true,  false),
  ('2500', 'Customer Deposits',             'liability',     true,  false),

  -- Equity
  ('3000', 'EQUITY',                        'equity',        false, false),
  ('3100', 'Share Capital',                 'equity',        true,  false),
  ('3200', 'Retained Earnings',             'equity',        true,  true),
  ('3300', 'Current Year Earnings',         'equity',        true,  true),

  -- Income
  ('4000', 'INCOME',                        'income',        false, false),
  ('4100', 'Sales — Goods',                 'income',        true,  true),
  ('4200', 'Sales Returns and Allowances',  'income',        true,  true),
  ('4300', 'Discounts Allowed',             'income',        true,  true),
  ('4900', 'Other Income',                  'income',        true,  false),

  -- Cost of sales
  ('5000', 'COST OF SALES',                 'cost_of_sales', false, false),
  ('5100', 'Cost of Goods Sold',            'cost_of_sales', true,  true),
  ('5200', 'Purchase Returns',              'cost_of_sales', true,  true),
  ('5300', 'Freight and Carriage Inwards',  'cost_of_sales', true,  false),
  ('5400', 'Stock Adjustments and Markdown','cost_of_sales', true,  true),
  ('5500', 'Stock Count Variance',          'cost_of_sales', true,  true),

  -- Expenses
  ('6000', 'EXPENSES',                      'expense',       false, false),
  ('6100', 'Salaries and Wages',            'expense',       true,  true),
  ('6110', 'Employer Statutory Contributions','expense',     true,  true),
  ('6200', 'Rent',                          'expense',       true,  false),
  ('6300', 'Utilities',                     'expense',       true,  false),
  ('6400', 'Repairs and Maintenance',       'expense',       true,  false),
  ('6500', 'Transport and Fuel',            'expense',       true,  false),
  ('6600', 'Bank Charges',                  'expense',       true,  true),
  ('6700', 'Professional Fees',             'expense',       true,  false),
  ('6800', 'Depreciation',                  'expense',       true,  false),
  ('6900', 'General Expenses',              'expense',       true,  false)
on conflict (account_code) do update
  set name = excluded.name,
      account_type = excluded.account_type,
      is_postable = excluded.is_postable,
      is_system = excluded.is_system;

-- Parent the detail accounts under their headings.
update public.chart_of_accounts child
   set parent_id = parent.id
  from public.chart_of_accounts parent
 where parent.account_code = (left(child.account_code, 1) || '000')
   and child.account_code <> parent.account_code
   and child.parent_id is distinct from parent.id;

-- ---------------------------------------------------------------------
-- Accounting periods for the current fiscal year
--
-- Generated from the fiscal year start month in system_settings, so a
-- March year-end works without editing this file.
-- ---------------------------------------------------------------------

do $$
declare
  v_start_month integer;
  v_year        integer;
  v_start       date;
  i             integer;
  v_period_start date;
begin
  select fiscal_year_start_month into v_start_month from public.system_settings where id;
  v_start_month := coalesce(v_start_month, 1);

  v_year := extract(year from current_date)::integer;
  v_start := make_date(v_year, v_start_month, 1);
  -- If the year has not started yet, we are still in the previous one.
  if current_date < v_start then
    v_year := v_year - 1;
    v_start := make_date(v_year, v_start_month, 1);
  end if;

  for i in 1..12 loop
    v_period_start := v_start + ((i - 1) || ' months')::interval;
    insert into public.accounting_periods (fiscal_year, period_no, name, start_date, end_date)
    values (
      v_year,
      i,
      to_char(v_period_start, 'Mon YYYY'),
      v_period_start,
      (v_period_start + interval '1 month - 1 day')::date
    )
    on conflict (fiscal_year, period_no) do nothing;
  end loop;
end;
$$;
