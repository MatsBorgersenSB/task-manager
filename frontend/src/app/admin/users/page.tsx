import AdminPanel from "@/app/admin/AdminPanel";
import { listDeniedUserIds } from "@/lib/admin/user-access";
import {
  fetchAdminDashboardData,
  requireAdminAccess,
} from "@/lib/profiles-server";

export default async function AdminUsersPage() {
  const { user, profile } = await requireAdminAccess();
  const { profiles, invites, auditLogs, adminCount, invitesAvailable, auditAvailable } =
    await fetchAdminDashboardData();

  let deniedUserIds: string[] = [];
  try {
    deniedUserIds = await listDeniedUserIds();
  } catch {
    deniedUserIds = [];
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
    />
  );
}
