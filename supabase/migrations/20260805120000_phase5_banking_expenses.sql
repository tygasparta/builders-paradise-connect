-- =====================================================================
-- Builders Paradise ERP — Banking and Expenses
--
-- Both post through post_journal_entry(), like every other module. A
-- bank account is a ledger account with statement lines attached; an
-- expense is a document that debits an expense account and credits
-- whatever paid for it.
--
-- Re-runnable. Requires the accounting core.
-- =====================================================================

insert into public.document_sequences (doc_type, prefix) values
  ('expense',        'EXP'),
  ('bank_txn',       'BTX'),
  ('reconciliation', 'REC')
on conflict (doc_type) do nothing;

-- ---------------------------------------------------------------------
-- Bank accounts
-- ---------------------------------------------------------------------

create table if not exists public.bank_accounts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  bank_name       text not null,
  account_number  text,
  branch_name     text,
  swift_code      text,
  currency_code   char(3) not null default 'USD',

  -- The general ledger account this bank posts to. Every movement on
  -- the statement lands here, which is what makes reconciliation
  -- meaningful rather than decorative.
  ledger_account_id uuid not null references public.chart_of_accounts (id) on delete restrict,

  branch_id       uuid references public.branches (id) on delete set null,
  opening_balance numeric(18, 4) not null default 0,
  is_default      boolean not null default false,
  status          text not null default 'active',
  notes           text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid,
  updated_by      uuid,

  constraint bank_status_check check (status in ('active', 'inactive')),
  constraint bank_account_unique unique (bank_name, account_number)
);

create index if not exists bank_status_idx on public.bank_accounts (status);

-- Only one default, so "the bank account" is never ambiguous.
create unique index if not exists bank_one_default
  on public.bank_accounts (is_default) where is_default;

-- ---------------------------------------------------------------------
-- Bank transactions
--
-- Signed amounts: positive is money in, negative is money out. One
-- column rather than separate debit/credit fields, because a statement
-- line is a single movement and splitting it invites lines that are
-- somehow both.
-- ---------------------------------------------------------------------

create table if not exists public.bank_transactions (
  id                uuid primary key default gen_random_uuid(),
  reference_no      text not null,
  bank_account_id   uuid not null references public.bank_accounts (id) on delete restrict,
  transaction_date  date not null default current_date,
  description       text not null,
  reference         text,
  amount            numeric(18, 4) not null,
  transaction_type  text not null,

  -- Set when this line came from, or created, a ledger entry.
  journal_entry_id  uuid references public.journal_entries (id) on delete restrict,
  source_module     text,
  source_document_type text,
  source_document_id   uuid,

  reconciliation_id uuid,
  reconciled        boolean not null default false,

  created_at        timestamptz not null default now(),
  created_by        uuid references public.profiles (id) on delete set null,

  constraint bank_txn_ref_key unique (reference_no),
  constraint bank_txn_amount_check check (amount <> 0),
  constraint bank_txn_type_check check (
    transaction_type in ('deposit', 'withdrawal', 'charge', 'interest', 'transfer', 'other')
  )
);

create index if not exists bank_txn_account_idx on public.bank_transactions (bank_account_id, transaction_date desc);
create index if not exists bank_txn_reconciled_idx on public.bank_transactions (reconciled);

-- ---------------------------------------------------------------------
-- Reconciliations
-- ---------------------------------------------------------------------

