-- =====================================================================
-- Builders Paradise ERP — Sales documents
--
--   Quotation → Invoice → Receipt
--                      ↘ Return / Credit note
--
-- Re-runnable. Requires customers, products, inventory and the
-- accounting core.
-- =====================================================================

insert into public.document_sequences (doc_type, prefix) values
  ('sales_quotation', 'QTE'),
  ('sales_invoice',   'INV'),
  ('sales_return',    'CRN'),
  ('customer_receipt','RCT')
on conflict (doc_type) do nothing;

-- ---------------------------------------------------------------------
-- Quotations
-- ---------------------------------------------------------------------

create table if not exists public.sales_quotations (
  id             uuid primary key default gen_random_uuid(),
  quotation_no   text not null,
  customer_id    uuid references public.customers (id) on delete restrict,
  -- A quote can be given to a walk-in who has no account yet.
  customer_name  text,
  branch_id      uuid references public.branches (id) on delete set null,
  warehouse_id   uuid references public.warehouses (id) on delete set null,
  salesperson_id uuid references public.profiles (id) on delete set null,

  quotation_date date not null default current_date,
  valid_until    date,
  currency_code  char(3) not null default 'USD',

  subtotal       numeric(18, 4) not null default 0,
  discount_total numeric(18, 4) not null default 0,
  tax_total      numeric(18, 4) not null default 0,
  total          numeric(18, 4) not null default 0,

  status         text not null default 'draft',
  converted_invoice_id uuid,
  notes          text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid,
  updated_by     uuid,

  constraint quote_no_key unique (quotation_no),
  constraint quote_status_check check (
    status in ('draft', 'sent', 'accepted', 'declined', 'expired', 'converted', 'cancelled')
  ),
  constraint quote_party_check check (customer_id is not null or customer_name is not null)
);

create index if not exists quote_customer_idx on public.sales_quotations (customer_id);
create index if not exists quote_status_idx on public.sales_quotations (status);

create table if not exists public.sales_quotation_lines (
  id               uuid primary key default gen_random_uuid(),
  quotation_id     uuid not null references public.sales_quotations (id) on delete cascade,
  line_no          integer not null,
  product_id       uuid not null references public.products (id) on delete restrict,
  description      text,
  quantity         numeric(18, 4) not null,
  unit_price       numeric(18, 4) not null,
  discount_percent numeric(7, 4) not null default 0,
  tax_rate         numeric(7, 4) not null default 0,
  line_total       numeric(18, 4) not null default 0,
  created_at       timestamptz not null default now(),

  constraint sql_line_key unique (quotation_id, line_no),
  constraint sql_quantity_check check (quantity > 0),
  constraint sql_price_check check (unit_price >= 0),
  constraint sql_discount_check check (discount_percent >= 0 and discount_percent <= 100)
);

create index if not exists sql_quotation_idx on public.sales_quotation_lines (quotation_id);

-- ---------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------

create table if not exists public.sales_invoices (
  id             uuid primary key default gen_random_uuid(),
  invoice_no     text not null,
  customer_id    uuid references public.customers (id) on delete restrict,
  customer_name  text,
  quotation_id   uuid references public.sales_quotations (id) on delete set null,
  branch_id      uuid references public.branches (id) on delete set null,
  warehouse_id   uuid not null references public.warehouses (id) on delete restrict,
  salesperson_id uuid references public.profiles (id) on delete set null,

  invoice_date   date not null default current_date,
  due_date       date,
  currency_code  char(3) not null default 'USD',

  -- 'cash' settles immediately; 'credit' creates a receivable.
  payment_type   text not null default 'cash',

  subtotal       numeric(18, 4) not null default 0,
  discount_total numeric(18, 4) not null default 0,
  tax_total      numeric(18, 4) not null default 0,
  total          numeric(18, 4) not null default 0,
  amount_paid    numeric(18, 4) not null default 0,
  -- Set by the posting service from the actual weighted average at the
  -- moment of sale, which is what makes gross profit real.
  cost_of_sales  numeric(18, 4) not null default 0,

  status         text not null default 'draft',
  posted_at      timestamptz,
  posted_by      uuid references public.profiles (id) on delete set null,
  journal_entry_id uuid references public.journal_entries (id) on delete restrict,
  cancelled_reason text,
  notes          text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid,
  updated_by     uuid,

  constraint invoice_no_key unique (invoice_no),
  constraint invoice_status_check check (
    status in ('draft', 'awaiting_approval', 'approved', 'posted',
               'partially_paid', 'paid', 'overdue', 'cancelled')
  ),
  constraint invoice_payment_type_check check (payment_type in ('cash', 'credit')),
  constraint invoice_totals_check check (total >= 0 and amount_paid >= 0),
  constraint invoice_party_check check (customer_id is not null or customer_name is not null),
  -- A credit sale must be to a named account; you cannot extend credit to
  -- "walk-in customer".
  constraint invoice_credit_needs_customer check (
    payment_type = 'cash' or customer_id is not null
  )
);

