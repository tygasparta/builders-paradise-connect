-- =====================================================================
-- Builders Paradise ERP — Phase 1: core schema
-- Organisation, RBAC, profiles, audit trail, notifications.
--
-- Safe to run on an empty project. Every object uses IF NOT EXISTS or
-- CREATE OR REPLACE so the file is re-runnable. Nothing here drops or
-- truncates existing data.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------

-- Keeps updated_at / updated_by honest without trusting the client.
create or replace function public.set_row_audit_fields()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

comment on function public.set_row_audit_fields is
  'Stamps created_at/created_by on insert and updated_at/updated_by on every write.';

-- ---------------------------------------------------------------------
-- Organisation
-- ---------------------------------------------------------------------

create table if not exists public.branches (
  id              uuid primary key default gen_random_uuid(),
  code            text not null,
  name            text not null,
  is_head_office  boolean not null default false,
  address_line1   text,
  address_line2   text,
  city            text,
  country         text not null default 'Zimbabwe',
  phone           text,
  email           citext,
  tax_number      text,
  currency_code   char(3) not null default 'USD',
  status          text not null default 'active',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid,
  updated_by      uuid,
  constraint branches_code_key unique (code),
  constraint branches_status_check check (status in ('active', 'inactive')),
  constraint branches_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,15}$')
);

-- At most one head office.
create unique index if not exists branches_single_head_office
  on public.branches ((is_head_office)) where is_head_office;

create index if not exists branches_status_idx on public.branches (status);

-- ---------------------------------------------------------------------
-- Profiles (1:1 with auth.users — never store passwords here)
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  employee_code        text,
  full_name            text not null,
  email                citext not null,
  phone                text,
  job_title            text,
  avatar_url           text,
  status               text not null default 'invited',
  default_branch_id    uuid references public.branches (id) on delete set null,
  default_warehouse_id uuid,
  last_login_at        timestamptz,
  failed_login_count   integer not null default 0,
  locked_until         timestamptz,
  must_change_password boolean not null default false,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid,
  updated_by           uuid,
  constraint profiles_employee_code_key unique (employee_code),
  constraint profiles_status_check check (status in ('invited', 'active', 'suspended', 'locked')),
  constraint profiles_failed_login_check check (failed_login_count >= 0)
);

create index if not exists profiles_status_idx on public.profiles (status);
create index if not exists profiles_branch_idx on public.profiles (default_branch_id);
create index if not exists profiles_full_name_idx on public.profiles (lower(full_name));

-- ---------------------------------------------------------------------
-- Warehouses and locations
-- ---------------------------------------------------------------------

create table if not exists public.warehouses (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null,
  name                 text not null,
  branch_id            uuid not null references public.branches (id) on delete restrict,
  type                 text not null default 'main',
  manager_id           uuid references public.profiles (id) on delete set null,
  address              text,
  status               text not null default 'active',
  is_default           boolean not null default false,
  -- Negative stock is blocked at the database level unless a warehouse
  -- explicitly opts in AND the acting user holds inventory.negative_stock.allow.
  allow_negative_stock boolean not null default false,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid,
  updated_by           uuid,
  constraint warehouses_code_key unique (code),
  constraint warehouses_status_check check (status in ('active', 'inactive')),
  constraint warehouses_type_check check (
    type in ('main', 'shop_floor', 'branch', 'virtual_employee', 'damaged', 'returns', 'in_transit')
  ),
  constraint warehouses_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,15}$')
);

create index if not exists warehouses_branch_idx on public.warehouses (branch_id);
create index if not exists warehouses_type_idx on public.warehouses (type);
create index if not exists warehouses_status_idx on public.warehouses (status);

-- One default warehouse per branch.
create unique index if not exists warehouses_one_default_per_branch
  on public.warehouses (branch_id) where is_default;

-- Deferred FK: profiles and warehouses reference each other.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_default_warehouse_fk'
  ) then
    alter table public.profiles
      add constraint profiles_default_warehouse_fk
      foreign key (default_warehouse_id) references public.warehouses (id) on delete set null;
  end if;
