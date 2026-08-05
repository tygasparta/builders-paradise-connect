-- =====================================================================
-- Builders Paradise ERP — Customers
--
-- The party side of selling. Quotations, invoices, receipts, returns and
-- credit notes all hang off this table.
--
-- Re-runnable; nothing is dropped or truncated.
-- =====================================================================

create table if not exists public.customers (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null,
  name                text not null,
  trading_name        text,
  customer_type       text not null default 'retail',

  contact_person      text,
  phone               text,
  email               citext,

  address_line1       text,
  address_line2       text,
  city                text,
  country             text not null default 'Zimbabwe',

  tax_number          text,
  registration_number text,

  currency_code       char(3) not null default 'USD',
  payment_terms_days  integer not null default 0,
  -- Null means no credit: the customer pays at the till. Zero means an
  -- account exists but is currently blocked from further credit.
  credit_limit        numeric(18, 4),
  opening_balance     numeric(18, 4) not null default 0,

  salesperson_id      uuid references public.profiles (id) on delete set null,
  branch_id           uuid references public.branches (id) on delete set null,

  status              text not null default 'active',
  notes               text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid,
  updated_by          uuid,

  constraint customers_code_key unique (code),
  constraint customers_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,15}$'),
  constraint customers_type_check check (
    customer_type in ('retail', 'trade', 'contractor', 'government', 'internal')
  ),
  constraint customers_status_check check (status in ('active', 'inactive', 'on_hold')),
  constraint customers_terms_check check (payment_terms_days >= 0 and payment_terms_days <= 365),
  constraint customers_credit_check check (credit_limit is null or credit_limit >= 0)
);

create index if not exists customers_status_idx on public.customers (status);
create index if not exists customers_name_idx on public.customers (lower(name));
create index if not exists customers_salesperson_idx on public.customers (salesperson_id);

drop trigger if exists trg_customers_stamp on public.customers;
create trigger trg_customers_stamp
  before insert or update on public.customers
  for each row execute function public.set_row_audit_fields();

drop trigger if exists trg_customers_audit on public.customers;
create trigger trg_customers_audit
  after insert or update or delete on public.customers
  for each row execute function public.fn_audit('sales');

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.customers enable row level security;

drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers
  for select to authenticated
  using (public.has_permission('customers.view'));

drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers
  for insert to authenticated
  with check (public.has_permission('customers.create'));

drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers
  for update to authenticated
  using (public.has_permission('customers.update'))
  with check (public.has_permission('customers.update'));

-- No delete policy: invoices reference customers permanently.

-- Setting a credit limit is its own authority, separate from editing a
-- customer's name or phone number.
create or replace function public.fn_guard_customer_credit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if (new.credit_limit is distinct from old.credit_limit
      or new.payment_terms_days is distinct from old.payment_terms_days)
     and not public.has_permission('customers.credit_limit.manage') then
    raise exception
      'Changing a credit limit or payment terms needs the "Manage credit limits" permission';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_customers_credit_guard on public.customers;
create trigger trg_customers_credit_guard
  before update on public.customers
  for each row execute function public.fn_guard_customer_credit();
