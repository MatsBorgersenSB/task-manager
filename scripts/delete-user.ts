/**
 * Delete a Supabase Auth user by email (service role / admin API).
 *
 * RUN:
 *   cd frontend
 *   npm install
 *   npm run delete-user -- sebastian@carbonemergente.com --confirm
 *
 * ENV (frontend/.env.local — never commit):
 *   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
 *
 * WARNING: Service role bypasses RLS. Server/scripts only — never expose to the browser.
 */

import { createClient } from "@supabase/supabase-js";

const DEFAULT_PER_PAGE = 200;

function printUsage() {
  console.log(`
Usage:
  npm run delete-user -- <email> --confirm

Example:
  npm run delete-user -- sebastian@carbonemergente.com --confirm

Required env (frontend/.env.local):
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
`);
}

function printSqlFallback(email: string) {
  const safeEmail = email.replace(/'/g, "''");
  console.log(`
ℹ️  User not found in auth.users. If only a profile row exists, run in Supabase SQL Editor:

  DELETE FROM public.profiles WHERE lower(email) = lower('${safeEmail}');

Then check Authentication → Users again, or contact Supabase support if the auth row is stuck.
`);
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function findUserByEmail(email: string) {
  const admin = createAdminClient();
  const target = email.trim().toLowerCase();
  let page = 1;
  let scanned = 0;

  console.log(`🔍 Fetching auth users (searching for ${target})…`);

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: DEFAULT_PER_PAGE,
    });

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    const users = data.users ?? [];
    scanned += users.length;

    const match = users.find(
      (user) => (user.email ?? "").trim().toLowerCase() === target
    );

    if (match) {
      console.log(`✅ User found (scanned ${scanned} account(s))`);
      console.log(`   Email:   ${match.email}`);
      console.log(`   User ID: ${match.id}`);
      return { admin, user: match };
    }

    if (users.length < DEFAULT_PER_PAGE) {
      console.log(`   Scanned ${scanned} account(s) — no match.`);
      return null;
    }

    page += 1;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const email = args.find((arg) => !arg.startsWith("-"));

  if (!email || args.includes("--help")) {
    printUsage();
    process.exit(email ? 0 : 1);
  }

  if (!confirm) {
    console.error("❌ Aborted: pass --confirm to delete permanently.");
    console.error(`   Target: ${email}`);
    process.exit(1);
  }

  try {
    const found = await findUserByEmail(email);

    if (!found) {
      console.error(`❌ No auth user with email: ${email.trim().toLowerCase()}`);
      printSqlFallback(email.trim());
      process.exit(1);
    }

    const { admin, user } = found;

    console.log(`🗑️  Deleting user ${user.id}…`);

    const { error } = await admin.auth.admin.deleteUser(user.id);

    if (error) {
      console.error(`❌ deleteUser failed: ${error.message}`);
      console.error(`   User ID: ${user.id}`);
      process.exit(1);
    }

    console.log("✅ Deletion successful");
    console.log(`   Email:   ${user.email}`);
    console.log(`   User ID: ${user.id}`);
    process.exit(0);
  } catch (err) {
    console.error(
      "❌ Error:",
      err instanceof Error ? err.message : String(err)
    );
    process.exit(1);
  }
}

void main();
