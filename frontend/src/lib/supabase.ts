import { createClient } from "@supabase/supabase-js";

/**
 * Basic Supabase browser client (singleton).
 *
 * Uses NEXT_PUBLIC_* env vars from frontend/.env.local — these are exposed to
 * the browser, which is expected for the anon key (RLS protects your data).
 *
 * For this Next.js app, prefer the SSR-aware clients when possible:
 * - Client Components → `@/lib/supabase/client` (cookie/session aware)
 * - Server Components / actions → `@/lib/supabase/server`
 *
 * This file is useful for quick scripts or simple client-only usage.
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
