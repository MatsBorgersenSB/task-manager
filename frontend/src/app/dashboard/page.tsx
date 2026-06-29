import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolvePostLoginPath } from "@/lib/auth/callback-redirect";
import {
  bootstrapProfileOnServer,
  getAuthContextServer,
} from "@/lib/profiles-server";
import { isInternal } from "@/lib/roles";
import DashboardClient from "./DashboardClient";
import ProfileSetupPending from "./ProfileSetupPending";

type DashboardPageProps = {
  searchParams: Promise<{ project?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  let { user, profile, isAdmin } = await getAuthContextServer();
  const params = await searchParams;

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

  if (!isInternal(profile.role)) {
    const clientPath = params.project
      ? `/client?project=${encodeURIComponent(params.project)}`
      : "/client";
    redirect(clientPath);
  }

  return (
    <DashboardClient
      email={profile.email}
      role={profile.role}
      isAdmin={isAdmin}
    />
  );
}
