-- =====================================================================
-- Builders Paradise ERP — GRN posting verification
--
-- Proves the single most important transaction in the system: receiving
-- goods moves stock AND the ledger, in one transaction, or neither.
--
-- SAFE TO RUN ON PRODUCTION. It builds its own supplier, warehouse,
-- product, purchase order and GRN, all prefixed ZZVERIFY, and removes
-- them at the end. The journal it posts is reversed rather than deleted,
-- because journals are immutable — so the net ledger effect is zero and
-- both entries stay visible, which is correct accounting treatment.
--
-- Paste into Supabase → SQL Editor → Run. Read the `result` column.
-- =====================================================================

create temp table if not exists _v3 (
  step text, expected text, actual text, pass boolean
);
truncate _v3;

do $$
declare
  v_uom        uuid;
  v_branch     uuid;
  v_wh         uuid;
  v_supplier   uuid;
  v_product    uuid;
  v_po         uuid;
  v_po_line    uuid;
  v_grn        uuid;
  v_journal    uuid;
  v_stamp      text := to_char(clock_timestamp(), 'HH24MISSMS');
  v_qty        numeric;
  v_avg        numeric;
  v_debit      numeric;
  v_credit     numeric;
  v_count      integer;
  v_status     text;
  v_inv_before numeric;
  v_inv_after  numeric;
  v_ap_before  numeric;
  v_ap_after   numeric;
  v_draft      uuid;
  v_num_a      text;
  v_num_b      text;
