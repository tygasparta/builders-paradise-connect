-- =====================================================================
-- Bootstrap the first Super Administrator
--
-- The database deliberately refuses to let anyone grant a role to their
-- own account (fn_guard_self_role_grant), and granting roles at all
-- needs users.roles.assign — which nobody holds on a fresh install.
-- That deadlock is intentional: the first administrator is created out
-- of band, here, by someone with database access.
--
-- HOW TO USE
--   1. Create the user first, in Supabase Dashboard > Authentication >
--      Users > "Add user" (set a password, tick "Auto Confirm User").
--   2. Put that email in the line below.
--   3. Run this file in the SQL Editor.
--
-- Running it in the SQL Editor works because auth.uid() is null there,
-- so the self-grant guard does not fire.
-- =====================================================================

do $$
declare
  -- >>> CHANGE THIS to the email you created in step 1 <<<
  v_email      citext := 'onismotechlab@gmail.com';
  v_user_id    uuid;
  v_role_id    uuid;
  v_branch_id  uuid;
begin
  select id into v_user_id from auth.users where email = v_email;
  if v_user_id is null then
    raise exception
      'No auth user with email %. Create the user in Authentication > Users first.', v_email;
  end if;

  -- handle_new_user() normally creates this; make sure it exists for
  -- users that predate the migration.
  insert into public.profiles (id, full_name, email, status)
  values (v_user_id, split_part(v_email::text, '@', 1), v_email, 'active')
  on conflict (id) do update set status = 'active';

  select id into v_role_id from public.roles where code = 'super_admin';
  if v_role_id is null then
    raise exception 'super_admin role missing — run the migrations first.';
  end if;

  insert into public.user_roles (user_id, role_id, branch_id)
  values (v_user_id, v_role_id, null)
  on conflict do nothing;

  -- Point them at the head office branch and its default warehouse.
  select id into v_branch_id from public.branches where is_head_office limit 1;
  if v_branch_id is not null then
    update public.profiles
       set default_branch_id    = v_branch_id,
           default_warehouse_id = (
             select id from public.warehouses
             where branch_id = v_branch_id and is_default limit 1
           )
     where id = v_user_id;
  end if;

  raise notice 'Super Administrator bootstrapped for % (%).', v_email, v_user_id;
end;
$$;
