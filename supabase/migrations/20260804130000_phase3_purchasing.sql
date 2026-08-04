-- =====================================================================
-- Builders Paradise ERP — Purchasing document chain
--
--   Requisition → approval → Purchase Order → Goods Received Note
--
-- The GRN is the point where a document becomes stock and a liability.
-- post_goods_received_note() does all of it in one transaction: stock
-- movements, the Dr Inventory / Cr Accounts Payable journal, the PO
-- received quantities and the GRN status. Either everything lands or
-- nothing does.
--
-- Re-runnable. Requires Phases 1-3 and the accounting core.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Document numbering
--
-- One row per document type, incremented under a row lock so two users
-- pressing Save at the same instant cannot take the same number.
-- ---------------------------------------------------------------------

create table if not exists public.document_sequences (
  doc_type    text primary key,
  prefix      text not null,
  next_number bigint not null default 1,
  padding     integer not null default 5,
  updated_at  timestamptz not null default now(),
  constraint doc_seq_padding_check check (padding between 3 and 10),
  constraint doc_seq_next_check check (next_number > 0)
);

insert into public.document_sequences (doc_type, prefix) values
  ('purchase_requisition', 'REQ'),
  ('purchase_order',       'PO'),
  ('goods_received_note',  'GRN'),
  ('supplier_invoice',     'SINV'),
  ('supplier_payment',     'SPAY'),
  ('stock_adjustment',     'ADJ'),
  ('journal',              'JNL')
on conflict (doc_type) do nothing;

