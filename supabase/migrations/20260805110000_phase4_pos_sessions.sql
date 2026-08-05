-- =====================================================================
-- Builders Paradise ERP — Point of Sale sessions
--
-- A POS sale is a cash sales invoice. It reuses post_sales_invoice()
-- rather than having its own posting path, so a till sale and a counter
-- invoice hit stock, revenue and cost of sales identically.
--
-- What POS adds is the SHIFT: a till is opened with a float, sales are
-- attached to it, and it is closed against a physical cash count so a
-- variance is recorded rather than discovered later.
--
-- Re-runnable. Requires the sales documents migration.
-- =====================================================================

insert into public.document_sequences (doc_type, prefix) values
  ('pos_session', 'TILL')
on conflict (doc_type) do nothing;

create table if not exists public.pos_sessions (
  id             uuid primary key default gen_random_uuid(),
  session_no     text not null,
  branch_id      uuid references public.branches (id) on delete restrict,
  warehouse_id   uuid not null references public.warehouses (id) on delete restrict,

  opened_by      uuid references public.profiles (id) on delete set null,
  opened_at      timestamptz not null default now(),
  opening_float  numeric(18, 4) not null default 0,

  closed_by      uuid references public.profiles (id) on delete set null,
  closed_at      timestamptz,
  -- What the drawer actually held when counted.
  counted_cash   numeric(18, 4),
  -- Float plus cash takings, computed at close from posted invoices.
  expected_cash  numeric(18, 4),
  -- Stored rather than derived so a later correction to an invoice cannot
  -- silently rewrite what the count found on the night.
  variance       numeric(18, 4),

  status         text not null default 'open',
  notes          text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid,
  updated_by     uuid,

  constraint pos_session_no_key unique (session_no),
  constraint pos_session_status_check check (status in ('open', 'closed')),
  constraint pos_session_float_check check (opening_float >= 0)
);

create index if not exists pos_session_status_idx on public.pos_sessions (status);
create index if not exists pos_session_opened_by_idx on public.pos_sessions (opened_by);

-- One open till per person per warehouse. Two open sessions would make
-- the cash count meaningless.
create unique index if not exists pos_session_one_open
  on public.pos_sessions (opened_by, warehouse_id)
  where status = 'open';

-- Attach sales to the till they were rung up on.
alter table public.sales_invoices
  add column if not exists pos_session_id uuid references public.pos_sessions (id) on delete restrict;

create index if not exists invoice_pos_session_idx on public.sales_invoices (pos_session_id);

-- ---------------------------------------------------------------------
-- Open and close
-- ---------------------------------------------------------------------

create or replace function public.open_pos_session(
  p_warehouse_id  uuid,
  p_branch_id     uuid default null,
  p_opening_float numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.uid() is not null and not public.has_permission('pos.session.open') then
    raise exception 'Opening a till needs the "Open POS session" permission';
  end if;

  if exists (
    select 1 from public.pos_sessions
    where opened_by = auth.uid() and warehouse_id = p_warehouse_id and status = 'open'
  ) then
    raise exception 'You already have a till open at this warehouse. Close it first.';
  end if;

  insert into public.pos_sessions (
    session_no, branch_id, warehouse_id, opened_by, opening_float
  ) values (
    public.next_document_number('pos_session'),
    p_branch_id, p_warehouse_id, auth.uid(), coalesce(p_opening_float, 0)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.open_pos_session(uuid, uuid, numeric) to authenticated;

/**
 * Closes the till against a physical count.
 *
 * Expected cash is the float plus every posted CASH invoice on this
 * session. Credit sales are excluded — no money entered the drawer.
 */
create or replace function public.close_pos_session(
  p_session_id   uuid,
  p_counted_cash numeric,
  p_notes        text default null
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session  public.pos_sessions%rowtype;
  v_takings  numeric(18, 4);
  v_expected numeric(18, 4);
  v_variance numeric(18, 4);
begin
  select * into v_session from public.pos_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Till session % does not exist', p_session_id;
  end if;
  if v_session.status = 'closed' then
    raise exception 'Till % is already closed', v_session.session_no;
  end if;

  if auth.uid() is not null
     and not public.has_permission('pos.session.close')
     and v_session.opened_by is distinct from auth.uid() then
    raise exception 'Closing someone else''s till needs the "Close POS session" permission';
  end if;

  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'Enter the cash counted in the drawer';
  end if;

  select coalesce(sum(total), 0) into v_takings
  from public.sales_invoices
  where pos_session_id = p_session_id
    and payment_type = 'cash'
    and status in ('posted', 'paid', 'partially_paid');

  v_expected := round(v_session.opening_float + v_takings, 4);
  v_variance := round(p_counted_cash - v_expected, 4);

  update public.pos_sessions
     set status        = 'closed',
         closed_by     = auth.uid(),
         closed_at     = now(),
         counted_cash  = p_counted_cash,
         expected_cash = v_expected,
         variance      = v_variance,
         notes         = coalesce(p_notes, notes)
   where id = p_session_id;

  return v_variance;
end;
$$;

grant execute on function public.close_pos_session(uuid, numeric, text) to authenticated;

-- A closed till is a cash record and cannot be reopened or edited.
create or replace function public.fn_guard_closed_till()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Till sessions cannot be deleted';
  end if;
  if old.status = 'closed' then
    raise exception
      'Till % is closed. Its cash count is a record and cannot be changed.', old.session_no;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_till_closed_guard on public.pos_sessions;
create trigger trg_till_closed_guard
  before update or delete on public.pos_sessions
  for each row execute function public.fn_guard_closed_till();

drop trigger if exists trg_pos_sessions_stamp on public.pos_sessions;
create trigger trg_pos_sessions_stamp
  before insert or update on public.pos_sessions
  for each row execute function public.set_row_audit_fields();

drop trigger if exists trg_pos_sessions_audit on public.pos_sessions;
create trigger trg_pos_sessions_audit
  after insert or update on public.pos_sessions
  for each row execute function public.fn_audit('pos');

-- ---------------------------------------------------------------------
-- Cashiers must be able to complete a sale.
--
-- post_sales_invoice() required sales_invoices.post, which a cashier does
-- not hold — so a till sale would have been refused. A sale rung up on an
-- open till is posted under pos.operate instead.
-- ---------------------------------------------------------------------

create or replace function public.can_post_invoice(p_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.has_permission('sales_invoices.post')
    or exists (
      select 1
      from public.sales_invoices i
      join public.pos_sessions s on s.id = i.pos_session_id
      where i.id = p_invoice_id
        and s.status = 'open'
        and public.has_permission('pos.operate')
    );
$$;

grant execute on function public.can_post_invoice(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.pos_sessions enable row level security;

drop policy if exists pos_sessions_select on public.pos_sessions;
create policy pos_sessions_select on public.pos_sessions
  for select to authenticated
  using (
    public.has_any_permission(array['pos.sessions.view', 'pos.session.close'])
    or opened_by = auth.uid()
  );

-- Opening and closing go through the definer functions above; direct
-- writes are not a path.
drop policy if exists pos_sessions_insert on public.pos_sessions;
drop policy if exists pos_sessions_update on public.pos_sessions;
