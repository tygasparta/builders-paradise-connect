import { db, unwrap } from "@/lib/supabase";
import type { PermissionRow, ProfileRow, RoleRow, UserStatus } from "@/lib/database.types";

export type UserRoleAssignment = {
  id: string;
  role_id: string;
  branch_id: string | null;
  role: Pick<RoleRow, "id" | "code" | "name" | "rank"> | null;
  branch: { id: string; code: string; name: string } | null;
};

export type UserWithRoles = ProfileRow & {
  user_roles: UserRoleAssignment[];
  default_branch: { id: string; name: string } | null;
};

export async function listUsers(): Promise<UserWithRoles[]> {
  return unwrap(
    await db
      .from("profiles")
      .select(
        `*,
         default_branch:branches!profiles_default_branch_id_fkey(id, name),
         user_roles(id, role_id, branch_id,
           role:roles(id, code, name, rank),
           branch:branches(id, code, name))`,
      )
      .order("full_name"),
  ) as unknown as UserWithRoles[];
}

export async function listRoles(): Promise<RoleRow[]> {
  return unwrap(await db.from("roles").select("*").order("rank").order("name")) as RoleRow[];
}

export async function listPermissions(): Promise<PermissionRow[]> {
  return unwrap(
    await db.from("permissions").select("*").order("module").order("code"),
  ) as PermissionRow[];
}

export async function listRolePermissionIds(roleId: string): Promise<string[]> {
  const rows = unwrap(
    await db.from("role_permissions").select("permission_id").eq("role_id", roleId),
  ) as { permission_id: string }[];
  return rows.map((row) => row.permission_id);
}

export async function updateUserProfile(
  id: string,
  values: {
    full_name: string;
    employee_code: string | null;
    phone: string | null;
    job_title: string | null;
    default_branch_id: string | null;
    default_warehouse_id: string | null;
  },
): Promise<ProfileRow> {
  const rows = unwrap(await db.from("profiles").update(values).eq("id", id).select("*")) as ProfileRow[];
  const updated = rows[0];
  if (!updated) {
    throw new Error("The user could not be updated. You may not have permission.");
  }
  return updated;
}

export async function setUserStatus(id: string, status: UserStatus): Promise<void> {
  const rows = unwrap(
    await db
      .from("profiles")
      // Reactivating clears the lockout counters so the user can sign in again.
      .update(
        status === "active"
          ? { status, failed_login_count: 0, locked_until: null }
          : { status },
      )
      .eq("id", id)
      .select("id"),
  ) as { id: string }[];
  if (rows.length === 0) {
    throw new Error("The account status could not be changed. You may not have permission.");
  }
}

export async function assignRole(
  userId: string,
  roleId: string,
  branchId: string | null,
): Promise<void> {
  unwrap(
    await db
      .from("user_roles")
      .insert({ user_id: userId, role_id: roleId, branch_id: branchId })
      .select("id"),
  );
}

export async function revokeRole(assignmentId: string): Promise<void> {
  const { error } = await db.from("user_roles").delete().eq("id", assignmentId);
  if (error) throw new Error(error.message);
}

/**
 * Creating an auth user needs the service-role key, which must never reach
 * the browser. The `invite-user` Edge Function holds it server-side; see
 * supabase/functions/invite-user/.
 */
export async function inviteUser(input: {
  email: string;
  full_name: string;
  role_id: string;
  branch_id: string | null;
}): Promise<{ userId: string }> {
  const { data, error } = await db.functions.invoke<{ userId: string }>("invite-user", {
    body: input,
  });

  if (error) {
    throw new Error(
      "Invitations need the 'invite-user' Edge Function. Deploy it with `supabase functions deploy invite-user`, " +
        "or add the user in the Supabase dashboard under Authentication → Users.",
    );
  }
  if (!data?.userId) {
    throw new Error("The invitation did not complete. Try again.");
  }
  return data;
}
