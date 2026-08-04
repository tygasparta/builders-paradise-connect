-- =====================================================================
-- Builders Paradise ERP — Phase 1: Row Level Security
--
-- The database is the authority on access, not the UI. Hiding a button
-- is a courtesy; these policies are the enforcement.
-- =====================================================================

alter table public.branches            enable row level security;
alter table public.warehouses          enable row level security;
alter table public.warehouse_locations enable row level security;
alter table public.profiles            enable row level security;
alter table public.roles               enable row level security;
alter table public.permissions         enable row level security;
alter table public.role_permissions    enable row level security;
alter table public.user_roles          enable row level security;
alter table public.system_settings     enable row level security;
alter table public.audit_logs          enable row level security;
alter table public.login_attempts      enable row level security;
alter table public.notifications       enable row level security;

-- Force RLS even for the table owner, so a stray definer function
-- cannot quietly read around the policies.
alter table public.audit_logs force row level security;

-- ---------------------------------------------------------------------
-- Branches
-- ---------------------------------------------------------------------
drop policy if exists branches_select on public.branches;
create policy branches_select on public.branches
  for select to authenticated
  using (public.is_active_user());

drop policy if exists branches_insert on public.branches;
create policy branches_insert on public.branches
  for insert to authenticated
  with check (public.has_permission('settings.branches.manage'));

drop policy if exists branches_update on public.branches;
create policy branches_update on public.branches
  for update to authenticated
  using (public.has_permission('settings.branches.manage'))
  with check (public.has_permission('settings.branches.manage'));

-- No delete policy: branches are deactivated, never deleted.

-- ---------------------------------------------------------------------
-- Warehouses
-- ---------------------------------------------------------------------
drop policy if exists warehouses_select on public.warehouses;
create policy warehouses_select on public.warehouses
  for select to authenticated
  using (public.is_active_user());

drop policy if exists warehouses_insert on public.warehouses;
create policy warehouses_insert on public.warehouses
  for insert to authenticated
  with check (public.has_permission('warehouses.manage'));

drop policy if exists warehouses_update on public.warehouses;
create policy warehouses_update on public.warehouses
  for update to authenticated
  using (public.has_permission('warehouses.manage'))
  with check (public.has_permission('warehouses.manage'));

drop policy if exists warehouse_locations_select on public.warehouse_locations;
create policy warehouse_locations_select on public.warehouse_locations
  for select to authenticated
  using (public.is_active_user());

drop policy if exists warehouse_locations_write on public.warehouse_locations;
create policy warehouse_locations_write on public.warehouse_locations
  for all to authenticated
  using (public.has_permission('warehouses.manage'))
  with check (public.has_permission('warehouses.manage'));

-- ---------------------------------------------------------------------
-- Profiles
--
-- Everyone can read the directory (needed to render "created by" and
-- assignee pickers). Only users.update can edit someone else.
-- ---------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_active_user());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.has_permission('users.update'))
  with check (public.has_permission('users.update'));

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin on public.profiles
  for insert to authenticated
  with check (public.has_permission('users.create'));

-- A user must not be able to promote themselves by editing their own row.
-- Status and employee_code are locked down by trigger below.
create or replace function public.fn_guard_profile_self_edit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;  -- service role / SQL editor
  end if;

  if new.id = auth.uid() and not public.has_permission('users.update') then
    if new.status is distinct from old.status then
      raise exception 'You cannot change your own account status';
    end if;
    if new.employee_code is distinct from old.employee_code then
      raise exception 'You cannot change your own employee code';
    end if;
    if new.failed_login_count is distinct from old.failed_login_count
       or new.locked_until is distinct from old.locked_until then
      raise exception 'You cannot change your own lockout state';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.fn_guard_profile_self_edit();

-- ---------------------------------------------------------------------
-- Roles and permissions
-- ---------------------------------------------------------------------
drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select to authenticated
  using (public.is_active_user());

drop policy if exists roles_insert on public.roles;
create policy roles_insert on public.roles
  for insert to authenticated
  with check (public.has_permission('roles.manage') and not is_system);

drop policy if exists roles_update on public.roles;
create policy roles_update on public.roles
  for update to authenticated
  using (public.has_permission('roles.manage'))
  with check (public.has_permission('roles.manage'));

