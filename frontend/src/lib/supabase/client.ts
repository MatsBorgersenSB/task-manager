import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client — use in Client Components only.
 * Reads public URL + anon key from environment variables.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.local.example to .env.local"
    );
  }

  return createBrowserClient(url, anonKey);
}
