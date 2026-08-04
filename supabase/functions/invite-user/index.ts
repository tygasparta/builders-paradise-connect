/**
 * invite-user — creates an auth user and assigns their first role.
 *
 * Creating users requires the service-role key, which must never reach the
 * browser. It lives only in this function's environment. The caller's own
 * JWT is checked against `users.create` and `users.roles.assign` before
 * anything happens, so this endpoint grants no privilege the caller does
 * not already hold in the database.
 *
 * Deploy:
 *   supabase functions deploy invite-user
 *
 * SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are
 * injected by the platform — do not add them to any .env in this repo.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "Function is not configured" }, 500);
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return json({ error: "Not signed in" }, 401);

  // Caller's client: runs as the caller, so RLS and permissions apply.
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return json({ error: "Not signed in" }, 401);

  const [canCreate, canAssign] = await Promise.all([
    caller.rpc("has_permission", { p_code: "users.create" }),
    caller.rpc("has_permission", { p_code: "users.roles.assign" }),
  ]);
  if (canCreate.error || canAssign.error) {
    return json({ error: "Permission check failed" }, 500);
  }
  if (!canCreate.data || !canAssign.data) {
    return json({ error: "You do not have permission to invite users" }, 403);
  }

  let body: { email?: string; full_name?: string; role_id?: string; branch_id?: string | null };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  const fullName = body.full_name?.trim();
  const roleId = body.role_id;
  const branchId = body.branch_id ?? null;

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: "Enter a valid email address" }, 400);
  }
  if (!fullName || fullName.length < 2) return json({ error: "Enter the person's full name" }, 400);
  if (!roleId) return json({ error: "Choose a role for the new user" }, 400);

  // Admin client: service role, used only after the checks above passed.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const siteUrl = Deno.env.get("SITE_URL");
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    ...(siteUrl ? { redirectTo: `${siteUrl}/reset-password` } : {}),
  });

  if (inviteError || !invited.user) {
    return json({ error: inviteError?.message ?? "The invitation could not be sent" }, 400);
  }

  const userId = invited.user.id;

  // handle_new_user() creates the profile; make sure the name landed.
  await admin.from("profiles").update({ full_name: fullName, status: "invited" }).eq("id", userId);

  const { error: roleError } = await admin
    .from("user_roles")
    .insert({ user_id: userId, role_id: roleId, branch_id: branchId, created_by: userData.user.id });

  if (roleError) {
    return json(
      { error: `User created, but the role could not be assigned: ${roleError.message}`, userId },
      207,
    );
  }

  // The generic audit trigger cannot see who acted here, so record it.
  await admin.from("audit_logs").insert({
    user_id: userData.user.id,
    user_email: userData.user.email,
    action: "insert",
    module: "users",
    table_name: "profiles",
    record_id: userId,
    new_value: { email, full_name: fullName, role_id: roleId, branch_id: branchId },
    reason: "User invited via invite-user function",
  });

  return json({ userId });
});