end;
$$;

create table if not exists public.warehouse_locations (
  id           uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  code         text not null,
  name         text not null,
  type         text not null default 'storage',
  status       text not null default 'active',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid,
  updated_by   uuid,
  constraint warehouse_locations_code_key unique (warehouse_id, code),
  constraint warehouse_locations_status_check check (status in ('active', 'inactive')),
  constraint warehouse_locations_type_check check (
    type in ('storage', 'picking', 'receiving', 'dispatch', 'quarantine')
  )
);

create index if not exists warehouse_locations_warehouse_idx
  on public.warehouse_locations (warehouse_id);

-- ---------------------------------------------------------------------
-- RBAC
-- ---------------------------------------------------------------------

create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  name        text not null,
  description text,
  -- System roles cannot be deleted or renamed by users.
  is_system   boolean not null default false,
  rank        integer not null default 100,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid,
  constraint roles_code_key unique (code),
  constraint roles_code_format check (code ~ '^[a-z][a-z0-9_]{1,39}$')
);

create table if not exists public.permissions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  module      text not null,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  constraint permissions_code_key unique (code),
  constraint permissions_code_format check (code ~ '^[a-z][a-z0-9_.]{2,63}$')
);

create index if not exists permissions_module_idx on public.permissions (module);

create table if not exists public.role_permissions (
  role_id       uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at    timestamptz not null default now(),
  created_by    uuid,
  primary key (role_id, permission_id)
);

create index if not exists role_permissions_permission_idx
  on public.role_permissions (permission_id);

create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role_id    uuid not null references public.roles (id) on delete restrict,
  -- Null branch = the role applies across every branch.
  branch_id  uuid references public.branches (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid
);

-- Treat NULL branch as a real value so the same role can't be granted twice.
create unique index if not exists user_roles_unique_grant
  on public.user_roles (user_id, role_id, coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists user_roles_user_idx on public.user_roles (user_id);
create index if not exists user_roles_role_idx on public.user_roles (role_id);

-- ---------------------------------------------------------------------
-- Company settings (single row)
-- ---------------------------------------------------------------------

create table if not exists public.system_settings (
  id                      boolean primary key default true,
  company_name            text not null default 'Builders Paradise Hardware',
  trading_name            text,
  logo_url                text,
  tax_number              text,
  registration_number     text,
  address_line1           text,
  address_line2           text,
  city                    text,
  country                 text not null default 'Zimbabwe',
  phone                   text,
  email                   citext,
  website                 text,
  base_currency           char(3) not null default 'USD',
  fiscal_year_start_month smallint not null default 1,
  date_format             text not null default 'dd MMM yyyy',
  -- Statutory and document settings are configurable, never hard-coded.
  default_tax_rate        numeric(7, 4) not null default 0,
  invoice_prefix          text not null default 'INV',
  quotation_prefix        text not null default 'QTE',
  receipt_prefix          text not null default 'RCT',
  po_prefix               text not null default 'PO',
  grn_prefix              text not null default 'GRN',
  adjustment_prefix       text not null default 'ADJ',
  requisition_prefix      text not null default 'REQ',
  journal_prefix          text not null default 'JNL',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by              uuid,
  updated_by              uuid,
  constraint system_settings_singleton check (id),
  constraint system_settings_month_check check (fiscal_year_start_month between 1 and 12),
  constraint system_settings_tax_check check (default_tax_rate >= 0 and default_tax_rate <= 100)
);

-- ---------------------------------------------------------------------
-- Audit trail — append only, never editable
-- ---------------------------------------------------------------------

create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete set null,
  user_email  citext,
  action      text not null,
  module      text not null,
  table_name  text,
  record_id   text,
  old_value   jsonb,
  new_value   jsonb,
  reason      text,
  ip_address  inet,
  user_agent  text,
  session_id  text,
  created_at  timestamptz not null default now(),
  constraint audit_logs_action_check check (
    action in ('insert', 'update', 'delete', 'login', 'logout', 'login_failed',
               'approve', 'reject', 'post', 'reverse', 'export', 'print')
  )
);

