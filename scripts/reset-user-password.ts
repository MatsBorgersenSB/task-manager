/**
 * Admin password reset for Supabase Auth users (service role).
 *
 * SET PASSWORD DIRECTLY (fastest — no email needed):
 *   npm run reset-user-password -- --email sebastian@carbonemergente.com --password "NewPass123!" --confirm
 *
 * GENERATE RECOVERY LINK (print link — no email SMTP required):
 *   npm run reset-user-password -- --email sebastian@carbonemergente.com --recovery-link --confirm
 *
 * BY USER ID (from Supabase dashboard):
 *   npm run reset-user-password -- --user-id 9f7e5018-1a29-45cd-b332-3ede4f9b606e --password "NewPass123!" --confirm
 *
 * ENV (frontend/.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const DEFAULT_PER_PAGE = 200;

function printUsage() {
  console.log(`
Usage (pick one action):

  Set password directly:
    npm run reset-user-password -- --email USER@DOMAIN.com --password "NewPass123!" --confirm

  Print recovery link (open in browser — no email required):
    npm run reset-user-password -- --email USER@DOMAIN.com --recovery-link --confirm

  By user ID from Supabase dashboard:
    npm run reset-user-password -- --user-id UUID --password "NewPass123!" --confirm

Required: --confirm
Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
`);
}

function getArg(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) return undefined;
  return args[index + 1];
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function findUserByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  const target = email.trim().toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: DEFAULT_PER_PAGE,
    });

    if (error) throw new Error(`Failed to list users: ${error.message}`);

    const users = data.users ?? [];
    const match = users.find(
      (user) => (user.email ?? "").trim().toLowerCase() === target
    );

    if (match) return match;
    if (users.length < DEFAULT_PER_PAGE) return null;
    page += 1;
  }
}

async function resolveUserId(
  admin: ReturnType<typeof createAdminClient>,
  email?: string,
  userId?: string
) {
  if (userId) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user) {
      throw new Error(`No user with ID: ${userId}`);
    }
    console.log("✅ User found by ID");
    console.log(`   Email:   ${data.user.email}`);
    console.log(`   User ID: ${data.user.id}`);
    return data.user;
  }

  if (!email) {
    throw new Error("Provide --email or --user-id.");
  }

  console.log(`🔍 Looking up: ${email.trim().toLowerCase()}`);
  const user = await findUserByEmail(admin, email);

  if (!user) {
    throw new Error(`No auth user found with email: ${email.trim().toLowerCase()}`);
  }

  console.log("✅ User found");
  console.log(`   Email:   ${user.email}`);
  console.log(`   User ID: ${user.id}`);
  return user;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.length === 0) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  if (!args.includes("--confirm")) {
    console.error("❌ Aborted: pass --confirm to proceed.");
    process.exit(1);
  }

  const email = getArg(args, "--email");
  const userId = getArg(args, "--user-id");
  const password = getArg(args, "--password");
  const recoveryLink = args.includes("--recovery-link");

  if (!password && !recoveryLink) {
    console.error("❌ Provide --password or --recovery-link.");
    printUsage();
    process.exit(1);
  }

  if (password && password.length < 8) {
    console.error("❌ Password must be at least 8 characters.");
    process.exit(1);
  }

  try {
    const admin = createAdminClient();
    const user = await resolveUserId(admin, email, userId);

    if (recoveryLink) {
      const redirectTo =
        process.env.NEXT_PUBLIC_RESET_PASSWORD_REDIRECT ??
        "https://task-manager-theta-heppa-42.vercel.app/auth/callback?next=/reset-password";

      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: user.email!,
        options: { redirectTo },
      });

      if (error) {
        console.error(`❌ generateLink failed: ${error.message}`);
        process.exit(1);
      }

      const link =
        data.properties?.action_link ?? data.properties?.hashed_token ?? null;

      console.log("\n✅ Recovery link generated");
      console.log("   Open this URL in a browser (valid once, expires soon):\n");
      console.log(link ?? JSON.stringify(data.properties, null, 2));
      console.log(
        "\n   After opening, set a new password on the /reset-password page."
      );
      process.exit(0);
    }

    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password: password!,
    });

    if (error) {
      console.error(`❌ updateUserById failed: ${error.message}`);
      process.exit(1);
    }

    console.log("\n✅ Password updated successfully");
    console.log(`   Email:   ${data.user.email}`);
    console.log(`   User ID: ${data.user.id}`);
    console.log("\n   Sebastian can now sign in with the new password.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

void main();
