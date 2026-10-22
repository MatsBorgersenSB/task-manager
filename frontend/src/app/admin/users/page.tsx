import AdminPanel from "@/app/admin/AdminPanel";
import { readDeniedUserIds } from "@/lib/admin/user-access";
import {
  fetchAdminDashboardData,
  requireAdminAccess,
} from "@/lib/profiles-server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const { user, profile } = await requireAdminAccess();
  const { profiles, invites, auditLogs, adminCount, invitesAvailable, auditAvailable } =
    await fetchAdminDashboardData();

  let deniedUserIds: string[] = [];
  let deniedStatusKnown = true;
  try {
    const supabase = await createClient();
    deniedUserIds = await readDeniedUserIds(supabase);
  } catch {
    deniedStatusKnown = false;
  }

  return (
    <AdminPanel
      currentUserId={user.id}
      currentUserEmail={profile?.email || user.email || ""}
      profiles={profiles}
      invites={invites}
      auditLogs={auditLogs}
      adminCount={adminCount}
      invitesAvailable={invitesAvailable}
      auditAvailable={auditAvailable}
      deniedUserIds={deniedUserIds}
      deniedStatusKnown={deniedStatusKnown}
    />
  );
}
