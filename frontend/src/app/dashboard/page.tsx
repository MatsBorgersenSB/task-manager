import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  bootstrapProfileOnServer,
  getAuthContextServer,
} from "@/lib/profiles-server";
import DashboardClient from "./DashboardClient";
import ProfileSetupPending from "./ProfileSetupPending";

export default async function DashboardPage() {
  let { user, profile, isAdmin } = await getAuthContextServer();

  if (!user) {
    redirect("/login");
  }

  // Server-side retry if profile was not ready on first pass
  if (!profile) {
    const supabase = await createClient();
    profile = await bootstrapProfileOnServer(supabase);
    isAdmin = profile?.role === "admin";
  }

  if (!profile) {
    return <ProfileSetupPending email={user.email ?? ""} />;
  }

  return (
    <DashboardClient
      email={profile.email}
      role={profile.role}
      isAdmin={isAdmin}
    />
  );
}
