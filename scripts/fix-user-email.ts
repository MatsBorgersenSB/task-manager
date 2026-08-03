/**
 * Correct a user email across auth.users and public tables.
 *
 * RUN (dry run):
 *   cd frontend
 *   npm run fix-user-email -- --from operaciones@carbonemergemte.com --to operaciones@carbonemergente.com
 *
 * RUN (apply):
 *   npm run fix-user-email -- --from operaciones@carbonemergemte.com --to operaciones@carbonemergente.com --confirm
 */

import { createClient } from "@supabase/supabase-js";

function parseArgs() {
  const args = process.argv.slice(2);
  let from = "";
  let to = "";
  let confirm = false;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--from") from = args[i + 1] ?? "";
    if (args[i] === "--to") to = args[i + 1] ?? "";
    if (args[i] === "--confirm") confirm = true;
  }
  return {
    from: from.trim().toLowerCase(),
    to: to.trim().toLowerCase(),
    confirm,
  };
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length > 0) {
    throw new Error(
      `Missing required env var(s): ${missing.join(", ")}.\n` +
        `Add them to frontend/.env.local (the SERVICE_ROLE key is server-only).\n` +
        `Detected: NEXT_PUBLIC_SUPABASE_URL=${url ? "set" : "MISSING"}, ` +
        `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey ? "set" : "MISSING"}.`
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function findAuthUserId(admin: ReturnType<typeof createAdminClient>, email: string) {
  const target = email.trim().toLowerCase();
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data.users ?? [];
    const match = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) return match.id;
    if (users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  const { from, to, confirm } = parseArgs();
  if (!from || !to) {
    console.error(
      "Usage: npm run fix-user-email -- --from old@email.com --to new@email.com [--confirm]"
    );
    process.exit(1);
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, role")
    .ilike("email", from)
    .maybeSingle();

  const authUserId = (await findAuthUserId(admin, from)) ?? profile?.id ?? null;

  if (!authUserId && !profile) {
    console.error(`No user found with email ${from}`);
    process.exit(1);
  }

  const userId = profile?.id ?? authUserId!;

  const { data: conflict } = await admin
    .from("profiles")
    .select("id, email")
    .ilike("email", to)
    .neq("id", userId)
    .maybeSingle();

  if (conflict) {
    console.error(`Cannot update: ${to} is already used by profile ${conflict.id}`);
    process.exit(1);
  }

  const conflictAuth = await findAuthUserId(admin, to);
  if (conflictAuth && conflictAuth !== userId) {
    console.error(`Cannot update: ${to} is already used in auth.users (${conflictAuth})`);
    process.exit(1);
  }

  const { count: projectUsers } = await admin
    .from("project_users")
    .select("id", { count: "exact", head: true })
    .ilike("email", from);

  const { count: invites } = await admin
    .from("invites")
    .select("id", { count: "exact", head: true })
    .ilike("email", from);

  console.log("\n=== Email correction plan ===");
  console.log("User ID:", userId);
  console.log("From:", from);
  console.log("To:", to);
  console.log("project_users rows:", projectUsers ?? 0);
  console.log("invites rows:", invites ?? 0);
  console.log("auth.users:", authUserId ? "will update" : "not found (public tables only)");

  if (!confirm) {
    console.log("\nDry run only. Re-run with --confirm to apply.\n");
    return;
  }

  if (authUserId) {
    const { error: authError } = await admin.auth.admin.updateUserById(authUserId, {
      email: to,
      email_confirm: true,
    });
    if (authError) {
      throw new Error(`auth.users update failed: ${authError.message}`);
    }
    console.log("✓ auth.users updated");
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ email: to })
    .eq("id", userId);
  if (profileError) throw profileError;
  console.log("✓ profiles updated");

  const { error: puError } = await admin
    .from("project_users")
    .update({ email: to })
    .ilike("email", from);
  if (puError) throw puError;
  console.log("✓ project_users updated");

  const { error: inviteError } = await admin
    .from("invites")
    .update({ email: to })
    .ilike("email", from);
  if (inviteError) throw inviteError;
  console.log("✓ invites updated");

  const { error: taskError } = await admin
    .from("tasks")
    .update({ updated_by: to })
    .ilike("updated_by", from);
  if (taskError) throw taskError;
  console.log("✓ tasks.updated_by updated");

  console.log("\nEmail correction complete. User can sign in with:", to, "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
