-- =====================================================================
-- Builders Paradise ERP — Phase 2: product catalogue
--
-- Categories, brands, units of measure, products and barcodes.
-- Re-runnable; nothing is dropped or truncated.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Units of measure
-- ---------------------------------------------------------------------

create table if not exists public.units_of_measure (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  name          text not null,
  -- Whole units only (each, bag) vs divisible (kg, m3). Stops "0.5 doors".
  allow_decimal boolean not null default false,
  status        text not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid,
  constraint uom_code_key unique (code),
  constraint uom_status_check check (status in ('active', 'inactive'))
);

-- ---------------------------------------------------------------------
-- Categories — two levels (category / subcategory) via self reference
-- ---------------------------------------------------------------------

create table if not exists public.product_categories (
  id         uuid primary key default gen_random_uuid(),
  code       text not null,
  name       text not null,
  parent_id  uuid references public.product_categories (id) on delete restrict,
  description text,
  status     text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint product_categories_code_key unique (code),
  constraint product_categories_status_check check (status in ('active', 'inactive')),
  constraint product_categories_not_self check (parent_id is null or parent_id <> id)
);

create index if not exists product_categories_parent_idx on public.product_categories (parent_id);

-- A subcategory may not itself have a parent: the tree stops at two levels.
create or replace function public.fn_guard_category_depth()
returns trigger
language plpgsql
as $$
declare
  v_grandparent uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  select parent_id into v_grandparent
  from public.product_categories where id = new.parent_id;

  if v_grandparent is not null then
    raise exception 'Categories are only two levels deep — "%" is already a subcategory', new.parent_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_category_depth on public.product_categories;
create trigger trg_category_depth
  before insert or update on public.product_categories
  for each row execute function public.fn_guard_category_depth();

-- ---------------------------------------------------------------------
-- Brands
-- ---------------------------------------------------------------------

create table if not exists public.brands (
  id         uuid primary key default gen_random_uuid(),
  code       text not null,
  name       text not null,
  status     text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint brands_code_key unique (code),
  constraint brands_status_check check (status in ('active', 'inactive'))
);

-- ---------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------

create table if not exists public.products (
  id                  uuid primary key default gen_random_uuid(),
  sku                 text not null,
  stock_code          text,
  name                text not null,
  description         text,
  category_id         uuid references public.product_categories (id) on delete restrict,
  brand_id            uuid references public.brands (id) on delete restrict,
  uom_id              uuid not null references public.units_of_measure (id) on delete restrict,
  default_supplier_id uuid,   -- FK added in the purchasing migration

  -- Money. Cost is maintained by the inventory engine on receipt, never by
  -- hand — this column is the catalogue's "standard" cost for reference and
  -- for costing a product that has never been received anywhere.
  standard_cost       numeric(14, 4) not null default 0,
  selling_price       numeric(14, 4) not null default 0,
  tax_rate            numeric(7, 4) not null default 0,

  min_stock_level     numeric(14, 4) not null default 0,
  max_stock_level     numeric(14, 4),
  reorder_level       numeric(14, 4) not null default 0,

  image_url           text,
  notes               text,

  track_stock         boolean not null default true,
  track_expiry        boolean not null default false,
  status              text not null default 'active',

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid,
  updated_by          uuid,

  constraint products_sku_key unique (sku),
  constraint products_stock_code_key unique (stock_code),
  constraint products_status_check check (status in ('active', 'inactive', 'discontinued')),
  constraint products_cost_check check (standard_cost >= 0),
  constraint products_price_check check (selling_price >= 0),
  constraint products_tax_check check (tax_rate >= 0 and tax_rate <= 100),
  constraint products_levels_check check (
    min_stock_level >= 0
    and reorder_level >= 0
    and (max_stock_level is null or max_stock_level >= min_stock_level)
  )
);

create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_brand_idx on public.products (brand_id);
create index if not exists products_status_idx on public.products (status);
create index if not exists products_name_idx on public.products (lower(name));
create index if not exists products_sku_idx on public.products (lower(sku));

-- ---------------------------------------------------------------------
-- Barcodes — a product may carry several (EAN on the box, supplier code,
-- an in-store label), so this is a child table rather than a column.
-- ---------------------------------------------------------------------

create table if not exists public.product_barcodes (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  barcode    text not null,
  -- The one printed on shelf labels and used by "add by scan".
  is_primary boolean not null default false,
  label      text,
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint product_barcodes_key unique (barcode),
  constraint product_barcodes_format check (barcode ~ '^[A-Za-z0-9._-]{4,64}$')
);

create index if not exists product_barcodes_product_idx on public.product_barcodes (product_id);

-- One primary barcode per product.
create unique index if not exists product_barcodes_one_primary
  on public.product_barcodes (product_id) where is_primary;

-- ---------------------------------------------------------------------
-- Scanning: one call resolves a scan to a product, whatever code was used.
-- ---------------------------------------------------------------------

create or replace function public.find_product_by_scan(p_code text)
returns table (
  product_id    uuid,
  sku           text,
  name          text,
  selling_price numeric,
  tax_rate      numeric,
  uom_code      text,
  track_stock   boolean,
  status        text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select p.id, p.sku, p.name, p.selling_price, p.tax_rate, u.code, p.track_stock, p.status
  from public.products p
  join public.units_of_measure u on u.id = p.uom_id
  where p.status = 'active'
    and (
      lower(p.sku) = lower(trim(p_code))
      or lower(coalesce(p.stock_code, '')) = lower(trim(p_code))
      or exists (
        select 1 from public.product_barcodes b
        where b.product_id = p.id and lower(b.barcode) = lower(trim(p_code))
      )
    )
  limit 1;
$$;

grant execute on function public.find_product_by_scan(text) to authenticated;

-- ---------------------------------------------------------------------
-- Row stamps and audit
-- ---------------------------------------------------------------------

do $$
declare t record;
begin
  for t in select * from (values
      ('units_of_measure', 'inventory'),
      ('product_categories', 'inventory'),
      ('brands', 'inventory'),
      ('products', 'inventory')
    ) as x(tbl, module)
  loop
    execute format('drop trigger if exists trg_%1$s_stamp on public.%1$I', t.tbl);
    execute format(
      'create trigger trg_%1$s_stamp before insert or update on public.%1$I
         for each row execute function public.set_row_audit_fields()', t.tbl);

    execute format('drop trigger if exists trg_%1$s_audit on public.%1$I', t.tbl);
    execute format(
      'create trigger trg_%1$s_audit after insert or update or delete on public.%1$I
         for each row execute function public.fn_audit(%2$L)', t.tbl, t.module);
  end loop;
end;
$$;

drop trigger if exists trg_product_barcodes_audit on public.product_barcodes;
create trigger trg_product_barcodes_audit
  after insert or update or delete on public.product_barcodes
  for each row execute function public.fn_audit('inventory');