create or replace function public.next_document_number(p_doc_type text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_seq public.document_sequences%rowtype;
begin
  -- FOR UPDATE: two concurrent callers queue rather than collide.
  select * into v_seq from public.document_sequences
  where doc_type = p_doc_type
  for update;

  if not found then
    raise exception 'No document sequence configured for "%"', p_doc_type;
  end if;

  update public.document_sequences
     set next_number = next_number + 1, updated_at = now()
   where doc_type = p_doc_type;

  return v_seq.prefix || '-' || lpad(v_seq.next_number::text, v_seq.padding, '0');
end;
$$;

grant execute on function public.next_document_number(text) to authenticated;

-- ---------------------------------------------------------------------
-- Purchase requisitions
-- ---------------------------------------------------------------------

create table if not exists public.purchase_requisitions (
  id              uuid primary key default gen_random_uuid(),
  requisition_no  text not null,
  branch_id       uuid references public.branches (id) on delete restrict,
  warehouse_id    uuid references public.warehouses (id) on delete restrict,
  requested_by    uuid references public.profiles (id) on delete set null,
  department      text,
  required_date   date,
  reason          text,
  notes           text,

  status          text not null default 'draft',
  submitted_at    timestamptz,
  approved_by     uuid references public.profiles (id) on delete set null,
  approved_at     timestamptz,
  rejected_reason text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid,
  updated_by      uuid,

  constraint pr_no_key unique (requisition_no),
  constraint pr_status_check check (
    status in ('draft', 'submitted', 'approved', 'rejected', 'converted', 'cancelled')
  )
);

create index if not exists pr_status_idx on public.purchase_requisitions (status);
create index if not exists pr_branch_idx on public.purchase_requisitions (branch_id);

create table if not exists public.purchase_requisition_lines (
  id                   uuid primary key default gen_random_uuid(),
  requisition_id       uuid not null references public.purchase_requisitions (id) on delete cascade,
  line_no              integer not null,
  product_id           uuid not null references public.products (id) on delete restrict,
  quantity             numeric(18, 4) not null,
  estimated_unit_price numeric(18, 4) not null default 0,
  notes                text,
  created_at           timestamptz not null default now(),

  constraint prl_line_key unique (requisition_id, line_no),
  constraint prl_quantity_check check (quantity > 0),
  constraint prl_price_check check (estimated_unit_price >= 0)
);

create index if not exists prl_requisition_idx on public.purchase_requisition_lines (requisition_id);

-- ---------------------------------------------------------------------
-- Purchase orders
-- ---------------------------------------------------------------------

create table if not exists public.purchase_orders (
  id                 uuid primary key default gen_random_uuid(),
  po_no              text not null,
  supplier_id        uuid not null references public.suppliers (id) on delete restrict,
  requisition_id     uuid references public.purchase_requisitions (id) on delete set null,
  branch_id          uuid references public.branches (id) on delete restrict,
  warehouse_id       uuid not null references public.warehouses (id) on delete restrict,

  order_date         date not null default current_date,
  expected_date      date,
  quotation_ref      text,
  payment_terms_days integer not null default 30,
  currency_code      char(3) not null default 'USD',

  subtotal           numeric(18, 4) not null default 0,
  discount_total     numeric(18, 4) not null default 0,
  tax_total          numeric(18, 4) not null default 0,
  total              numeric(18, 4) not null default 0,

  status             text not null default 'draft',
  approved_by        uuid references public.profiles (id) on delete set null,
  approved_at        timestamptz,
  cancelled_reason   text,
  notes              text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid,
  updated_by         uuid,

  constraint po_no_key unique (po_no),
  constraint po_status_check check (
    status in ('draft', 'pending_approval', 'approved', 'partially_received',
               'received', 'cancelled', 'closed')
  ),
  constraint po_totals_check check (subtotal >= 0 and tax_total >= 0 and total >= 0)
);

create index if not exists po_supplier_idx on public.purchase_orders (supplier_id);
create index if not exists po_status_idx on public.purchase_orders (status);
create index if not exists po_date_idx on public.purchase_orders (order_date desc);

create table if not exists public.purchase_order_lines (
  id                uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  line_no           integer not null,
  product_id        uuid not null references public.products (id) on delete restrict,
  description       text,
  quantity_ordered  numeric(18, 4) not null,
  -- Maintained by the GRN posting service, never by the client.
  quantity_received numeric(18, 4) not null default 0,
  unit_price        numeric(18, 4) not null,
  discount_percent  numeric(7, 4) not null default 0,
  tax_rate          numeric(7, 4) not null default 0,
  line_total        numeric(18, 4) not null default 0,
  created_at        timestamptz not null default now(),

  constraint pol_line_key unique (purchase_order_id, line_no),
  constraint pol_quantity_check check (quantity_ordered > 0),
  constraint pol_received_check check (quantity_received >= 0),
  constraint pol_price_check check (unit_price >= 0),
  constraint pol_discount_check check (discount_percent >= 0 and discount_percent <= 100)
);

create index if not exists pol_po_idx on public.purchase_order_lines (purchase_order_id);
create index if not exists pol_product_idx on public.purchase_order_lines (product_id);

-- A blocked supplier must not receive new orders.
create or replace function public.fn_guard_po_supplier()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from public.suppliers where id = new.supplier_id;
  if v_status = 'blocked' then
    raise exception 'This supplier is blocked — no new purchase orders can be raised against them';
  end if;
  if v_status = 'inactive' and new.status <> 'cancelled' then
    raise exception 'This supplier is archived. Reactivate them before ordering.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_po_supplier_guard on public.purchase_orders;
create trigger trg_po_supplier_guard
  before insert on public.purchase_orders
  for each row execute function public.fn_guard_po_supplier();

-- ---------------------------------------------------------------------
-- Goods received notes
-- ---------------------------------------------------------------------

create table if not exists public.goods_received_notes (
  id                  uuid primary key default gen_random_uuid(),
  grn_no              text not null,
  purchase_order_id   uuid references public.purchase_orders (id) on delete restrict,
  supplier_id         uuid not null references public.suppliers (id) on delete restrict,
  warehouse_id        uuid not null references public.warehouses (id) on delete restrict,
  branch_id           uuid references public.branches (id) on delete restrict,

  delivery_note_ref   text,
  received_date       date not null default current_date,
  received_by         uuid references public.profiles (id) on delete set null,
  inspected_by        uuid references public.profiles (id) on delete set null,
  inspection_notes    text,
  approved_by         uuid references public.profiles (id) on delete set null,
  approved_at         timestamptz,

  status              text not null default 'draft',
  posted_at           timestamptz,
  posted_by           uuid references public.profiles (id) on delete set null,
  -- Set by the posting service; the audit link from stock to the ledger.
  journal_entry_id    uuid references public.journal_entries (id) on delete restrict,
  total_cost          numeric(18, 4) not null default 0,
  notes               text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid,
  updated_by          uuid,

  constraint grn_no_key unique (grn_no),
  constraint grn_status_check check (
    status in ('draft', 'inspected', 'approved', 'posted', 'cancelled')
  )
);

create index if not exists grn_supplier_idx on public.goods_received_notes (supplier_id);
create index if not exists grn_po_idx on public.goods_received_notes (purchase_order_id);
create index if not exists grn_status_idx on public.goods_received_notes (status);
create index if not exists grn_date_idx on public.goods_received_notes (received_date desc);

create table if not exists public.goods_received_note_lines (
  id                   uuid primary key default gen_random_uuid(),
  grn_id               uuid not null references public.goods_received_notes (id) on delete cascade,
  line_no              integer not null,
  purchase_order_line_id uuid references public.purchase_order_lines (id) on delete set null,
  product_id           uuid not null references public.products (id) on delete restrict,

  quantity_ordered     numeric(18, 4) not null default 0,
  quantity_delivered   numeric(18, 4) not null,
  quantity_accepted    numeric(18, 4) not null default 0,
  quantity_rejected    numeric(18, 4) not null default 0,

  unit_cost            numeric(18, 6) not null,
  rejection_reason     text,
  notes                text,
  created_at           timestamptz not null default now(),

  constraint grnl_line_key unique (grn_id, line_no),
  constraint grnl_delivered_check check (quantity_delivered >= 0),
  constraint grnl_accepted_check check (quantity_accepted >= 0),
  constraint grnl_rejected_check check (quantity_rejected >= 0),
  constraint grnl_cost_check check (unit_cost >= 0),
  -- What was inspected must equal what arrived. This is the line that
  -- stops stock quietly appearing or vanishing during inspection.
  constraint grnl_split_check check (quantity_accepted + quantity_rejected = quantity_delivered),
  -- A rejection needs a reason, on the document, at the time.
  constraint grnl_rejection_reason_check check (
    quantity_rejected = 0 or (rejection_reason is not null and length(trim(rejection_reason)) > 0)
  )
);

create index if not exists grnl_grn_idx on public.goods_received_note_lines (grn_id);
create index if not exists grnl_product_idx on public.goods_received_note_lines (product_id);

-- A posted GRN is a historical record and cannot be edited or unposted.
create or replace function public.fn_guard_posted_grn()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'posted' then
      raise exception
        'GRN % is posted and cannot be deleted. Raise a supplier return instead.', old.grn_no;
    end if;
    return old;
  end if;

  if old.status = 'posted' then
    raise exception
      'GRN % is posted. Stock and the ledger have already moved — raise a supplier return instead.',
      old.grn_no;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_grn_posted_guard on public.goods_received_notes;
create trigger trg_grn_posted_guard
  before update or delete on public.goods_received_notes
  for each row execute function public.fn_guard_posted_grn();

create or replace function public.fn_guard_posted_grn_lines()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_grn uuid;
begin
  v_grn := coalesce(new.grn_id, old.grn_id);
  select status into v_status from public.goods_received_notes where id = v_grn;
  if v_status = 'posted' then
    raise exception 'The lines of a posted GRN cannot be changed';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_grn_lines_guard on public.goods_received_note_lines;
create trigger trg_grn_lines_guard
  before insert or update or delete on public.goods_received_note_lines
  for each row execute function public.fn_guard_posted_grn_lines();

-- ---------------------------------------------------------------------
-- Row stamps and audit
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'purchase_requisitions', 'purchase_orders', 'goods_received_notes'
  ]
  loop
    execute format('drop trigger if exists trg_%1$s_stamp on public.%1$I', t);
    execute format(
      'create trigger trg_%1$s_stamp before insert or update on public.%1$I
         for each row execute function public.set_row_audit_fields()', t);

    execute format('drop trigger if exists trg_%1$s_audit on public.%1$I', t);
    execute format(
      'create trigger trg_%1$s_audit after insert or update or delete on public.%1$I
         for each row execute function public.fn_audit(''purchasing'')', t);
  end loop;
end;
$$;