create index if not exists invoice_customer_idx on public.sales_invoices (customer_id);
create index if not exists invoice_status_idx on public.sales_invoices (status);
create index if not exists invoice_date_idx on public.sales_invoices (invoice_date desc);
create index if not exists invoice_salesperson_idx on public.sales_invoices (salesperson_id);

create table if not exists public.sales_invoice_lines (
  id               uuid primary key default gen_random_uuid(),
  invoice_id       uuid not null references public.sales_invoices (id) on delete cascade,
  line_no          integer not null,
  product_id       uuid not null references public.products (id) on delete restrict,
  description      text,
  quantity         numeric(18, 4) not null,
  unit_price       numeric(18, 4) not null,
  discount_percent numeric(7, 4) not null default 0,
  tax_rate         numeric(7, 4) not null default 0,
  line_total       numeric(18, 4) not null default 0,
  -- Written by the posting service, not the client.
  unit_cost        numeric(18, 6) not null default 0,
  line_cost        numeric(18, 4) not null default 0,
  created_at       timestamptz not null default now(),

  constraint sil_line_key unique (invoice_id, line_no),
  constraint sil_quantity_check check (quantity > 0),
  constraint sil_price_check check (unit_price >= 0),
  constraint sil_discount_check check (discount_percent >= 0 and discount_percent <= 100)
);

create index if not exists sil_invoice_idx on public.sales_invoice_lines (invoice_id);
create index if not exists sil_product_idx on public.sales_invoice_lines (product_id);

-- ---------------------------------------------------------------------
-- Returns / credit notes
-- ---------------------------------------------------------------------

create table if not exists public.sales_returns (
  id            uuid primary key default gen_random_uuid(),
  return_no     text not null,
  invoice_id    uuid references public.sales_invoices (id) on delete restrict,
  customer_id   uuid references public.customers (id) on delete restrict,
  customer_name text,
  branch_id     uuid references public.branches (id) on delete set null,
  warehouse_id  uuid not null references public.warehouses (id) on delete restrict,

  return_date   date not null default current_date,
  reason        text not null,
  -- Returned goods do not always go back on the shelf.
  restock       boolean not null default true,

  subtotal      numeric(18, 4) not null default 0,
  tax_total     numeric(18, 4) not null default 0,
  total         numeric(18, 4) not null default 0,
  cost_of_sales numeric(18, 4) not null default 0,

  status        text not null default 'draft',
  posted_at     timestamptz,
  posted_by     uuid references public.profiles (id) on delete set null,
  journal_entry_id uuid references public.journal_entries (id) on delete restrict,
  notes         text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid,

  constraint return_no_key unique (return_no),
  constraint return_status_check check (
    status in ('draft', 'approved', 'posted', 'cancelled')
  )
);

create index if not exists return_invoice_idx on public.sales_returns (invoice_id);
create index if not exists return_customer_idx on public.sales_returns (customer_id);
create index if not exists return_status_idx on public.sales_returns (status);

create table if not exists public.sales_return_lines (
  id                    uuid primary key default gen_random_uuid(),
  return_id             uuid not null references public.sales_returns (id) on delete cascade,
  line_no               integer not null,
  invoice_line_id       uuid references public.sales_invoice_lines (id) on delete set null,
  product_id            uuid not null references public.products (id) on delete restrict,
  quantity              numeric(18, 4) not null,
  unit_price            numeric(18, 4) not null,
  tax_rate              numeric(7, 4) not null default 0,
  line_total            numeric(18, 4) not null default 0,
  unit_cost             numeric(18, 6) not null default 0,
  line_cost             numeric(18, 4) not null default 0,
  created_at            timestamptz not null default now(),

  constraint srl_line_key unique (return_id, line_no),
  constraint srl_quantity_check check (quantity > 0)
);

create index if not exists srl_return_idx on public.sales_return_lines (return_id);

-- ---------------------------------------------------------------------
-- Customer receipts
-- ---------------------------------------------------------------------

