-- =====================================================================
-- Builders Paradise ERP — Accounting core
--
-- Chart of accounts, accounting periods, and THE journal posting service.
--
-- Built now, ahead of its phase, because a goods received note has to
-- post Dr Inventory / Cr Accounts Payable. Every module that touches
-- money — GRNs, POS sales, supplier payments, customer receipts, stock
-- adjustments, payroll — posts through public.post_journal_entry().
-- There is no second path into the ledger.
--
-- Re-runnable; nothing is dropped or truncated.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Chart of accounts
-- ---------------------------------------------------------------------

create table if not exists public.chart_of_accounts (
  id            uuid primary key default gen_random_uuid(),
  account_code  text not null,
  name          text not null,
  account_type  text not null,
  parent_id     uuid references public.chart_of_accounts (id) on delete restrict,
  description   text,

  -- A header account groups its children and cannot be posted to; only
  -- leaves take entries. This is what stops a trial balance
  -- double-counting a total against its own children.
  is_postable   boolean not null default true,

  -- System accounts are referenced by the posting service by code, so
  -- they must not be renamed or deleted out from under it.
  is_system     boolean not null default false,

  status        text not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid,

  constraint coa_code_key unique (account_code),
  constraint coa_type_check check (
    account_type in ('asset', 'liability', 'equity', 'income', 'cost_of_sales', 'expense')
  ),
  constraint coa_status_check check (status in ('active', 'inactive')),
  constraint coa_not_self check (parent_id is null or parent_id <> id)
);

create index if not exists coa_type_idx on public.chart_of_accounts (account_type);
create index if not exists coa_parent_idx on public.chart_of_accounts (parent_id);

/**
 * Which side increases this account.
 * Assets, cost of sales and expenses are debit-normal; the rest credit-normal.
 */
create or replace function public.account_normal_balance(p_type text)
returns text
language sql
immutable
as $$
  select case
    when p_type in ('asset', 'cost_of_sales', 'expense') then 'debit'
    when p_type in ('liability', 'equity', 'income') then 'credit'
  end;
$$;

-- ---------------------------------------------------------------------
-- Accounting periods
-- ---------------------------------------------------------------------

create table if not exists public.accounting_periods (
  id           uuid primary key default gen_random_uuid(),
  fiscal_year  integer not null,
  period_no    integer not null,
  name         text not null,
  start_date   date not null,
  end_date     date not null,
  status       text not null default 'open',
  closed_at    timestamptz,
  closed_by    uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid,
  updated_by   uuid,

  constraint periods_key unique (fiscal_year, period_no),
  constraint periods_status_check check (status in ('open', 'locked', 'closed')),
  constraint periods_dates_check check (end_date >= start_date),
  constraint periods_no_check check (period_no between 1 and 12)
);

create index if not exists periods_dates_idx on public.accounting_periods (start_date, end_date);

-- Periods must not overlap, or a transaction date would map to two of them.
create or replace function public.fn_guard_period_overlap()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from public.accounting_periods p
    where p.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and p.start_date <= new.end_date
      and p.end_date   >= new.start_date
  ) then
    raise exception 'Accounting period % overlaps an existing period', new.name;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_period_overlap on public.accounting_periods;
create trigger trg_period_overlap
  before insert or update on public.accounting_periods
  for each row execute function public.fn_guard_period_overlap();

/** The period a date falls in, or null if none is defined. */
create or replace function public.period_for_date(p_date date)
returns uuid
language sql
stable
as $$
  select id from public.accounting_periods
  where p_date between start_date and end_date
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- Journals
-- ---------------------------------------------------------------------