create table if not exists public.bank_reconciliations (
  id                uuid primary key default gen_random_uuid(),
  reference_no      text not null,
  bank_account_id   uuid not null references public.bank_accounts (id) on delete restrict,
  statement_date    date not null,
  statement_balance numeric(18, 4) not null,
  book_balance      numeric(18, 4) not null default 0,
  difference        numeric(18, 4) not null default 0,
  status            text not null default 'draft',
  finalised_at      timestamptz,
  finalised_by      uuid references public.profiles (id) on delete set null,
  notes             text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid,
  updated_by        uuid,

  constraint rec_ref_key unique (reference_no),
  constraint rec_status_check check (status in ('draft', 'finalised'))
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bank_txn_reconciliation_fk') then
    alter table public.bank_transactions
      add constraint bank_txn_reconciliation_fk
      foreign key (reconciliation_id) references public.bank_reconciliations (id) on delete set null;
  end if;
end;
$$;

-- A finalised reconciliation is a signed-off position and cannot be edited.
create or replace function public.fn_guard_finalised_reconciliation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'finalised' then
      raise exception 'Reconciliation % is finalised and cannot be deleted', old.reference_no;
    end if;
    return old;
  end if;
  if old.status = 'finalised' then
    raise exception
      'Reconciliation % is finalised. Post an adjusting entry instead of editing it.',
      old.reference_no;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rec_finalised_guard on public.bank_reconciliations;
create trigger trg_rec_finalised_guard
  before update or delete on public.bank_reconciliations
  for each row execute function public.fn_guard_finalised_reconciliation();

-- ---------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------

create table if not exists public.expense_categories (
  id         uuid primary key default gen_random_uuid(),
  code       text not null,
  name       text not null,
  -- Which expense account this category posts to.
  account_id uuid not null references public.chart_of_accounts (id) on delete restrict,
  status     text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint expense_cat_code_key unique (code),
  constraint expense_cat_status_check check (status in ('active', 'inactive'))
);

create table if not exists public.expenses (
  id               uuid primary key default gen_random_uuid(),
  expense_no       text not null,
  category_id      uuid not null references public.expense_categories (id) on delete restrict,
  branch_id        uuid references public.branches (id) on delete set null,
  supplier_id      uuid references public.suppliers (id) on delete set null,

  expense_date     date not null default current_date,
  description      text not null,
  reference        text,

  amount           numeric(18, 4) not null,
  tax_amount       numeric(18, 4) not null default 0,
  total            numeric(18, 4) not null,

  -- How it was settled. Cash and bank hit different ledger accounts.
  payment_method   text not null default 'bank',
  bank_account_id  uuid references public.bank_accounts (id) on delete restrict,

  status           text not null default 'draft',
  submitted_at     timestamptz,
  approved_by      uuid references public.profiles (id) on delete set null,
  approved_at      timestamptz,
  posted_at        timestamptz,
  posted_by        uuid references public.profiles (id) on delete set null,
  journal_entry_id uuid references public.journal_entries (id) on delete restrict,

  attachment_url   text,
  notes            text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid,
  updated_by       uuid,

  constraint expense_no_key unique (expense_no),
  constraint expense_amount_check check (amount > 0 and tax_amount >= 0 and total > 0),
  constraint expense_status_check check (
    status in ('draft', 'submitted', 'approved', 'posted', 'rejected', 'cancelled')
  ),
  constraint expense_method_check check (
    payment_method in ('cash', 'bank', 'petty_cash', 'card', 'mobile_money')
  ),
  -- Paying from a bank needs to say which one.
  constraint expense_bank_required check (
    payment_method <> 'bank' or bank_account_id is not null
  )
);

create index if not exists expense_status_idx on public.expenses (status);
create index if not exists expense_date_idx on public.expenses (expense_date desc);
create index if not exists expense_category_idx on public.expenses (category_id);

create or replace function public.fn_guard_posted_expense()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'posted' then
      raise exception 'Expense % is posted and cannot be deleted', old.expense_no;
    end if;
    return old;
  end if;
  if old.status = 'posted' and new.status = 'posted'
     and (new.total is distinct from old.total or new.category_id is distinct from old.category_id)
  then
    raise exception
      'Expense % is posted. Reverse its journal instead of editing it.', old.expense_no;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_expense_posted_guard on public.expenses;
create trigger trg_expense_posted_guard
  before update or delete on public.expenses
  for each row execute function public.fn_guard_posted_expense();

-- ---------------------------------------------------------------------
-- Posting services
-- ---------------------------------------------------------------------

/**
 * Posts an approved expense.
 *   Dr expense account (category)     net
 *   Dr VAT Input                      tax, if any
 *   Cr Cash on Hand / Bank            total
 * Where paid from a bank, a matching statement line is created so the
 * payment shows up in reconciliation rather than having to be typed twice.
 */
create or replace function public.post_expense(p_expense_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_exp        public.expenses%rowtype;
  v_category   public.expense_categories%rowtype;
  v_account    public.chart_of_accounts%rowtype;
  v_credit     text;
  v_bank       public.bank_accounts%rowtype;
  v_lines      jsonb;
  v_journal_id uuid;
begin
  select * into v_exp from public.expenses where id = p_expense_id for update;
  if not found then
    raise exception 'Expense % does not exist', p_expense_id;
  end if;
  if v_exp.status = 'posted' then
    raise exception 'Expense % has already been posted', v_exp.expense_no;
  end if;
  if v_exp.status <> 'approved' then
    raise exception
      'Expense % must be approved before posting (it is currently %)',
      v_exp.expense_no, v_exp.status;
  end if;

  if auth.uid() is not null and not public.has_permission('expenses.post') then
    raise exception 'Posting an expense needs the "Post expenses" permission';
  end if;

  select * into v_category from public.expense_categories where id = v_exp.category_id;
  select * into v_account from public.chart_of_accounts where id = v_category.account_id;

  if v_exp.payment_method = 'bank' then
    select * into v_bank from public.bank_accounts where id = v_exp.bank_account_id;
    select account_code into v_credit from public.chart_of_accounts where id = v_bank.ledger_account_id;
  elsif v_exp.payment_method = 'petty_cash' then
    v_credit := '1120';
  else
    v_credit := '1110';
  end if;

  v_lines := jsonb_build_array(
    jsonb_build_object(
      'account_code', v_account.account_code,
      'debit', v_exp.amount,
      'credit', 0,
      'description', v_exp.description,
      'supplier_id', v_exp.supplier_id
    ),
    jsonb_build_object(
      'account_code', v_credit,
      'debit', 0,
      'credit', v_exp.total,
      'description', 'Paid ' || v_exp.expense_no
    )
  );

  if v_exp.tax_amount > 0 then
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'account_code', '2210',
        'debit', v_exp.tax_amount,
        'credit', 0,
        'description', 'Input tax ' || v_exp.expense_no
      )
    );
  end if;

  v_journal_id := public.post_journal_entry(
    p_reference              => 'JNL-' || v_exp.expense_no,
    p_description            => 'Expense ' || v_exp.expense_no || ' — ' || v_exp.description,
    p_lines                  => v_lines,
    p_journal_date           => v_exp.expense_date,
    p_source_module          => 'expenses',
    p_source_document_type   => 'EXPENSE',
    p_source_document_id     => v_exp.id,
    p_source_document_number => v_exp.expense_no,
    p_branch_id              => v_exp.branch_id,
    p_is_system              => true
  );

  -- The bank statement should show what left the account.
  if v_exp.payment_method = 'bank' and v_exp.bank_account_id is not null then
    insert into public.bank_transactions (
      reference_no, bank_account_id, transaction_date, description, reference,
      amount, transaction_type, journal_entry_id,
      source_module, source_document_type, source_document_id, created_by
    ) values (
      public.next_document_number('bank_txn'),
      v_exp.bank_account_id, v_exp.expense_date,
      v_exp.description, v_exp.expense_no,
      -v_exp.total, 'withdrawal', v_journal_id,
      'expenses', 'EXPENSE', v_exp.id, auth.uid()
    );
  end if;

  update public.expenses
     set status = 'posted', posted_at = now(), posted_by = auth.uid(),
         journal_entry_id = v_journal_id
   where id = p_expense_id;

  return v_journal_id;