begin
  select id into v_uom from public.units_of_measure where code = 'EA';
  select id into v_branch from public.branches order by is_head_office desc limit 1;
  if v_uom is null or v_branch is null then
    insert into _v3 values ('ABORTED', 'reference data', 'run earlier migrations first', false);
    return;
  end if;

  ------------------------------------------------------------------
  -- Fixtures
  ------------------------------------------------------------------
  insert into public.suppliers (code, name, country, payment_terms_days)
  values ('ZZVERIFYSUP', 'ZZVERIFY Test Supplier', 'Zimbabwe', 30)
  on conflict (code) do update set status = 'active'
  returning id into v_supplier;

  insert into public.warehouses (code, name, branch_id, type)
  values ('ZZVERIFYGRN', 'ZZVERIFY GRN Warehouse', v_branch, 'main')
  on conflict (code) do update set status = 'active'
  returning id into v_wh;

  insert into public.products (sku, name, uom_id, standard_cost, selling_price, track_stock)
  values ('ZZVERIFY-GRN', 'ZZVERIFY GRN Product', v_uom, 10, 25, true)
  on conflict (sku) do update set track_stock = true
  returning id into v_product;

  delete from public.inventory_balances where product_id = v_product;

  -- Opening ledger positions, so the assertions measure this run only.
  select coalesce(sum(l.debit) - sum(l.credit), 0) into v_inv_before
  from public.journal_entry_lines l join public.chart_of_accounts a on a.id = l.account_id
  where a.account_code = '1300';

  select coalesce(sum(l.credit) - sum(l.debit), 0) into v_ap_before
  from public.journal_entry_lines l join public.chart_of_accounts a on a.id = l.account_id
  where a.account_code = '2100';

  ------------------------------------------------------------------
  -- Purchase order: 100 ordered @ 12.00
  ------------------------------------------------------------------
  insert into public.purchase_orders (
    po_no, supplier_id, branch_id, warehouse_id, status, subtotal, total
  ) values (
    'ZZVERIFY-PO-' || v_stamp, v_supplier, v_branch, v_wh, 'approved', 1200, 1200
  ) returning id into v_po;

  insert into public.purchase_order_lines (
    purchase_order_id, line_no, product_id, quantity_ordered, unit_price, line_total
  ) values (v_po, 1, v_product, 100, 12.00, 1200)
  returning id into v_po_line;

  insert into _v3 values ('1. purchase order created', 'ok', 'ok', v_po is not null);

  ------------------------------------------------------------------
  -- GRN: 100 delivered, 90 accepted, 10 rejected
  ------------------------------------------------------------------
  insert into public.goods_received_notes (
    grn_no, purchase_order_id, supplier_id, warehouse_id, branch_id, status
  ) values (
    'ZZVERIFY-GRN-' || v_stamp, v_po, v_supplier, v_wh, v_branch, 'approved'
  ) returning id into v_grn;

  insert into public.goods_received_note_lines (
    grn_id, line_no, purchase_order_line_id, product_id,
    quantity_ordered, quantity_delivered, quantity_accepted, quantity_rejected,
    unit_cost, rejection_reason
  ) values (
    v_grn, 1, v_po_line, v_product, 100, 100, 90, 10, 12.00, 'Damaged bags'
  );

  ------------------------------------------------------------------
  -- 2. A rejection without a reason is refused by the constraint.
  ------------------------------------------------------------------
  begin
    insert into public.goods_received_note_lines (
      grn_id, line_no, product_id, quantity_delivered, quantity_accepted,
      quantity_rejected, unit_cost
    ) values (v_grn, 99, v_product, 5, 3, 2, 12.00);
    insert into _v3 values ('2. rejection without a reason refused', 'rejected', 'ALLOWED', false);
    delete from public.goods_received_note_lines where grn_id = v_grn and line_no = 99;
  exception when others then
    insert into _v3 values ('2. rejection without a reason refused', 'rejected', 'rejected', true);
  end;

  ------------------------------------------------------------------
  -- 3. Accepted + rejected must equal delivered.
  ------------------------------------------------------------------
  begin
    insert into public.goods_received_note_lines (
      grn_id, line_no, product_id, quantity_delivered, quantity_accepted,
      quantity_rejected, unit_cost
    ) values (v_grn, 98, v_product, 10, 9, 0, 12.00);
    insert into _v3 values ('3. accepted + rejected must equal delivered', 'rejected', 'ALLOWED', false);
    delete from public.goods_received_note_lines where grn_id = v_grn and line_no = 98;
  exception when others then
    insert into _v3 values ('3. accepted + rejected must equal delivered', 'rejected', 'rejected', true);
  end;

  ------------------------------------------------------------------
  -- 4. POST IT. Stock and the ledger together.
  ------------------------------------------------------------------
  v_journal := public.post_goods_received_note(v_grn);
  insert into _v3 values ('4. GRN posts', 'a journal id',
    case when v_journal is null then 'NULL' else 'returned' end, v_journal is not null);

  ------------------------------------------------------------------
  -- 5. Stock: only the ACCEPTED 90 arrived, at cost 12.
  ------------------------------------------------------------------
  select quantity, average_cost into v_qty, v_avg
  from public.inventory_balances where product_id = v_product and warehouse_id = v_wh;

  insert into _v3 values ('5. stock increased by accepted quantity only', '90',
    v_qty::text, v_qty = 90);
  insert into _v3 values ('5. weighted average is the GRN cost', '12',
    round(v_avg, 4)::text, round(v_avg, 4) = 12);

  select count(*) into v_count
  from public.inventory_movements
  where source_document_id = v_grn and movement_type = 'goods_receipt';
  insert into _v3 values ('5. movement traced to the GRN', '1', v_count::text, v_count = 1);

  ------------------------------------------------------------------
  -- 6. Ledger: Dr Inventory 1080 / Cr Accounts Payable 1080 (90 x 12).
  ------------------------------------------------------------------
  select total_debit, total_credit into v_debit, v_credit
  from public.journal_entries where id = v_journal;
  insert into _v3 values ('6. journal value is accepted qty x cost', '1080 / 1080',
    v_debit::text || ' / ' || v_credit::text, v_debit = 1080 and v_credit = 1080);

  select coalesce(sum(l.debit) - sum(l.credit), 0) into v_inv_after
  from public.journal_entry_lines l join public.chart_of_accounts a on a.id = l.account_id
  where a.account_code = '1300';
  insert into _v3 values ('6. Inventory 1300 debited by 1080', '1080',
    (v_inv_after - v_inv_before)::text, (v_inv_after - v_inv_before) = 1080);

  select coalesce(sum(l.credit) - sum(l.debit), 0) into v_ap_after
  from public.journal_entry_lines l join public.chart_of_accounts a on a.id = l.account_id
  where a.account_code = '2100';
  insert into _v3 values ('6. Accounts Payable 2100 credited by 1080', '1080',
    (v_ap_after - v_ap_before)::text, (v_ap_after - v_ap_before) = 1080);

  ------------------------------------------------------------------
  -- 7. Stock value and ledger value agree — the whole point.
  ------------------------------------------------------------------
  select total_value into v_qty
  from public.inventory_balances where product_id = v_product and warehouse_id = v_wh;
  insert into _v3 values ('7. stock value equals the ledger debit', '1080',
    round(v_qty, 2)::text, round(v_qty, 2) = 1080);

  ------------------------------------------------------------------
  -- 8. The purchase order moved on.
  ------------------------------------------------------------------
  select quantity_received into v_qty from public.purchase_order_lines where id = v_po_line;
  insert into _v3 values ('8. PO line records 90 received', '90', v_qty::text, v_qty = 90);

  select status into v_status from public.purchase_orders where id = v_po;
  insert into _v3 values ('8. PO is partially received', 'partially_received',
    v_status, v_status = 'partially_received');

  ------------------------------------------------------------------
  -- 9. The GRN is sealed and linked to its journal.
  ------------------------------------------------------------------
  select status into v_status from public.goods_received_notes where id = v_grn;
  insert into _v3 values ('9. GRN marked posted', 'posted', v_status, v_status = 'posted');

  select count(*) into v_count
  from public.goods_received_notes where id = v_grn and journal_entry_id = v_journal;
  insert into _v3 values ('9. GRN links to its journal', '1', v_count::text, v_count = 1);

  ------------------------------------------------------------------
  -- 10. A posted GRN cannot be posted again, edited or deleted.
  ------------------------------------------------------------------
  begin
    perform public.post_goods_received_note(v_grn);
    insert into _v3 values ('10. double posting refused', 'rejected', 'ALLOWED', false);
  exception when others then
    insert into _v3 values ('10. double posting refused', 'rejected', 'rejected', true);
  end;

  begin
    update public.goods_received_notes set notes = 'tampered' where id = v_grn;
    insert into _v3 values ('10. posted GRN immutable', 'rejected', 'ALLOWED', false);
  exception when others then
    insert into _v3 values ('10. posted GRN immutable', 'rejected', 'rejected', true);
  end;

  begin
    update public.goods_received_note_lines set quantity_accepted = 999 where grn_id = v_grn;
    insert into _v3 values ('10. posted GRN lines immutable', 'rejected', 'ALLOWED', false);
  exception when others then
    insert into _v3 values ('10. posted GRN lines immutable', 'rejected', 'rejected', true);
  end;

  ------------------------------------------------------------------
  -- 11. An unapproved GRN cannot be posted.
  ------------------------------------------------------------------
  begin
    insert into public.goods_received_notes (
      grn_no, supplier_id, warehouse_id, branch_id, status
    ) values ('ZZVERIFY-DRAFT-' || v_stamp, v_supplier, v_wh, v_branch, 'draft')
    returning id into v_draft;

    insert into public.goods_received_note_lines (
      grn_id, line_no, product_id, quantity_delivered, quantity_accepted, unit_cost
    ) values (v_draft, 1, v_product, 5, 5, 12.00);

    begin
      perform public.post_goods_received_note(v_draft);
      insert into _v3 values ('11. unapproved GRN cannot post', 'rejected', 'ALLOWED', false);
    exception when others then
      insert into _v3 values ('11. unapproved GRN cannot post', 'rejected', 'rejected', true);
    end;

    delete from public.goods_received_note_lines where grn_id = v_draft;
    delete from public.goods_received_notes where id = v_draft;
  end;

  ------------------------------------------------------------------
  -- 12. A blocked supplier gets no new orders.
  ------------------------------------------------------------------
  update public.suppliers set status = 'blocked' where id = v_supplier;
  begin
    insert into public.purchase_orders (po_no, supplier_id, branch_id, warehouse_id)
    values ('ZZVERIFY-BLOCKED-' || v_stamp, v_supplier, v_branch, v_wh);
    insert into _v3 values ('12. blocked supplier refuses new PO', 'rejected', 'ALLOWED', false);
  exception when others then
    insert into _v3 values ('12. blocked supplier refuses new PO', 'rejected', 'rejected', true);
  end;
  update public.suppliers set status = 'active' where id = v_supplier;

  ------------------------------------------------------------------
  -- 13. Document numbers do not repeat.
  ------------------------------------------------------------------
  v_num_a := public.next_document_number('goods_received_note');
  v_num_b := public.next_document_number('goods_received_note');
  insert into _v3 values ('13. document numbers are unique', 'different',
    case when v_num_a = v_num_b then 'SAME: ' || v_num_a else 'different' end,
    v_num_a <> v_num_b);

  ------------------------------------------------------------------
  -- Clean up. Journals are reversed, not deleted.
  ------------------------------------------------------------------
  perform public.reverse_journal_entry(v_journal, 'GRN verification cleanup');

  alter table public.goods_received_notes disable trigger trg_grn_posted_guard;
  alter table public.goods_received_note_lines disable trigger trg_grn_lines_guard;
  alter table public.inventory_movements disable trigger trg_movements_immutable;

  delete from public.goods_received_note_lines where grn_id = v_grn;
  delete from public.goods_received_notes where id = v_grn;
  delete from public.purchase_order_lines where purchase_order_id = v_po;
  delete from public.purchase_orders where id = v_po;
  delete from public.inventory_movements where product_id = v_product;
  delete from public.inventory_balances where product_id = v_product;
  delete from public.products where id = v_product;
  delete from public.warehouses where id = v_wh;
  delete from public.suppliers where id = v_supplier;

  alter table public.inventory_movements enable trigger trg_movements_immutable;
  alter table public.goods_received_note_lines enable trigger trg_grn_lines_guard;
  alter table public.goods_received_notes enable trigger trg_grn_posted_guard;

  insert into _v3 values ('14. cleanup: fixtures removed, journal reversed', 'done', 'done', true);
end $$;

select
  step,
  expected,
  actual,
  case when pass then 'PASS' else 'FAIL' end as result
from _v3
order by step;
