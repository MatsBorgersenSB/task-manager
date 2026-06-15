import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type DeleteAuthUserResult =
  | { success: true; userId: string; email: string }
  | { success: false; error: string };

/** Service-role client — server/scripts only. Never expose the key to the browser. */
export function createServiceRoleClient(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url) {
    throw new Error(
      "Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/** Paginate auth users until a matching email is found (case-insensitive). */
export async function findAuthUserIdByEmail(
  admin: SupabaseClient,
  email: string
): Promise<string | null> {
  const target = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    const users = data.users ?? [];
    const match = users.find(
      (user) => (user.email ?? "").trim().toLowerCase() === target
    );

    if (match) {
      return match.id;
    }

    if (users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

/**
 * Delete a Supabase Auth user by email.
 * public.profiles cascades on auth.users delete (see 001_profiles.sql).
 */
export async function deleteAuthUserByEmail(
  admin: SupabaseClient,
  email: string
): Promise<DeleteAuthUserResult> {
  const normalized = email.trim().toLowerCase();

  if (!normalized) {
    return { success: false, error: "Email is required." };
  }

  const userId = await findAuthUserIdByEmail(admin, normalized);

  if (!userId) {
    return {
      success: false,
      error: `No auth user found with email: ${normalized}`,
    };
  }

  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    return {
      success: false,
      error: `deleteUser failed: ${error.message}`,
    };
  }

  return { success: true, userId, email: normalized };
}