create table if not exists public.journal_entries (
  id                     uuid primary key default gen_random_uuid(),
  journal_no             bigint generated by default as identity,
  reference              text not null,
  journal_date           date not null default current_date,
  posting_date           timestamptz not null default now(),
  period_id              uuid references public.accounting_periods (id) on delete restrict,

  description            text not null,
  -- Where it came from. A system journal is generated by a module and
  -- must not be hand-edited; a manual journal is typed by an accountant.
  source_module          text,
  source_document_type   text,
  source_document_id     uuid,
  source_document_number text,
  is_system              boolean not null default false,

  total_debit            numeric(18, 4) not null,
  total_credit           numeric(18, 4) not null,

  status                 text not null default 'posted',
  reverses_journal_id    uuid references public.journal_entries (id) on delete restrict,
  reversed_by_journal_id uuid references public.journal_entries (id) on delete restrict,

  branch_id              uuid references public.branches (id) on delete set null,

  created_at             timestamptz not null default now(),
  created_by             uuid references public.profiles (id) on delete set null,

  constraint journal_reference_key unique (reference),
  constraint journal_status_check check (status in ('posted', 'reversed')),
  -- The invariant the whole system rests on.
  constraint journal_balanced check (total_debit = total_credit),
  constraint journal_positive check (total_debit >= 0)
);

create index if not exists journal_date_idx on public.journal_entries (journal_date desc);
create index if not exists journal_period_idx on public.journal_entries (period_id);
create index if not exists journal_source_idx on public.journal_entries (source_document_type, source_document_id);
create index if not exists journal_module_idx on public.journal_entries (source_module);

create table if not exists public.journal_entry_lines (
  id           uuid primary key default gen_random_uuid(),
  journal_id   uuid not null references public.journal_entries (id) on delete cascade,
  line_no      integer not null,
  account_id   uuid not null references public.chart_of_accounts (id) on delete restrict,
  description  text,
  debit        numeric(18, 4) not null default 0,
  credit       numeric(18, 4) not null default 0,

  -- Analysis dimensions, all optional, for reporting by branch, by
  -- supplier, by customer or by product without extra joins.
  branch_id    uuid references public.branches (id) on delete set null,
  supplier_id  uuid,
  customer_id  uuid,
  product_id   uuid references public.products (id) on delete set null,

  created_at   timestamptz not null default now(),

  constraint jel_line_key unique (journal_id, line_no),
  constraint jel_amounts_check check (debit >= 0 and credit >= 0),
  -- Exactly one side per line. A line that is both, or neither, is a bug.
  constraint jel_one_side check (
    (debit > 0 and credit = 0) or (credit > 0 and debit = 0)
  )
);

create index if not exists jel_journal_idx on public.journal_entry_lines (journal_id);
create index if not exists jel_account_idx on public.journal_entry_lines (account_id);
create index if not exists jel_branch_idx on public.journal_entry_lines (branch_id);

-- ---------------------------------------------------------------------
-- Posted journals are immutable. Corrections are reversals.
-- ---------------------------------------------------------------------

create or replace function public.fn_block_journal_mutation()
returns trigger
language plpgsql
as $$
begin
  -- Marking a journal reversed is the one permitted update, and only the
  -- posting service does it.
  if tg_op = 'UPDATE'
     and old.status = 'posted' and new.status = 'reversed'
     and old.total_debit = new.total_debit
     and old.total_credit = new.total_credit
     and old.reference = new.reference then
    return new;
  end if;

  raise exception
    'Posted journals cannot be % — reverse the journal instead',
    case tg_op when 'UPDATE' then 'edited' else 'deleted' end;
end;
$$;

drop trigger if exists trg_journal_immutable on public.journal_entries;
create trigger trg_journal_immutable
  before update or delete on public.journal_entries
  for each row execute function public.fn_block_journal_mutation();

create or replace function public.fn_block_journal_line_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Journal lines cannot be changed once posted — reverse the journal instead';
end;
$$;

drop trigger if exists trg_journal_line_immutable on public.journal_entry_lines;
create trigger trg_journal_line_immutable
  before update or delete on public.journal_entry_lines
  for each row execute function public.fn_block_journal_line_mutation();

-- ---------------------------------------------------------------------
-- THE posting service
--
-- Takes lines as jsonb:
--   [{"account_code":"1200","debit":100,"credit":0,"description":"..."}, ...]
-- Either every line lands or none does. An unbalanced journal cannot be
-- written: the check runs here AND as a table constraint.
-- ---------------------------------------------------------------------