create table if not exists public.customer_receipts (
  id             uuid primary key default gen_random_uuid(),
  receipt_no     text not null,
  customer_id    uuid not null references public.customers (id) on delete restrict,
  branch_id      uuid references public.branches (id) on delete set null,
  receipt_date   date not null default current_date,
  payment_method text not null default 'cash',
  reference      text,
  amount         numeric(18, 4) not null,
  -- Amount not yet applied to a specific invoice.
  unallocated    numeric(18, 4) not null default 0,
  received_by    uuid references public.profiles (id) on delete set null,
  status         text not null default 'draft',
  posted_at      timestamptz,
  journal_entry_id uuid references public.journal_entries (id) on delete restrict,
  notes          text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid,
  updated_by     uuid,

  constraint receipt_no_key unique (receipt_no),
  constraint receipt_amount_check check (amount > 0),
  constraint receipt_status_check check (status in ('draft', 'posted', 'cancelled')),
  constraint receipt_method_check check (
    payment_method in ('cash', 'bank_transfer', 'eft', 'cheque', 'card', 'mobile_money')
  )
);

create index if not exists receipt_customer_idx on public.customer_receipts (customer_id);
create index if not exists receipt_status_idx on public.customer_receipts (status);

create table if not exists public.customer_receipt_allocations (
  id          uuid primary key default gen_random_uuid(),
  receipt_id  uuid not null references public.customer_receipts (id) on delete cascade,
  invoice_id  uuid not null references public.sales_invoices (id) on delete restrict,
  amount      numeric(18, 4) not null,
  created_at  timestamptz not null default now(),
  constraint alloc_key unique (receipt_id, invoice_id),
  constraint alloc_amount_check check (amount > 0)
);

create index if not exists alloc_invoice_idx on public.customer_receipt_allocations (invoice_id);

-- ---------------------------------------------------------------------
-- Posted documents are immutable
-- ---------------------------------------------------------------------

create or replace function public.fn_guard_posted_sales_doc()
returns trigger
language plpgsql
as $$
declare
  v_label text := tg_argv[0];
begin
  if tg_op = 'DELETE' then
    if old.status = 'posted' then
      raise exception
        'This % is posted and cannot be deleted. Raise a credit note instead.', v_label;
    end if;
    return old;
  end if;

  -- Settlement moves an invoice between posted, partially paid, paid and
  -- overdue. Those are allowed; the figures are not.
  if old.status in ('posted', 'partially_paid', 'paid', 'overdue') then
    if new.total is distinct from old.total
       or new.subtotal is distinct from old.subtotal
       or new.tax_total is distinct from old.tax_total
       or new.customer_id is distinct from old.customer_id
       or new.invoice_date is distinct from old.invoice_date then
      raise exception
        'A posted % cannot be edited. Raise a credit note or a reversal instead.', v_label;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoice_posted_guard on public.sales_invoices;
create trigger trg_invoice_posted_guard
  before update or delete on public.sales_invoices
  for each row execute function public.fn_guard_posted_sales_doc('invoice');

create or replace function public.fn_guard_posted_sales_lines()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_id uuid;
begin
  v_id := coalesce(new.invoice_id, old.invoice_id);
  select status into v_status from public.sales_invoices where id = v_id;
  if v_status in ('posted', 'partially_paid', 'paid', 'overdue') then
    raise exception 'The lines of a posted invoice cannot be changed';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_invoice_lines_guard on public.sales_invoice_lines;
create trigger trg_invoice_lines_guard
  before insert or update or delete on public.sales_invoice_lines
  for each row execute function public.fn_guard_posted_sales_lines();

-- ---------------------------------------------------------------------
-- Row stamps and audit
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'sales_quotations', 'sales_invoices', 'sales_returns', 'customer_receipts'
  ]
  loop
    execute format('drop trigger if exists trg_%1$s_stamp on public.%1$I', t);
    execute format(
      'create trigger trg_%1$s_stamp before insert or update on public.%1$I
         for each row execute function public.set_row_audit_fields()', t);

    execute format('drop trigger if exists trg_%1$s_audit on public.%1$I', t);
    execute format(
      'create trigger trg_%1$s_audit after insert or update or delete on public.%1$I
         for each row execute function public.fn_audit(''sales'')', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Live balance
--
-- Never stored as a mutable total. It is the opening balance plus what
-- has been invoiced, less what has been received and credited — derived
-- from the documents every time it is asked for.
-- ---------------------------------------------------------------------

create or replace function public.customer_balance(p_customer_id uuid)
returns numeric
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(c.opening_balance, 0)
       + coalesce((
           select sum(i.total)
           from public.sales_invoices i
           where i.customer_id = c.id
             and i.status in ('posted', 'partially_paid', 'paid', 'overdue')
         ), 0)
       - coalesce((
           select sum(r.total)
           from public.sales_returns r
           where r.customer_id = c.id and r.status = 'posted'
         ), 0)
       - coalesce((
           select sum(p.amount)
           from public.customer_receipts p
           where p.customer_id = c.id and p.status = 'posted'
         ), 0)
  from public.customers c
  where c.id = p_customer_id;
$$;

grant execute on function public.customer_balance(uuid) to authenticated;
