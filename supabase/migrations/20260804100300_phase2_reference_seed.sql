-- =====================================================================
-- Builders Paradise ERP — Phase 2: reference data
--
-- Units of measure and the hardware category tree named in the brief.
-- Structural, not demo data: the rest of the system refers to these.
-- =====================================================================

insert into public.units_of_measure (code, name, allow_decimal) values
  ('EA',    'Each',            false),
  ('BAG',   'Bag',             false),
  ('BOX',   'Box',             false),
  ('PKT',   'Packet',          false),
  ('ROLL',  'Roll',            false),
  ('SHT',   'Sheet',           false),
  ('LEN',   'Length',          false),
  ('PR',    'Pair',            false),
  ('SET',   'Set',             false),
  ('KG',    'Kilogram',        true),
  ('TON',   'Tonne',           true),
  ('L',     'Litre',           true),
  ('M',     'Metre',           true),
  ('M2',    'Square metre',    true),
  ('M3',    'Cubic metre',     true),
  ('LOAD',  'Load',            true)
on conflict (code) do update set name = excluded.name, allow_decimal = excluded.allow_decimal;

-- Top-level categories from the brief.
insert into public.product_categories (code, name, parent_id) values
  ('CEM',   'Cement',                null),
  ('STL',   'Steel',                 null),
  ('BRK',   'Bricks and Blocks',     null),
  ('ROOF',  'Roofing',               null),
  ('PNT',   'Paint',                 null),
  ('PLB',   'Plumbing',              null),
  ('ELE',   'Electrical',            null),
  ('TMB',   'Timber',                null),
  ('TOOL',  'Tools',                 null),
  ('FAST',  'Fasteners',            null),
  ('DOOR',  'Doors',                 null),
  ('WIN',   'Windows',               null),
  ('TILE',  'Tiles',                 null),
  ('AGG',   'Sand and Aggregates',   null)
on conflict (code) do update set name = excluded.name;

-- Subcategories, resolved against their parent by code.
insert into public.product_categories (code, name, parent_id)
select s.code, s.name, p.id
from (values
  ('CEM-OPC',  'Ordinary Portland Cement', 'CEM'),
  ('CEM-MAS',  'Masonry Cement',           'CEM'),
  ('CEM-ADH',  'Adhesives and Grout',      'CEM'),
  ('STL-REBAR','Reinforcing Bar',          'STL'),
  ('STL-MESH', 'Mesh and Brc',             'STL'),
  ('STL-SECT', 'Sections and Tubing',      'STL'),
  ('ROOF-IBR', 'IBR and Corrugated Sheet', 'ROOF'),
  ('ROOF-TILE','Roof Tiles',               'ROOF'),
  ('PNT-INT',  'Interior Paint',           'PNT'),
  ('PNT-EXT',  'Exterior Paint',           'PNT'),
  ('PNT-ACC',  'Brushes and Accessories',  'PNT'),
  ('PLB-PIPE', 'Pipes',                    'PLB'),
  ('PLB-FIT',  'Fittings',                 'PLB'),
  ('PLB-SAN',  'Sanitaryware',             'PLB'),
  ('ELE-CBL',  'Cable and Wire',           'ELE'),
  ('ELE-ACC',  'Switches and Sockets',     'ELE'),
  ('ELE-LGT',  'Lighting',                 'ELE'),
  ('TOOL-HND', 'Hand Tools',               'TOOL'),
  ('TOOL-PWR', 'Power Tools',              'TOOL'),
  ('AGG-SND',  'Sand',                     'AGG'),
  ('AGG-STN',  'Stone and Gravel',         'AGG')
) as s(code, name, parent_code)
join public.product_categories p on p.code = s.parent_code
on conflict (code) do update set name = excluded.name;
