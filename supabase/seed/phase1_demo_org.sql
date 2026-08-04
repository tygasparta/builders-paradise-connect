-- =====================================================================
-- Builders Paradise ERP — Phase 1 demo organisation data
--
-- REMOVABLE. This file seeds branches, warehouses and locations so the
-- app has something real to work with on day one. Delete the rows with
-- phase1_demo_org_rollback.sql when the real branch structure is ready.
--
-- Run AFTER the migrations in supabase/migrations/.
-- =====================================================================

insert into public.branches (code, name, is_head_office, address_line1, city, country, phone, email, currency_code)
values
  ('HQ',   'Head Office — Harare',  true,  '14 Seke Road, Graniteside',  'Harare',   'Zimbabwe', '+263 242 771 500', 'harare@buildersparadise.co.zw',  'USD'),
  ('BYO',  'Bulawayo Branch',       false, '82 Fife Street',             'Bulawayo', 'Zimbabwe', '+263 292 883 210', 'bulawayo@buildersparadise.co.zw','USD'),
  ('MUT',  'Mutare Branch',         false, '31 Herbert Chitepo Street',  'Mutare',   'Zimbabwe', '+263 202 664 118', 'mutare@buildersparadise.co.zw',  'USD')
on conflict (code) do nothing;

insert into public.warehouses (code, name, branch_id, type, address, is_default, allow_negative_stock)
select w.code, w.name, b.id, w.type, w.address, w.is_default, false
from (values
  ('HQ-MAIN',    'Harare Main Store',        'HQ',  'main',             '14 Seke Road, Graniteside', true),
  ('HQ-SHOP',    'Harare Shop Floor',        'HQ',  'shop_floor',       '14 Seke Road, Graniteside', false),
  ('HQ-YARD',    'Harare Yard — Aggregates', 'HQ',  'main',             '14 Seke Road, Graniteside', false),
  ('HQ-DAMAGED', 'Damaged Goods — Harare',   'HQ',  'damaged',          '14 Seke Road, Graniteside', false),
  ('HQ-RETURNS', 'Returns — Harare',         'HQ',  'returns',          '14 Seke Road, Graniteside', false),
  ('TRANSIT',    'Goods in Transit',         'HQ',  'in_transit',       null,                        false),
  ('STAFF',      'Employee Issues',          'HQ',  'virtual_employee', null,                        false),
  ('BYO-MAIN',   'Bulawayo Store',           'BYO', 'branch',           '82 Fife Street',            true),
  ('BYO-SHOP',   'Bulawayo Shop Floor',      'BYO', 'shop_floor',       '82 Fife Street',            false),
  ('MUT-MAIN',   'Mutare Store',             'MUT', 'branch',           '31 Herbert Chitepo Street', true)
) as w(code, name, branch_code, type, address, is_default)
join public.branches b on b.code = w.branch_code
on conflict (code) do nothing;

insert into public.warehouse_locations (warehouse_id, code, name, type)
select wh.id, l.code, l.name, l.type
from (values
  ('HQ-MAIN',  'A1',  'Aisle A — Cement & Adhesives', 'storage'),
  ('HQ-MAIN',  'A2',  'Aisle A — Paint & Finishes',   'storage'),
  ('HQ-MAIN',  'B1',  'Aisle B — Plumbing',           'storage'),
  ('HQ-MAIN',  'B2',  'Aisle B — Electrical',         'storage'),
  ('HQ-MAIN',  'C1',  'Aisle C — Tools & Fasteners',  'picking'),
  ('HQ-MAIN',  'RCV', 'Goods Receiving Bay',          'receiving'),
  ('HQ-MAIN',  'DSP', 'Dispatch Bay',                 'dispatch'),
  ('HQ-MAIN',  'QTN', 'Quarantine — Awaiting QC',     'quarantine'),
  ('HQ-YARD',  'Y1',  'Yard Bay 1 — Sand & Stone',    'storage'),
  ('HQ-YARD',  'Y2',  'Yard Bay 2 — Bricks & Blocks', 'storage'),
  ('HQ-YARD',  'Y3',  'Yard Bay 3 — Steel & Timber',  'storage'),
  ('BYO-MAIN', 'A1',  'Aisle A — General',            'storage'),
  ('BYO-MAIN', 'RCV', 'Goods Receiving Bay',          'receiving'),
  ('MUT-MAIN', 'A1',  'Aisle A — General',            'storage'),
  ('MUT-MAIN', 'RCV', 'Goods Receiving Bay',          'receiving')
) as l(warehouse_code, code, name, type)
join public.warehouses wh on wh.code = l.warehouse_code
on conflict (warehouse_id, code) do nothing;
