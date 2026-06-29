/**
 * Restore is_shared using migration backfill rules (038).
 * Ongoing sync is handled by DB trigger trg_project_shared (039).
 *
 *   npm run restore-shared-project -- --confirm
 *
 * ENV (frontend/.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

/** Known shared projects — keep in sync with 038_restore_project_sharing.sql */
const KNOWN_SHARED_PROJECT_IDS = [
  "6e5d8a93-c1c3-46f8-9770-9f5049094424", // Dashboard Project
];

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("Pass --confirm to run the update.");
    process.exit(1);
  }

  const supabase = createAdminClient();

  let invitedProjectIds: string[] = [];
  const { data: invitedProjects, error: invitedError } = await supabase
    .from("project_users")
    .select("project_id");

  if (invitedError) {
    const message = invitedError.message.toLowerCase();
    if (
      !message.includes("project_users") &&
      !message.includes("schema cache")
    ) {
      throw new Error(`Failed to load project_users: ${invitedError.message}`);
    }
  } else {
    invitedProjectIds = [
      ...new Set(
        (invitedProjects ?? []).map((row) => row.project_id).filter(Boolean)
      ),
    ];
  }

  const targetIds = [
    ...new Set([...KNOWN_SHARED_PROJECT_IDS, ...invitedProjectIds]),
  ];

  if (targetIds.length > 0) {
    const { error: updateError } = await supabase
      .from("projects")
      .update({ is_shared: true })
      .in("id", targetIds)
      .eq("is_shared", false);

    if (updateError) {
      throw new Error(`UPDATE failed: ${updateError.message}`);
    }
  }

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, is_shared")
    .order("name");

  if (error) {
    throw new Error(`SELECT failed: ${error.message}`);
  }

  console.log("UPDATE ok");
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
