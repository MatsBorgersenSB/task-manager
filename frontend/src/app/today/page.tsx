import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  bootstrapProfileOnServer,
  getAuthContextServer,
} from "@/lib/profiles-server";
import { isInternal } from "@/lib/roles";
import TodayClient from "./TodayClient";
import ProfileSetupPending from "../dashboard/ProfileSetupPending";

export default async function TodayPage() {
  let { user, profile, isAdmin } = await getAuthContextServer();

  if (!user) {
    redirect("/login");
  }

  if (!profile) {
    const supabase = await createClient();
    profile = await bootstrapProfileOnServer(supabase);
    isAdmin = profile?.role === "admin";
  }

  if (!profile) {
    return <ProfileSetupPending email={user.email ?? ""} />;
  }

  if (!isInternal(profile.role)) {
    redirect("/client");
  }

  return (
    <TodayClient
      email={profile.email}
      role={profile.role}
      isAdmin={isAdmin}
    />
  );
}
