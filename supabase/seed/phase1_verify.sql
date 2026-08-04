-- =====================================================================
-- Builders Paradise ERP — Phase 1 signed-in verification
--
-- Impersonates a real user inside Postgres the same way PostgREST does
-- (role `authenticated` + request.jwt.claims), so Row Level Security is
-- enforced exactly as it would be for a live session. No password needed.
--
-- SAFE TO RUN ON PRODUCTION:
--   * The only mutation is a branch phone number, which is changed to a
--     marker and then restored to its original value in the same block.
--   * That leaves two genuine audit_logs entries — which is the point:
--     check 10 proves the audit trail records real changes.
--   * Nothing else is created, altered or deleted.
--
-- Paste into Supabase → SQL Editor → Run. Read the `pass` column.
-- =====================================================================

create temp table if not exists _v (
  step     text,
  expected text,
  actual   text,
  pass     boolean
);
truncate _v;

do $$
declare
  v_admin        uuid;
  v_status       text;
  v_n            integer;
  v_role_id      uuid;
  v_branch       uuid;
  v_phone_before text;
  v_audit_before integer;
  v_audit_after  integer;
  v_new_value    text;
begin
  ------------------------------------------------------------------
  -- 1 & 2. Did the bootstrap work?
  ------------------------------------------------------------------
  select id, status into v_admin, v_status
  from public.profiles
  where email = 'onismotechlab@gmail.com';

  insert into _v values (
    '1. bootstrap: profile exists and is active',
    'active', coalesce(v_status, 'NO PROFILE ROW'), coalesce(v_status, '') = 'active');

  if v_admin is null then
    insert into _v values ('ABORTED', 'a profile', 'none found — run bootstrap_super_admin.sql', false);
    return;
  end if;

  select count(*) into v_n
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = v_admin and r.code = 'super_admin';

  insert into _v values (
    '2. bootstrap: super_admin role assigned', '1', v_n::text, v_n = 1);

  if v_n <> 1 then
    insert into _v values ('ABORTED', 'super_admin', 'not assigned — run bootstrap_super_admin.sql', false);
    return;
  end if;

  ------------------------------------------------------------------
  -- 3. RLS grants: the administrator can read the organisation.
  ------------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into v_n from public.branches;

  execute 'reset role';
  insert into _v values ('3. RLS: super admin reads branches', '3', v_n::text, v_n = 3);

  ------------------------------------------------------------------
  -- 4. RLS denies: a signed-in identity with no profile sees nothing.
  --    This is the path a deactivated or unknown account takes.
  ------------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-0000000000ff', 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into v_n from public.branches;

  execute 'reset role';
  insert into _v values ('4. RLS: unknown/inactive user reads branches', '0', v_n::text, v_n = 0);

  ------------------------------------------------------------------
  -- 5. The permission helper answers correctly for a real user.
  ------------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into v_n from public.my_permissions();

  execute 'reset role';
  insert into _v values ('5. my_permissions() for super admin', '151', v_n::text, v_n = 151);

  ------------------------------------------------------------------
  -- 6 & 7. Least privilege actually bites: a cashier is not an admin.
  ------------------------------------------------------------------
  select count(*) into v_n
  from public.role_permissions rp
  join public.roles r on r.id = rp.role_id
  join public.permissions p on p.id = rp.permission_id
  where r.code = 'cashier' and p.code = 'products.cost_price.view';

  insert into _v values (
    '6. cashier CANNOT view cost prices', '0', v_n::text, v_n = 0);

  select count(*) into v_n
  from public.role_permissions rp
  join public.roles r on r.id = rp.role_id
  join public.permissions p on p.id = rp.permission_id
  where r.code = 'cashier' and p.code in ('pos.operate', 'settings.branches.manage', 'journals.post');

  insert into _v values (
    '7. cashier has pos.operate but no admin/finance rights', '1', v_n::text, v_n = 1);

  ------------------------------------------------------------------
  -- 8. Trigger: nobody may grant a role to their own account,
  --    even holding users.roles.assign.
  ------------------------------------------------------------------
  select id into v_role_id from public.roles where code = 'auditor';

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  begin
    insert into public.user_roles (user_id, role_id, branch_id)
    values (v_admin, v_role_id, null);
    execute 'reset role';
    insert into _v values ('8. trigger: self role-grant blocked', 'rejected', 'ALLOWED', false);
    -- Undo it; the guard failed to hold.
    delete from public.user_roles where user_id = v_admin and role_id = v_role_id;
  exception when others then
    execute 'reset role';
    insert into _v values ('8. trigger: self role-grant blocked', 'rejected', 'rejected: ' || SQLERRM, true);
  end;

  ------------------------------------------------------------------
  -- 9. Trigger: a system role cannot be renamed out from under the app.
  ------------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  begin
    update public.roles set code = 'cashier_renamed' where code = 'cashier';
    execute 'reset role';
    insert into _v values ('9. trigger: system role rename blocked', 'rejected', 'ALLOWED', false);
    update public.roles set code = 'cashier' where code = 'cashier_renamed';
  exception when others then
    execute 'reset role';
    insert into _v values ('9. trigger: system role rename blocked', 'rejected', 'rejected: ' || SQLERRM, true);
  end;

  ------------------------------------------------------------------
  -- 10. Audit trail: a real edit is recorded, with before and after.
  --     The phone number is restored immediately afterwards.
  ------------------------------------------------------------------
  select id, phone into v_branch, v_phone_before
  from public.branches where code = 'HQ';

  select count(*) into v_audit_before
  from public.audit_logs where table_name = 'branches';

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  update public.branches set phone = '+263 000 VERIFY' where id = v_branch;

  execute 'reset role';

  select count(*) into v_audit_after
  from public.audit_logs where table_name = 'branches';

  select new_value ->> 'phone' into v_new_value
  from public.audit_logs
  where table_name = 'branches' and record_id = v_branch::text
  order by created_at desc limit 1;

  insert into _v values (
    '10a. audit: branch edit created a log row',
    '1 new row', (v_audit_after - v_audit_before)::text || ' new row(s)',
    v_audit_after = v_audit_before + 1);

  insert into _v values (
    '10b. audit: log captured the new value',
    '+263 000 VERIFY', coalesce(v_new_value, 'NOT CAPTURED'),
    v_new_value = '+263 000 VERIFY');

  insert into _v
  select '10c. audit: log records who made the change',
         'onismotechlab@gmail.com', coalesce(user_email, 'NOT CAPTURED'),
         user_email = 'onismotechlab@gmail.com'
  from public.audit_logs
  where table_name = 'branches' and record_id = v_branch::text
  order by created_at desc limit 1;

  -- Restore the original value.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.branches set phone = v_phone_before where id = v_branch;
  execute 'reset role';

  insert into _v
  select '10d. cleanup: phone restored', coalesce(v_phone_before, '(null)'),
         coalesce(phone, '(null)'), phone is not distinct from v_phone_before
  from public.branches where id = v_branch;

end $$;

select
  step,
  expected,
  actual,
  case when pass then 'PASS' else 'FAIL' end as result
from _v
order by step;
