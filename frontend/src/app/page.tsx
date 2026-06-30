import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Root route — send users to dashboard or login based on session. */
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/today" : "/login");
}
