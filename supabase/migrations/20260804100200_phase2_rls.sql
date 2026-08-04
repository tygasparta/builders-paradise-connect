-- =====================================================================
-- Builders Paradise ERP — Phase 2: Row Level Security
--
-- Two rules worth stating plainly:
--   * Cost prices are a permission. `products` is readable by anyone who
--     can see the catalogue, so the cost columns are served through a
--     view that blanks them without products.cost_price.view.
--   * Stock is never edited. inventory_balances and inventory_movements
--     grant no client write path at all; both change only through
--     post_inventory_movement(), which is SECURITY DEFINER.
-- =====================================================================

alter table public.units_of_measure    enable row level security;
alter table public.product_categories  enable row level security;
alter table public.brands              enable row level security;
alter table public.products            enable row level security;
alter table public.product_barcodes    enable row level security;
alter table public.inventory_balances  enable row level security;
alter table public.inventory_movements enable row level security;

alter table public.inventory_movements force row level security;
alter table public.inventory_balances  force row level security;

-- ---------------------------------------------------------------------
-- Reference data: readable by any active user, maintained by product editors
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['units_of_measure', 'product_categories', 'brands']
  loop
    execute format('drop policy if exists %1$s_select on public.%1$I', t);
    execute format($p$
      create policy %1$s_select on public.%1$I
        for select to authenticated
        using (public.is_active_user())
    $p$, t);

    execute format('drop policy if exists %1$s_write on public.%1$I', t);
    execute format($p$
      create policy %1$s_write on public.%1$I
        for all to authenticated
        using (public.has_any_permission(array['products.create', 'products.update']))
        with check (public.has_any_permission(array['products.create', 'products.update']))
    $p$, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------

drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select to authenticated
  using (public.has_permission('products.view'));

drop policy if exists products_insert on public.products;
create policy products_insert on public.products
  for insert to authenticated
  with check (public.has_permission('products.create'));

drop policy if exists products_update on public.products;
create policy products_update on public.products
  for update to authenticated
  using (public.has_permission('products.update'))
  with check (public.has_permission('products.update'));

-- No delete policy: products are discontinued, never deleted, because
-- movements and invoice lines reference them forever.

-- Changing the selling price is its own permission, separate from editing
-- the product. Enforced here so it holds however the update arrives.
create or replace function public.fn_guard_product_pricing()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;  -- service role / SQL editor
  end if;

  if new.selling_price is distinct from old.selling_price
     and not public.has_permission('products.selling_price.update') then
    raise exception 'Changing the selling price needs the "Change selling prices" permission';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_products_pricing_guard on public.products;
create trigger trg_products_pricing_guard
  before update on public.products
  for each row execute function public.fn_guard_product_pricing();

drop policy if exists product_barcodes_select on public.product_barcodes;
create policy product_barcodes_select on public.product_barcodes
  for select to authenticated
  using (public.has_permission('products.view'));

drop policy if exists product_barcodes_write on public.product_barcodes;
create policy product_barcodes_write on public.product_barcodes
  for all to authenticated
  using (public.has_any_permission(array['products.create', 'products.update']))
  with check (public.has_any_permission(array['products.create', 'products.update']));

-- ---------------------------------------------------------------------
-- Cost-price masking
--
-- A cashier may look up a product but must not learn what it cost. The
-- view is the read path for any screen that does not need cost.
-- ---------------------------------------------------------------------

create or replace view public.products_catalogue
with (security_invoker = true)
as
select
  p.id,
  p.sku,
  p.stock_code,
  p.name,
  p.description,
  p.category_id,
  p.brand_id,
  p.uom_id,
  p.selling_price,
  p.tax_rate,
  p.min_stock_level,
  p.max_stock_level,
  p.reorder_level,
  p.image_url,
  p.track_stock,
  p.track_expiry,
  p.status,
  p.created_at,
  p.updated_at,
  -- Null, not zero: a blanked cost must be obviously absent rather than
  -- looking like a free item.
  case when public.has_permission('products.cost_price.view') then p.standard_cost end as standard_cost
from public.products p;

grant select on public.products_catalogue to authenticated;

-- ---------------------------------------------------------------------
-- Stock: read by permission, written by nobody
-- ---------------------------------------------------------------------

drop policy if exists inventory_balances_select on public.inventory_balances;
create policy inventory_balances_select on public.inventory_balances
  for select to authenticated
  using (public.has_permission('inventory.balances.view'));

drop policy if exists inventory_movements_select on public.inventory_movements;
create policy inventory_movements_select on public.inventory_movements
  for select to authenticated
  using (public.has_permission('inventory.movements.view'));

-- Deliberately no insert/update/delete policies on either table.
-- post_inventory_movement() is SECURITY DEFINER and is the only way in.