create or replace function public.post_journal_entry(
  p_reference              text,
  p_description            text,
  p_lines                  jsonb,
  p_journal_date           date default current_date,
  p_source_module          text default null,
  p_source_document_type   text default null,
  p_source_document_id     uuid default null,
  p_source_document_number text default null,
  p_branch_id              uuid default null,
  p_is_system              boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_journal_id   uuid;
  v_period_id    uuid;
  v_period       public.accounting_periods%rowtype;
  v_line         jsonb;
  v_account      public.chart_of_accounts%rowtype;
  v_debit        numeric(18, 4);
  v_credit       numeric(18, 4);
  v_total_debit  numeric(18, 4) := 0;
  v_total_credit numeric(18, 4) := 0;
  v_line_no      integer := 0;
begin
  if p_lines is null or jsonb_array_length(p_lines) < 2 then
    raise exception 'A journal needs at least two lines';
  end if;

  ------------------------------------------------------------------
  -- The period must exist and be open.
  ------------------------------------------------------------------
  v_period_id := public.period_for_date(coalesce(p_journal_date, current_date));
  if v_period_id is null then
    raise exception
      'No accounting period covers %. Create the period before posting.', p_journal_date;
  end if;

  select * into v_period from public.accounting_periods where id = v_period_id;
  if v_period.status <> 'open' then
    raise exception
      'Accounting period "%" is % — it cannot accept new entries', v_period.name, v_period.status;
  end if;

  ------------------------------------------------------------------
  -- Total first, so an unbalanced journal is refused before any row
  -- is written rather than failing halfway through.
  ------------------------------------------------------------------
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_debit  := round(coalesce((v_line ->> 'debit')::numeric, 0), 4);
    v_credit := round(coalesce((v_line ->> 'credit')::numeric, 0), 4);

    if v_debit < 0 or v_credit < 0 then
      raise exception 'Journal amounts cannot be negative — use the other side instead';
    end if;
    if (v_debit > 0 and v_credit > 0) or (v_debit = 0 and v_credit = 0) then
      raise exception 'Each journal line must be either a debit or a credit, not both or neither';
    end if;

    v_total_debit  := v_total_debit + v_debit;
    v_total_credit := v_total_credit + v_credit;
  end loop;

  if v_total_debit <> v_total_credit then
    raise exception
      'Journal does not balance: debits % against credits %', v_total_debit, v_total_credit;
  end if;
  if v_total_debit = 0 then
    raise exception 'A journal with no value cannot be posted';
  end if;

  ------------------------------------------------------------------
  -- Header
  ------------------------------------------------------------------
  insert into public.journal_entries (
    reference, journal_date, period_id, description,
    source_module, source_document_type, source_document_id, source_document_number,
    is_system, total_debit, total_credit, branch_id, created_by
  ) values (
    p_reference, coalesce(p_journal_date, current_date), v_period_id, p_description,
    p_source_module, p_source_document_type, p_source_document_id, p_source_document_number,
    p_is_system, v_total_debit, v_total_credit, p_branch_id, auth.uid()
  )
  returning id into v_journal_id;

  ------------------------------------------------------------------
  -- Lines
  ------------------------------------------------------------------
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_line_no := v_line_no + 1;

    select * into v_account
    from public.chart_of_accounts
    where account_code = (v_line ->> 'account_code');

    if not found then
      raise exception 'Ledger account "%" does not exist', v_line ->> 'account_code';
    end if;
    if not v_account.is_postable then
      raise exception
        'Account % "%" is a heading and cannot be posted to', v_account.account_code, v_account.name;
    end if;
    if v_account.status <> 'active' then
      raise exception 'Account % "%" is inactive', v_account.account_code, v_account.name;
    end if;

    insert into public.journal_entry_lines (
      journal_id, line_no, account_id, description, debit, credit,
      branch_id, supplier_id, customer_id, product_id
    ) values (
      v_journal_id,
      v_line_no,
      v_account.id,
      v_line ->> 'description',
      round(coalesce((v_line ->> 'debit')::numeric, 0), 4),
      round(coalesce((v_line ->> 'credit')::numeric, 0), 4),
      coalesce((v_line ->> 'branch_id')::uuid, p_branch_id),
      (v_line ->> 'supplier_id')::uuid,
      (v_line ->> 'customer_id')::uuid,
      (v_line ->> 'product_id')::uuid
    );
  end loop;

  return v_journal_id;
end;
$$;

grant execute on function public.post_journal_entry(
  text, text, jsonb, date, text, text, uuid, text, uuid, boolean
) to authenticated;

-- ---------------------------------------------------------------------
-- Reversal — the only way to undo a posted journal
-- ---------------------------------------------------------------------

create or replace function public.reverse_journal_entry(
  p_journal_id   uuid,
  p_reason       text,
  p_reversal_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_original public.journal_entries%rowtype;
  v_lines    jsonb;
  v_new_id   uuid;
begin
  select * into v_original from public.journal_entries where id = p_journal_id;
  if not found then
    raise exception 'Journal % does not exist', p_journal_id;
  end if;
  if v_original.status = 'reversed' then
    raise exception 'Journal % has already been reversed', v_original.reference;
  end if;

  -- Mirror every line: debits become credits and vice versa.
  select jsonb_agg(
    jsonb_build_object(
      'account_code', a.account_code,
      'debit',  l.credit,
      'credit', l.debit,
      'description', coalesce(l.description, '') || ' (reversal)',
      'branch_id', l.branch_id,
      'supplier_id', l.supplier_id,
      'customer_id', l.customer_id,
      'product_id', l.product_id
    ) order by l.line_no
  )
  into v_lines
  from public.journal_entry_lines l
  join public.chart_of_accounts a on a.id = l.account_id
  where l.journal_id = p_journal_id;

  v_new_id := public.post_journal_entry(
    p_reference              => v_original.reference || '-REV',
    p_description            => 'Reversal of ' || v_original.reference || ' — ' || p_reason,
    p_lines                  => v_lines,
    p_journal_date           => coalesce(p_reversal_date, current_date),
    p_source_module          => v_original.source_module,
    p_source_document_type   => v_original.source_document_type,
    p_source_document_id     => v_original.source_document_id,
    p_source_document_number => v_original.source_document_number,
    p_branch_id              => v_original.branch_id,
    p_is_system              => v_original.is_system
  );

  update public.journal_entries
     set status = 'reversed', reversed_by_journal_id = v_new_id
   where id = p_journal_id;

  update public.journal_entries
     set reverses_journal_id = p_journal_id
   where id = v_new_id;

  return v_new_id;
end;
$$;

grant execute on function public.reverse_journal_entry(uuid, text, date) to authenticated;

-- ---------------------------------------------------------------------
-- Trial balance — the proof that everything above works
-- ---------------------------------------------------------------------

create or replace function public.trial_balance(
  p_as_at     date default current_date,
  p_branch_id uuid default null
)
returns table (
  account_code text,
  account_name text,
  account_type text,
  total_debit  numeric,
  total_credit numeric,
  balance      numeric
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    a.account_code,
    a.name,
    a.account_type,
    coalesce(sum(l.debit), 0),
    coalesce(sum(l.credit), 0),
    case
      when public.account_normal_balance(a.account_type) = 'debit'
        then coalesce(sum(l.debit), 0) - coalesce(sum(l.credit), 0)
      else coalesce(sum(l.credit), 0) - coalesce(sum(l.debit), 0)
    end
  from public.chart_of_accounts a
  join public.journal_entry_lines l on l.account_id = a.id
  join public.journal_entries j on j.id = l.journal_id
  where j.journal_date <= p_as_at
    and (p_branch_id is null or l.branch_id = p_branch_id)
  group by a.account_code, a.name, a.account_type
  having coalesce(sum(l.debit), 0) <> 0 or coalesce(sum(l.credit), 0) <> 0
  order by a.account_code;
$$;

grant execute on function public.trial_balance(date, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Row stamps and audit
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['chart_of_accounts', 'accounting_periods']
  loop
    execute format('drop trigger if exists trg_%1$s_stamp on public.%1$I', t);
    execute format(
      'create trigger trg_%1$s_stamp before insert or update on public.%1$I
         for each row execute function public.set_row_audit_fields()', t);

    execute format('drop trigger if exists trg_%1$s_audit on public.%1$I', t);
    execute format(
      'create trigger trg_%1$s_audit after insert or update or delete on public.%1$I
         for each row execute function public.fn_audit(''accounting'')', t);
  end loop;
end;
$$;

drop trigger if exists trg_journal_audit on public.journal_entries;
create trigger trg_journal_audit
  after insert or update on public.journal_entries
  for each row execute function public.fn_audit('accounting');