create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_user_idx on public.audit_logs (user_id);
create index if not exists audit_logs_module_idx on public.audit_logs (module);
create index if not exists audit_logs_record_idx on public.audit_logs (table_name, record_id);

create table if not exists public.login_attempts (
  id         uuid primary key default gen_random_uuid(),
  email      citext not null,
  succeeded  boolean not null,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists login_attempts_email_idx on public.login_attempts (email, created_at desc);

-- ---------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete cascade,
  -- Either targeted at a user, or broadcast to everyone holding a permission.
  permission_code text,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  severity   text not null default 'info',
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_severity_check check (severity in ('info', 'success', 'warning', 'danger')),
  constraint notifications_target_check check (user_id is not null or permission_code is not null)
);

create index if not exists notifications_user_idx on public.notifications (user_id, read_at);
create index if not exists notifications_created_idx on public.notifications (created_at desc);

-- ---------------------------------------------------------------------
-- Permission helpers
--
-- SECURITY DEFINER so they bypass RLS on user_roles/role_permissions.
-- Without this, any policy calling has_permission() would recurse.
-- ---------------------------------------------------------------------

create or replace function public.has_permission(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    join public.profiles pr on pr.id = ur.user_id
    where ur.user_id = auth.uid()
      and pr.status = 'active'
      and p.code = p_code
  );
$$;

create or replace function public.has_any_permission(p_codes text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    join public.profiles pr on pr.id = ur.user_id
    where ur.user_id = auth.uid()
      and pr.status = 'active'
      and p.code = any(p_codes)
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

-- Everything the client needs to build its permission set, in one call.
create or replace function public.my_permissions()
returns table (code text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct p.code
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions p on p.id = rp.permission_id
  join public.profiles pr on pr.id = ur.user_id
  where ur.user_id = auth.uid()
    and pr.status = 'active';
$$;

create or replace function public.my_roles()
returns table (code text, name text, rank integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct r.code, r.name, r.rank
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.profiles pr on pr.id = ur.user_id
  where ur.user_id = auth.uid()
    and pr.status = 'active';
$$;

grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.has_any_permission(text[]) to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.my_permissions() to authenticated;
grant execute on function public.my_roles() to authenticated;

-- ---------------------------------------------------------------------
-- Generic audit trigger
-- ---------------------------------------------------------------------

create or replace function public.fn_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_record_id text;
  v_old jsonb;
  v_new jsonb;
begin
  if (tg_op = 'DELETE') then
    v_old := to_jsonb(old);
    v_record_id := v_old ->> 'id';
  elsif (tg_op = 'INSERT') then
    v_new := to_jsonb(new);
    v_record_id := v_new ->> 'id';
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_record_id := v_new ->> 'id';
    -- Skip no-op updates so the trail stays readable.
    if v_old = v_new then
      return new;
    end if;
  end if;

  insert into public.audit_logs (user_id, user_email, action, module, table_name, record_id, old_value, new_value)
  values (
    auth.uid(),
    (select email from public.profiles where id = auth.uid()),
    lower(tg_op),
    tg_argv[0],
    tg_table_name,
    v_record_id,
    v_old,
    v_new
  );

  if (tg_op = 'DELETE') then
    return old;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- New auth user -> profile
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, email, status)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    'active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Attach row-stamp and audit triggers
-- ---------------------------------------------------------------------

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('branches', 'settings'),
      ('warehouses', 'settings'),
      ('warehouse_locations', 'settings'),
      ('profiles', 'users'),
      ('roles', 'users'),
      ('system_settings', 'settings')
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

-- role_permissions and user_roles carry no updated_at, audit only.
do $$
declare
  t record;
begin
  for t in
    select * from (values ('role_permissions'), ('user_roles')) as x(tbl)
  loop
    execute format('drop trigger if exists trg_%1$s_audit on public.%1$I', t.tbl);
    execute format(
      'create trigger trg_%1$s_audit after insert or update or delete on public.%1$I
         for each row execute function public.fn_audit(''users'')', t.tbl);
  end loop;
end;
$$;
