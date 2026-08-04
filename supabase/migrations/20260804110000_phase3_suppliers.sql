-- =====================================================================
-- Builders Paradise ERP — Phase 3: suppliers
--
-- The party side of purchasing. Purchase orders, GRNs, supplier invoices
-- and payments all hang off this table.
--
-- Re-runnable; nothing is dropped or truncated.
-- =====================================================================

create table if not exists public.suppliers (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null,
  name                text not null,
  trading_name        text,

  contact_person      text,
  phone               text,
  email               citext,
  website             text,

  address_line1       text,
  address_line2       text,
  city                text,
  country             text not null default 'Zimbabwe',

  tax_number          text,
  registration_number text,

  -- Trading terms
  currency_code       char(3) not null default 'USD',
  payment_terms_days  integer not null default 30,
  credit_limit        numeric(18, 4),

  -- The balance carried in when the supplier was loaded onto the system.
  -- Live balance is opening_balance plus posted invoices less payments,
  -- computed by the payables module — never stored as a mutable total.
  opening_balance     numeric(18, 4) not null default 0,

  -- Banking, for preparing payments
  bank_name           text,
  bank_account_name   text,
  bank_account_number text,
  bank_branch         text,
  swift_code          text,

  status              text not null default 'active',
  notes               text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid,
  updated_by          uuid,

  constraint suppliers_code_key unique (code),
  constraint suppliers_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,15}$'),
  -- 'blocked' stops new orders without hiding history, which is what you
  -- want for a supplier in dispute.
  constraint suppliers_status_check check (status in ('active', 'inactive', 'blocked')),
  constraint suppliers_terms_check check (payment_terms_days >= 0 and payment_terms_days <= 365),
  constraint suppliers_credit_check check (credit_limit is null or credit_limit >= 0)
);

create index if not exists suppliers_status_idx on public.suppliers (status);
create index if not exists suppliers_name_idx on public.suppliers (lower(name));

-- The catalogue reserved this column in Phase 2; wire it up now that the
-- table it points at exists.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_default_supplier_fk'
  ) then
    alter table public.products
      add constraint products_default_supplier_fk
      foreign key (default_supplier_id) references public.suppliers (id) on delete set null;
  end if;
end;
$$;

create index if not exists products_supplier_idx on public.products (default_supplier_id);

-- ---------------------------------------------------------------------
-- Row stamps and audit
-- ---------------------------------------------------------------------

drop trigger if exists trg_suppliers_stamp on public.suppliers;
create trigger trg_suppliers_stamp
  before insert or update on public.suppliers
  for each row execute function public.set_row_audit_fields();

drop trigger if exists trg_suppliers_audit on public.suppliers;
create trigger trg_suppliers_audit
  after insert or update or delete on public.suppliers
  for each row execute function public.fn_audit('purchasing');

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.suppliers enable row level security;

drop policy if exists suppliers_select on public.suppliers;
create policy suppliers_select on public.suppliers
  for select to authenticated
  using (public.has_permission('suppliers.view'));

drop policy if exists suppliers_insert on public.suppliers;
create policy suppliers_insert on public.suppliers
  for insert to authenticated
  with check (public.has_permission('suppliers.create'));

drop policy if exists suppliers_update on public.suppliers;
create policy suppliers_update on public.suppliers
  for update to authenticated
  using (public.has_permission('suppliers.update'))
  with check (public.has_permission('suppliers.update'));

-- No delete policy: suppliers are archived, never deleted, because orders,
-- receipts and payments reference them permanently.

-- ---------------------------------------------------------------------
-- Bank details are sensitive: they are what a payment is made against.
-- Mask them for users who can see suppliers but may not pay them.
-- ---------------------------------------------------------------------

create or replace view public.suppliers_directory
with (security_invoker = true)
as
select
  s.id,
  s.code,
  s.name,
  s.trading_name,
  s.contact_person,
  s.phone,
  s.email,
  s.website,
  s.address_line1,
  s.address_line2,
  s.city,
  s.country,
  s.tax_number,
  s.registration_number,
  s.currency_code,
  s.payment_terms_days,
  s.credit_limit,
  s.opening_balance,
  s.status,
  s.notes,
  s.created_at,
  s.updated_at,
  -- Null rather than blank, so a hidden account number cannot be mistaken
  -- for an empty one.
  case when public.has_any_permission(array['supplier_payments.create', 'supplier_payments.approve'])
       then s.bank_name end            as bank_name,
  case when public.has_any_permission(array['supplier_payments.create', 'supplier_payments.approve'])
       then s.bank_account_name end    as bank_account_name,
  case when public.has_any_permission(array['supplier_payments.create', 'supplier_payments.approve'])
       then s.bank_account_number end  as bank_account_number,
  case when public.has_any_permission(array['supplier_payments.create', 'supplier_payments.approve'])
       then s.bank_branch end          as bank_branch,
  case when public.has_any_permission(array['supplier_payments.create', 'supplier_payments.approve'])
       then s.swift_code end           as swift_code
from public.suppliers s;

grant select on public.suppliers_directory to authenticated;
