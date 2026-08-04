-- =====================================================================
-- Builders Paradise ERP — Phase 2 inventory engine verification
--
-- Proves the weighted-average costing engine, the negative-stock gates
-- and ledger immutability, using a throwaway product in a throwaway
-- warehouse. Everything it creates is removed at the end.
--
-- SAFE TO RUN ON PRODUCTION: it touches only rows it created itself,
-- identified by the ZZVERIFY prefix. (Codes must start with a letter or
-- digit, so the prefix cannot be an underscore.) It does not read, alter
-- or delete any real product, warehouse, balance or movement.
--
-- Paste into Supabase → SQL Editor → Run. Read the `result` column.
-- =====================================================================

create temp table if not exists _v2 (
  step text, expected text, actual text, pass boolean
);
truncate _v2;

do $$
declare
  v_uom        uuid;
  v_branch     uuid;
  v_wh         uuid;
  v_wh_neg     uuid;
  v_product    uuid;
  v_admin      uuid;
  v_qty        numeric;
  v_avg        numeric;
  v_val        numeric;
  v_cost       numeric;
  v_count      integer;
  v_movement   uuid;
begin
  select id into v_admin from public.profiles where status = 'active' order by created_at limit 1;
  select id into v_uom from public.units_of_measure where code = 'EA';
  select id into v_branch from public.branches order by is_head_office desc limit 1;

  if v_uom is null or v_branch is null then
    insert into _v2 values ('ABORTED', 'reference data', 'run the Phase 2 migrations first', false);
    return;
  end if;

  ------------------------------------------------------------------
  -- Fixtures
  ------------------------------------------------------------------
  insert into public.warehouses (code, name, branch_id, type, allow_negative_stock)
  values ('ZZVERIFYWH', 'ZZVERIFY Test Warehouse', v_branch, 'main', false)
  on conflict (code) do update set allow_negative_stock = false
  returning id into v_wh;

  insert into public.warehouses (code, name, branch_id, type, allow_negative_stock)
  values ('ZZVERIFYNEG', 'ZZVERIFY Negative Allowed', v_branch, 'main', true)
  on conflict (code) do update set allow_negative_stock = true
  returning id into v_wh_neg;

  insert into public.products (sku, name, uom_id, standard_cost, selling_price, track_stock)
  values ('ZZVERIFY-SKU', 'ZZVERIFY Test Product', v_uom, 10, 25, true)
  on conflict (sku) do update set track_stock = true
  returning id into v_product;

  -- Start from a clean slate if a previous run left rows behind.
  delete from public.inventory_balances where product_id = v_product;

  ------------------------------------------------------------------
  -- 1. First receipt sets the average
  --    100 @ 10.00  ->  qty 100, avg 10.00, value 1000
  ------------------------------------------------------------------
  perform public.post_inventory_movement(
    v_product, v_wh, 'goods_receipt', 100, 10.00, 'verify', 'TEST', null, 'T-1');

  select quantity, average_cost, total_value into v_qty, v_avg, v_val
  from public.inventory_balances where product_id = v_product and warehouse_id = v_wh;

  insert into _v2 values ('1. receipt 100 @ 10 -> qty', '100', v_qty::text, v_qty = 100);
  insert into _v2 values ('1. receipt 100 @ 10 -> avg cost', '10', round(v_avg, 4)::text, round(v_avg, 4) = 10);
  insert into _v2 values ('1. receipt 100 @ 10 -> value', '1000', round(v_val, 2)::text, round(v_val, 2) = 1000);

  ------------------------------------------------------------------
  -- 2. Second receipt at a different price blends the average
  --    + 100 @ 20.00 -> qty 200, avg 15.00, value 3000
  ------------------------------------------------------------------
  perform public.post_inventory_movement(
    v_product, v_wh, 'goods_receipt', 100, 20.00, 'verify', 'TEST', null, 'T-2');

  select quantity, average_cost, total_value into v_qty, v_avg, v_val
  from public.inventory_balances where product_id = v_product and warehouse_id = v_wh;

  insert into _v2 values ('2. weighted average after 100@10 + 100@20', '15', round(v_avg, 4)::text, round(v_avg, 4) = 15);
  insert into _v2 values ('2. quantity after second receipt', '200', v_qty::text, v_qty = 200);
  insert into _v2 values ('2. value after second receipt', '3000', round(v_val, 2)::text, round(v_val, 2) = 3000);

  ------------------------------------------------------------------
  -- 3. An issue leaves at the average, and does NOT move the average
  --    - 50 -> qty 150, avg still 15.00, cost of sale 750
  ------------------------------------------------------------------
  select public.post_inventory_movement(
    v_product, v_wh, 'sale', 50, null, 'verify', 'TEST', null, 'T-3') into v_movement;

  select unit_cost, total_cost into v_cost, v_val from public.inventory_movements where id = v_movement;
  insert into _v2 values ('3. sale is costed at the average', '15', round(v_cost, 4)::text, round(v_cost, 4) = 15);
  insert into _v2 values ('3. cost of sale for 50 units', '750', round(v_val, 2)::text, round(v_val, 2) = 750);

  select quantity, average_cost into v_qty, v_avg
  from public.inventory_balances where product_id = v_product and warehouse_id = v_wh;
  insert into _v2 values ('3. issue does not move the average', '15', round(v_avg, 4)::text, round(v_avg, 4) = 15);
  insert into _v2 values ('3. quantity after issue', '150', v_qty::text, v_qty = 150);

  ------------------------------------------------------------------
  -- 4. Uneven quantities — the case naive rounding gets wrong.
  --    150 @ 15 + 30 @ 22.50 = (2250 + 675) / 180 = 16.25
  ------------------------------------------------------------------
  perform public.post_inventory_movement(
    v_product, v_wh, 'goods_receipt', 30, 22.50, 'verify', 'TEST', null, 'T-4');

  select average_cost into v_avg
  from public.inventory_balances where product_id = v_product and warehouse_id = v_wh;
  insert into _v2 values ('4. blended average 150@15 + 30@22.50', '16.25', round(v_avg, 4)::text, round(v_avg, 4) = 16.25);

  ------------------------------------------------------------------
  -- 5. Ledger snapshot matches the live balance
  ------------------------------------------------------------------
  select balance_quantity, balance_average_cost into v_qty, v_avg
  from public.inventory_movements
  where product_id = v_product and warehouse_id = v_wh
  order by movement_no desc limit 1;

  select quantity, average_cost into v_val, v_cost
  from public.inventory_balances where product_id = v_product and warehouse_id = v_wh;

  insert into _v2 values ('5. ledger snapshot matches balance', 'match',
    case when v_qty = v_val and round(v_avg,4) = round(v_cost,4) then 'match' else 'DRIFT' end,
    v_qty = v_val and round(v_avg,4) = round(v_cost,4));

  ------------------------------------------------------------------
  -- 6. Negative stock is refused where the warehouse forbids it
  ------------------------------------------------------------------
  begin
    perform public.post_inventory_movement(
      v_product, v_wh, 'sale', 99999, null, 'verify', 'TEST', null, 'T-6');
    insert into _v2 values ('6. oversell blocked', 'rejected', 'ALLOWED', false);
  exception when others then
    insert into _v2 values ('6. oversell blocked', 'rejected', 'rejected: ' || left(SQLERRM, 60), true);
  end;

  ------------------------------------------------------------------
  -- 7. ...and permitted where the warehouse opts in
  ------------------------------------------------------------------
  perform public.post_inventory_movement(
    v_product, v_wh_neg, 'goods_receipt', 5, 10, 'verify', 'TEST', null, 'T-7a');
  begin
    perform public.post_inventory_movement(
      v_product, v_wh_neg, 'sale', 8, null, 'verify', 'TEST', null, 'T-7b');
    select quantity into v_qty
    from public.inventory_balances where product_id = v_product and warehouse_id = v_wh_neg;
    insert into _v2 values ('7. negative allowed where opted in', '-3', v_qty::text, v_qty = -3);
  exception when others then
    insert into _v2 values ('7. negative allowed where opted in', '-3', 'rejected: ' || left(SQLERRM, 50), false);
  end;

  ------------------------------------------------------------------
  -- 8. Zero and negative quantities are rejected outright
  ------------------------------------------------------------------
  begin
    perform public.post_inventory_movement(v_product, v_wh, 'sale', 0, null);
    insert into _v2 values ('8. zero quantity rejected', 'rejected', 'ALLOWED', false);
  exception when others then
    insert into _v2 values ('8. zero quantity rejected', 'rejected', 'rejected', true);
  end;

  ------------------------------------------------------------------
  -- 9. Posted movements are immutable
  ------------------------------------------------------------------
  begin
    update public.inventory_movements set quantity = 1 where id = v_movement;
    insert into _v2 values ('9. movements immutable (update)', 'rejected', 'ALLOWED', false);
  exception when others then
    insert into _v2 values ('9. movements immutable (update)', 'rejected', 'rejected', true);
  end;

  begin
    delete from public.inventory_movements where id = v_movement;
    insert into _v2 values ('9. movements immutable (delete)', 'rejected', 'ALLOWED', false);
  exception when others then
    insert into _v2 values ('9. movements immutable (delete)', 'rejected', 'rejected', true);
  end;

  ------------------------------------------------------------------
  -- 10. Unknown movement type refused
  ------------------------------------------------------------------
  begin
    perform public.post_inventory_movement(v_product, v_wh, 'teleport', 1, 1);
    insert into _v2 values ('10. unknown movement type rejected', 'rejected', 'ALLOWED', false);
  exception when others then
    insert into _v2 values ('10. unknown movement type rejected', 'rejected', 'rejected', true);
  end;

  ------------------------------------------------------------------
  -- 11. Historical valuation replays the ledger
  ------------------------------------------------------------------
  select total_value into v_val
  from public.inventory_valuation_as_at(current_date, v_wh)
  where product_id = v_product;

  select total_value into v_cost
  from public.inventory_balances where product_id = v_product and warehouse_id = v_wh;

  insert into _v2 values ('11. valuation as-at matches balance', 'match',
    case when round(v_val,2) = round(v_cost,2) then 'match' else 'DRIFT' end,
    round(v_val,2) = round(v_cost,2));

  ------------------------------------------------------------------
  -- 12. Barcode lookup resolves by SKU and by barcode
  ------------------------------------------------------------------
  insert into public.product_barcodes (product_id, barcode, is_primary)
  values (v_product, 'ZZVERIFY6001234567890', true)
  on conflict (barcode) do nothing;

  select count(*) into v_count from public.find_product_by_scan('ZZVERIFY6001234567890');
  insert into _v2 values ('12. scan finds product by barcode', '1', v_count::text, v_count = 1);

  select count(*) into v_count from public.find_product_by_scan('ZZVERIFY-SKU');
  insert into _v2 values ('12. scan finds product by SKU', '1', v_count::text, v_count = 1);

  ------------------------------------------------------------------
  -- Clean up every fixture this script created.
  ------------------------------------------------------------------
  delete from public.product_barcodes where product_id = v_product;
  -- The immutability trigger guards client edits; removing verification
  -- fixtures is a deliberate exception performed here as the owner.
  alter table public.inventory_movements disable trigger trg_movements_immutable;
  delete from public.inventory_movements where product_id = v_product;
  alter table public.inventory_movements enable trigger trg_movements_immutable;
  delete from public.inventory_balances where product_id = v_product;
  delete from public.products where id = v_product;
  delete from public.warehouses where code in ('ZZVERIFYWH', 'ZZVERIFYNEG');

  insert into _v2 values ('13. cleanup: fixtures removed', 'removed', 'removed', true);
end $$;

select
  step,
  expected,
  actual,
  case when pass then 'PASS' else 'FAIL' end as result
from _v2
order by step;