end;
$$;

grant execute on function public.post_expense(uuid) to authenticated;

/**
 * Records a bank charge, interest or other direct movement and posts it.
 * Amount is signed: negative for money out.
 */
create or replace function public.post_bank_transaction(
  p_bank_account_id uuid,
  p_date            date,
  p_description     text,
  p_amount          numeric,
  p_type            text,
  p_contra_account  text,
  p_reference       text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bank       public.bank_accounts%rowtype;
  v_bank_code  text;
  v_lines      jsonb;
  v_journal_id uuid;
  v_ref        text;
begin
  if auth.uid() is not null and not public.has_permission('banking.transactions.create') then
    raise exception 'Recording a bank transaction needs the "Record bank transactions" permission';
  end if;
  if p_amount = 0 then
    raise exception 'A bank transaction cannot be for nil';
  end if;

  select * into v_bank from public.bank_accounts where id = p_bank_account_id;
  if not found then
    raise exception 'Bank account % does not exist', p_bank_account_id;
  end if;

  select account_code into v_bank_code
  from public.chart_of_accounts where id = v_bank.ledger_account_id;

  -- Money in debits the bank; money out credits it.
  if p_amount > 0 then
    v_lines := jsonb_build_array(
      jsonb_build_object('account_code', v_bank_code, 'debit', p_amount, 'credit', 0,
                         'description', p_description),
      jsonb_build_object('account_code', p_contra_account, 'debit', 0, 'credit', p_amount,
                         'description', p_description)
    );
  else
    v_lines := jsonb_build_array(
      jsonb_build_object('account_code', p_contra_account, 'debit', abs(p_amount), 'credit', 0,
                         'description', p_description),
      jsonb_build_object('account_code', v_bank_code, 'debit', 0, 'credit', abs(p_amount),
                         'description', p_description)
    );
  end if;

  v_ref := public.next_document_number('bank_txn');

  v_journal_id := public.post_journal_entry(
    p_reference              => 'JNL-' || v_ref,
    p_description            => p_description,
    p_lines                  => v_lines,
    p_journal_date           => coalesce(p_date, current_date),
    p_source_module          => 'banking',
    p_source_document_type   => 'BANK_TXN',
    p_source_document_number => v_ref,
    p_branch_id              => v_bank.branch_id,
    p_is_system              => true
  );

  insert into public.bank_transactions (
    reference_no, bank_account_id, transaction_date, description, reference,
    amount, transaction_type, journal_entry_id, source_module, created_by
  ) values (
    v_ref, p_bank_account_id, coalesce(p_date, current_date), p_description, p_reference,
    p_amount, p_type, v_journal_id, 'banking', auth.uid()
  );

  return v_journal_id;
end;
$$;

grant execute on function public.post_bank_transaction(uuid, date, text, numeric, text, text, text)
  to authenticated;

/** Book balance for a bank account: opening plus every recorded movement. */
create or replace function public.bank_balance(p_bank_account_id uuid, p_as_at date default current_date)
returns numeric
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(b.opening_balance, 0)
       + coalesce((
           select sum(t.amount) from public.bank_transactions t
           where t.bank_account_id = b.id and t.transaction_date <= p_as_at
         ), 0)
  from public.bank_accounts b
  where b.id = p_bank_account_id;
$$;

grant execute on function public.bank_balance(uuid, date) to authenticated;

-- ---------------------------------------------------------------------
-- Row stamps and audit
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'bank_accounts', 'bank_reconciliations', 'expense_categories', 'expenses'
  ]
  loop
    execute format('drop trigger if exists trg_%1$s_stamp on public.%1$I', t);
    execute format(
      'create trigger trg_%1$s_stamp before insert or update on public.%1$I
         for each row execute function public.set_row_audit_fields()', t);

    execute format('drop trigger if exists trg_%1$s_audit on public.%1$I', t);
    execute format(
      'create trigger trg_%1$s_audit after insert or update or delete on public.%1$I
         for each row execute function public.fn_audit(''finance'')', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.bank_accounts        enable row level security;
alter table public.bank_transactions    enable row level security;
alter table public.bank_reconciliations enable row level security;
alter table public.expense_categories   enable row level security;
alter table public.expenses             enable row level security;

drop policy if exists bank_accounts_select on public.bank_accounts;
create policy bank_accounts_select on public.bank_accounts
  for select to authenticated using (public.has_permission('banking.view'));

drop policy if exists bank_accounts_write on public.bank_accounts;
create policy bank_accounts_write on public.bank_accounts
  for all to authenticated
  using (public.has_permission('banking.accounts.manage'))
  with check (public.has_permission('banking.accounts.manage'));

drop policy if exists bank_txn_select on public.bank_transactions;
create policy bank_txn_select on public.bank_transactions
  for select to authenticated using (public.has_permission('banking.view'));

-- Statement lines arrive through post_bank_transaction() or from another
-- module's posting; marking one reconciled is the only client write.
drop policy if exists bank_txn_update on public.bank_transactions;
create policy bank_txn_update on public.bank_transactions
  for update to authenticated
  using (public.has_permission('banking.reconcile'))
  with check (public.has_permission('banking.reconcile'));

drop policy if exists rec_select on public.bank_reconciliations;
create policy rec_select on public.bank_reconciliations
  for select to authenticated using (public.has_permission('banking.view'));

drop policy if exists rec_write on public.bank_reconciliations;
create policy rec_write on public.bank_reconciliations
  for all to authenticated
  using (public.has_permission('banking.reconcile'))
  with check (public.has_permission('banking.reconcile'));

drop policy if exists expense_cat_select on public.expense_categories;
create policy expense_cat_select on public.expense_categories
  for select to authenticated using (public.has_permission('expenses.view'));

drop policy if exists expense_cat_write on public.expense_categories;
create policy expense_cat_write on public.expense_categories
  for all to authenticated
  using (public.has_permission('expenses.categories.manage'))
  with check (public.has_permission('expenses.categories.manage'));

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
  for select to authenticated
  using (public.has_permission('expenses.view') or created_by = auth.uid());

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses
  for insert to authenticated with check (public.has_permission('expenses.create'));

drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses
  for update to authenticated
  using (
    public.has_any_permission(array['expenses.approve', 'expenses.post'])
    or (created_by = auth.uid() and status in ('draft', 'rejected'))
  )
  with check (
    public.has_any_permission(array['expenses.approve', 'expenses.post'])
    or (created_by = auth.uid() and status in ('draft', 'submitted'))
  );

-- ---------------------------------------------------------------------
-- Starter expense categories, mapped to the chart of accounts
-- ---------------------------------------------------------------------

insert into public.expense_categories (code, name, account_id)
select c.code, c.name, a.id
from (values
  ('RENT',      'Rent',                      '6200'),
  ('UTIL',      'Utilities',                 '6300'),
  ('REPAIR',    'Repairs and maintenance',   '6400'),
  ('FUEL',      'Transport and fuel',        '6500'),
  ('BANKFEE',   'Bank charges',              '6600'),
  ('PROF',      'Professional fees',         '6700'),
  ('GENERAL',   'General expenses',          '6900'),
  ('WAGES',     'Casual wages',              '6100')
) as c(code, name, account_code)
join public.chart_of_accounts a on a.account_code = c.account_code
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Permissions
--
-- The policies above reference four codes the Phase 1 seed does not
-- have. Without these rows has_permission() returns false for everyone,
-- including super admins, and banking would be invisible to all.
-- ---------------------------------------------------------------------

insert into public.permissions (code, module, name, description) values
  ('banking.accounts.manage',    'banking',  'Manage bank accounts',
   'Add and amend bank accounts'),
  ('banking.transactions.create','banking',  'Record bank transactions',
   'Capture charges, interest and other direct movements'),
  ('banking.reconcile',          'banking',  'Reconcile bank accounts',
   'Match statement lines and finalise a reconciliation'),
  ('expenses.categories.manage', 'expenses', 'Manage expense categories',
   'Add and amend expense categories and their ledger accounts')
on conflict (code) do nothing;

-- Re-apply the existing role patterns to just these new codes.
with grants(role_code, pattern) as (values
  ('super_admin', '%'),
  ('admin', 'banking.%'), ('admin', 'expense%'),
  ('managing_director', '%.view'), ('managing_director', '%.approve'),
  ('finance_manager', 'banking.%'), ('finance_manager', 'expenses.%'),
  ('finance_manager', 'expense_categories.%'),
  ('accountant', 'banking.%'), ('accountant', 'expenses.%')
)
insert into public.role_permissions (role_id, permission_id)
select distinct r.id, p.id
from grants g
join public.roles r on r.code = g.role_code
join public.permissions p on p.code like g.pattern
where p.code in (
  'banking.accounts.manage', 'banking.transactions.create',
  'banking.reconcile', 'expenses.categories.manage'
)
on conflict (role_id, permission_id) do nothing;

-- The auditor reads and never writes; the sweep above must not have
-- given it anything, but make that explicit rather than assumed.
delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.code = 'auditor'
  and p.code in (
    'banking.accounts.manage', 'banking.transactions.create',
    'banking.reconcile', 'expenses.categories.manage'
  );