drop policy if exists roles_delete on public.roles;
create policy roles_delete on public.roles
  for delete to authenticated
  using (public.has_permission('roles.manage') and not is_system);

drop policy if exists permissions_select on public.permissions;
create policy permissions_select on public.permissions
  for select to authenticated
  using (public.is_active_user());

-- The permission catalogue itself is fixed by migration, never by users.

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using (public.is_active_user());

drop policy if exists role_permissions_write on public.role_permissions;
create policy role_permissions_write on public.role_permissions
  for all to authenticated
  using (public.has_permission('roles.manage'))
  with check (public.has_permission('roles.manage'));

-- Renaming or deleting a system role is blocked outright.
create or replace function public.fn_guard_system_role()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system then
      raise exception 'System role "%" cannot be deleted', old.code;
    end if;
    return old;
  end if;

  if old.is_system and (new.code is distinct from old.code or new.is_system is distinct from old.is_system) then
    raise exception 'System role "%" cannot be renamed or downgraded', old.code;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_roles_guard on public.roles;
create trigger trg_roles_guard
  before update or delete on public.roles
  for each row execute function public.fn_guard_system_role();

-- ---------------------------------------------------------------------
-- User role assignments
-- ---------------------------------------------------------------------
drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('users.view'));

drop policy if exists user_roles_write on public.user_roles;
create policy user_roles_write on public.user_roles
  for all to authenticated
  using (public.has_permission('users.roles.assign'))
  with check (public.has_permission('users.roles.assign'));

-- Nobody may grant themselves a role, regardless of permissions.
create or replace function public.fn_guard_self_role_grant()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and new.user_id = auth.uid() then
    raise exception 'You cannot assign a role to your own account';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_user_roles_guard on public.user_roles;
create trigger trg_user_roles_guard
  before insert or update on public.user_roles
  for each row execute function public.fn_guard_self_role_grant();

-- ---------------------------------------------------------------------
-- Company settings
-- ---------------------------------------------------------------------
drop policy if exists system_settings_select on public.system_settings;
create policy system_settings_select on public.system_settings
  for select to authenticated
  using (public.is_active_user());

drop policy if exists system_settings_update on public.system_settings;
create policy system_settings_update on public.system_settings
  for update to authenticated
  using (public.has_permission('settings.company.manage'))
  with check (public.has_permission('settings.company.manage'));

-- ---------------------------------------------------------------------
-- Audit trail — readable by auditors, writable by nobody
--
-- No insert/update/delete policy exists for `authenticated`. Rows arrive
-- only through SECURITY DEFINER triggers, so the trail cannot be forged
-- or rewritten from the client.
-- ---------------------------------------------------------------------
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (public.has_permission('audit.view'));

drop policy if exists login_attempts_select on public.login_attempts;
create policy login_attempts_select on public.login_attempts
  for select to authenticated
  using (public.has_permission('audit.view'));

-- Failed-login recording happens before a session exists, so the write
-- goes through a definer function rather than a policy.
create or replace function public.record_login_attempt(p_email text, p_succeeded boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
begin
  insert into public.login_attempts (email, succeeded) values (lower(p_email), p_succeeded);

  select * into v_profile from public.profiles where email = lower(p_email);
  if not found then
    return;
  end if;

  if p_succeeded then
    update public.profiles
       set last_login_at = now(), failed_login_count = 0, locked_until = null
     where id = v_profile.id;

    insert into public.audit_logs (user_id, user_email, action, module)
    values (v_profile.id, v_profile.email, 'login', 'auth');
  else
    update public.profiles
       set failed_login_count = failed_login_count + 1,
           -- Five strikes locks the account for 15 minutes.
           locked_until = case when failed_login_count + 1 >= 5 then now() + interval '15 minutes' else locked_until end
     where id = v_profile.id;

    insert into public.audit_logs (user_id, user_email, action, module)
    values (v_profile.id, v_profile.email, 'login_failed', 'auth');
  end if;
end;
$$;

grant execute on function public.record_login_attempt(text, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    user_id = auth.uid()
    or (permission_code is not null and public.has_permission(permission_code))
  );

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
