/**
 * Read-only audit: find where an email appears across auth + public tables.
 *
 * RUN:
 *   cd frontend
 *   npm run audit-user-email -- operaciones@carbonemergemte.com
 */

import { createClient } from "@supabase/supabase-js";

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

async function findAuthUser(admin: ReturnType<typeof createAdminClient>, email: string) {
  const target = email.trim().toLowerCase();
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data.users ?? [];
    const match = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) return match;
    if (users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run audit-user-email -- <email>");
    process.exit(1);
  }

  const admin = createAdminClient();

  console.log(`\n=== Email audit: ${email} ===\n`);

  const authUser = await findAuthUser(admin, email);
  console.log("auth.users:", authUser ? { id: authUser.id, email: authUser.email, last_sign_in_at: authUser.last_sign_in_at } : "not found");

  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, role, created_at, last_login_at, last_activity_at")
    .ilike("email", email)
    .maybeSingle();
  console.log("profiles:", profile ?? "not found");

  const { data: projectUsers } = await admin
    .from("project_users")
    .select("id, project_id, email, role, created_at, projects(name)")
    .ilike("email", email);
  console.log("project_users:", projectUsers?.length ?? 0, projectUsers ?? []);

  const { data: invites } = await admin
    .from("invites")
    .select("id, email, role, created_at")
    .ilike("email", email);
  console.log("invites:", invites?.length ?? 0, invites ?? []);

  const userId = profile?.id ?? authUser?.id;
  if (userId) {
    const { count: commentCount } = await admin
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    console.log("comments (by user_id):", commentCount ?? 0);

    const { count: sessionCount } = await admin
      .from("user_login_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    console.log("user_login_sessions:", sessionCount ?? 0);

    const { count: notificationCount } = await admin
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    console.log("user_notifications:", notificationCount ?? 0);
  }

  const { count: tasksUpdatedBy } = await admin
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .ilike("updated_by", email);
  console.log("tasks.updated_by:", tasksUpdatedBy ?? 0);

  const { count: feedCount } = await admin
    .from("project_activity")
    .select("id", { count: "exact", head: true })
    .ilike("summary", `%${email}%`);
  console.log("project_activity (summary contains email):", feedCount ?? 0);

  const { data: auditHits } = await admin
    .from("audit_logs")
    .select("id, action, metadata, created_at")
    .or(`metadata->>target_email.ilike.${email},metadata->>email.ilike.${email}`)
    .limit(20);
  console.log("audit_logs (metadata email):", auditHits?.length ?? 0, auditHits ?? []);

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
