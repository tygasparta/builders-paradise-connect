-- =====================================================================
-- Builders Paradise ERP — GRN posting service and purchasing RLS
--
-- post_goods_received_note() is the first place a document turns into
-- both stock and money. In ONE transaction it:
--
--   1. increases stock through post_inventory_movement(), at the GRN's
--      cost, which recomputes the weighted average per warehouse
--   2. posts Dr Inventory / Cr Accounts Payable for the accepted value
--   3. updates the purchase order's received quantities and status
--   4. marks the GRN posted and links it to its journal
--
-- If any step raises, the whole thing rolls back. Stock and the ledger
-- cannot disagree, because there is no path where one happens without
-- the other.
-- =====================================================================

create or replace function public.post_goods_received_note(p_grn_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_grn        public.goods_received_notes%rowtype;
  v_line       record;
  v_total      numeric(18, 4) := 0;
  v_journal_id uuid;
  v_reference  text;
  v_accepted   integer := 0;
  v_po_open    numeric;
begin
  ------------------------------------------------------------------
  -- Validate
  ------------------------------------------------------------------
  select * into v_grn from public.goods_received_notes where id = p_grn_id for update;
  if not found then
    raise exception 'Goods received note % does not exist', p_grn_id;
  end if;

  if v_grn.status = 'posted' then
    raise exception 'GRN % has already been posted', v_grn.grn_no;
  end if;
  if v_grn.status = 'cancelled' then
    raise exception 'GRN % was cancelled and cannot be posted', v_grn.grn_no;
  end if;
  if v_grn.status <> 'approved' then
    raise exception
      'GRN % must be approved before it can be posted (it is currently %)',
      v_grn.grn_no, v_grn.status;
  end if;

  -- Posting is a financial act; it needs the permission in its own right.
  if auth.uid() is not null and not public.has_permission('grn.post') then
    raise exception 'Posting a goods received note needs the "Post GRNs" permission';
  end if;

  select count(*) into v_accepted
  from public.goods_received_note_lines
  where grn_id = p_grn_id and quantity_accepted > 0;

  if v_accepted = 0 then
    raise exception
      'GRN % has nothing accepted. Post a GRN only when at least one line was accepted.',
      v_grn.grn_no;
  end if;

  ------------------------------------------------------------------
  -- 1. Stock, line by line, through the one costing engine.
  ------------------------------------------------------------------
  for v_line in
    select * from public.goods_received_note_lines
    where grn_id = p_grn_id and quantity_accepted > 0
    order by line_no
  loop
    perform public.post_inventory_movement(
      p_product_id             => v_line.product_id,
      p_warehouse_id           => v_grn.warehouse_id,
      p_movement_type          => 'goods_receipt',
      p_quantity               => v_line.quantity_accepted,
      p_unit_cost              => v_line.unit_cost,
      p_source_module          => 'purchasing',
      p_source_document_type   => 'GRN',
      p_source_document_id     => v_grn.id,
      p_source_document_number => v_grn.grn_no,
      p_movement_date          => v_grn.received_date,
      p_reason                 => null,
      p_notes                  => v_line.notes
    );

    v_total := v_total + round(v_line.quantity_accepted * v_line.unit_cost, 4);

    ----------------------------------------------------------------
    -- 3a. Roll the received quantity onto the purchase order line.
    ----------------------------------------------------------------
    if v_line.purchase_order_line_id is not null then
      update public.purchase_order_lines
         set quantity_received = quantity_received + v_line.quantity_accepted
       where id = v_line.purchase_order_line_id;
    end if;
  end loop;

  if v_total <= 0 then
    raise exception
      'GRN % has no value to post. Every accepted line is costed at zero.', v_grn.grn_no;
  end if;

  ------------------------------------------------------------------
  -- 2. The accounting leg.
  --    Dr 1300 Inventory        (asset increases)
  --    Cr 2100 Accounts Payable (liability increases)
  --    At cost, per the requirements: stock is never brought in at
  --    selling price.
  ------------------------------------------------------------------
  v_reference := 'JNL-' || v_grn.grn_no;

  v_journal_id := public.post_journal_entry(
    p_reference              => v_reference,
    p_description            => 'Goods received — ' || v_grn.grn_no,
    p_lines                  => jsonb_build_array(
      jsonb_build_object(
        'account_code', '1300',
        'debit', v_total,
        'credit', 0,
        'description', 'Stock received on ' || v_grn.grn_no
      ),
      jsonb_build_object(
        'account_code', '2100',
        'debit', 0,
        'credit', v_total,
        'description', 'Owed to supplier for ' || v_grn.grn_no,
        'supplier_id', v_grn.supplier_id
      )
    ),
    p_journal_date           => v_grn.received_date,
    p_source_module          => 'purchasing',
    p_source_document_type   => 'GRN',
    p_source_document_id     => v_grn.id,
    p_source_document_number => v_grn.grn_no,
    p_branch_id              => v_grn.branch_id,
    p_is_system              => true
  );

  ------------------------------------------------------------------
  -- 3b. Move the purchase order on.
  ------------------------------------------------------------------
  if v_grn.purchase_order_id is not null then
    select coalesce(sum(quantity_ordered - quantity_received), 0) into v_po_open
    from public.purchase_order_lines
    where purchase_order_id = v_grn.purchase_order_id;

    update public.purchase_orders
       set status = case when v_po_open <= 0 then 'received' else 'partially_received' end
     where id = v_grn.purchase_order_id
       and status in ('approved', 'partially_received');
  end if;

  ------------------------------------------------------------------
  -- 4. Seal the GRN. The guard trigger blocks edits from here on, so
  --    this update runs before the status flips to 'posted'.
  ------------------------------------------------------------------
  update public.goods_received_notes
     set status           = 'posted',
         posted_at        = now(),
         posted_by        = auth.uid(),
         journal_entry_id = v_journal_id,
         total_cost       = v_total
   where id = p_grn_id;

  return v_journal_id;
end;
$$;

grant execute on function public.post_goods_received_note(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.purchase_requisitions      enable row level security;
alter table public.purchase_requisition_lines enable row level security;
alter table public.purchase_orders            enable row level security;
alter table public.purchase_order_lines       enable row level security;
alter table public.goods_received_notes       enable row level security;
alter table public.goods_received_note_lines  enable row level security;
alter table public.document_sequences         enable row level security;

-- Requisitions: anyone who may raise one sees their own; approvers see all.
drop policy if exists pr_select on public.purchase_requisitions;
create policy pr_select on public.purchase_requisitions
  for select to authenticated
  using (
    public.has_permission('purchase_requisitions.view')
    or requested_by = auth.uid()
  );

drop policy if exists pr_insert on public.purchase_requisitions;
create policy pr_insert on public.purchase_requisitions
  for insert to authenticated
  with check (public.has_permission('purchase_requisitions.create'));

drop policy if exists pr_update on public.purchase_requisitions;
create policy pr_update on public.purchase_requisitions
  for update to authenticated
  using (
    public.has_permission('purchase_requisitions.approve')
    or (requested_by = auth.uid() and status = 'draft')
  )
  with check (
    public.has_permission('purchase_requisitions.approve')
    or (requested_by = auth.uid() and status in ('draft', 'submitted'))
  );

drop policy if exists prl_all on public.purchase_requisition_lines;
create policy prl_all on public.purchase_requisition_lines
  for all to authenticated
  using (
    exists (
      select 1 from public.purchase_requisitions r
      where r.id = requisition_id
        and (public.has_permission('purchase_requisitions.view') or r.requested_by = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.purchase_requisitions r
      where r.id = requisition_id
        and r.status = 'draft'
        and (public.has_permission('purchase_requisitions.create') or r.requested_by = auth.uid())
    )
  );

-- Purchase orders
drop policy if exists po_select on public.purchase_orders;
create policy po_select on public.purchase_orders
  for select to authenticated
  using (public.has_permission('purchase_orders.view'));

drop policy if exists po_insert on public.purchase_orders;
create policy po_insert on public.purchase_orders
  for insert to authenticated
  with check (public.has_permission('purchase_orders.create'));

drop policy if exists po_update on public.purchase_orders;
create policy po_update on public.purchase_orders
  for update to authenticated
  using (
    public.has_any_permission(array['purchase_orders.create', 'purchase_orders.approve', 'purchase_orders.cancel'])
  )
  with check (
    public.has_any_permission(array['purchase_orders.create', 'purchase_orders.approve', 'purchase_orders.cancel'])
  );

drop policy if exists pol_select on public.purchase_order_lines;
create policy pol_select on public.purchase_order_lines
  for select to authenticated
  using (public.has_permission('purchase_orders.view'));

-- quantity_received is maintained by the GRN posting service. Clients may
-- write lines only while the order is still being drafted.
drop policy if exists pol_write on public.purchase_order_lines;
create policy pol_write on public.purchase_order_lines
  for all to authenticated
  using (
    public.has_permission('purchase_orders.create')
    and exists (
      select 1 from public.purchase_orders o
      where o.id = purchase_order_id and o.status in ('draft', 'pending_approval')
    )
  )
  with check (
    public.has_permission('purchase_orders.create')
    and exists (
      select 1 from public.purchase_orders o
      where o.id = purchase_order_id and o.status in ('draft', 'pending_approval')
    )
  );

-- GRNs
drop policy if exists grn_select on public.goods_received_notes;
create policy grn_select on public.goods_received_notes
  for select to authenticated
  using (public.has_permission('grn.view'));

drop policy if exists grn_insert on public.goods_received_notes;
create policy grn_insert on public.goods_received_notes
  for insert to authenticated
  with check (public.has_permission('grn.create'));

drop policy if exists grn_update on public.goods_received_notes;
create policy grn_update on public.goods_received_notes
  for update to authenticated
  using (public.has_any_permission(array['grn.create', 'grn.inspect', 'grn.approve']))
  with check (public.has_any_permission(array['grn.create', 'grn.inspect', 'grn.approve']));

drop policy if exists grnl_select on public.goods_received_note_lines;
create policy grnl_select on public.goods_received_note_lines
  for select to authenticated
  using (public.has_permission('grn.view'));

drop policy if exists grnl_write on public.goods_received_note_lines;
create policy grnl_write on public.goods_received_note_lines
  for all to authenticated
  using (
    public.has_any_permission(array['grn.create', 'grn.inspect'])
    and exists (
      select 1 from public.goods_received_notes g
      where g.id = grn_id and g.status <> 'posted'
    )
  )
  with check (
    public.has_any_permission(array['grn.create', 'grn.inspect'])
    and exists (
      select 1 from public.goods_received_notes g
      where g.id = grn_id and g.status <> 'posted'
    )
  );

-- Sequences are read to preview the next number; only the definer
-- function increments them.
drop policy if exists doc_seq_select on public.document_sequences;
create policy doc_seq_select on public.document_sequences
  for select to authenticated
  using (public.is_active_user());
