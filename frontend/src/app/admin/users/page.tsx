import AdminPanel from "@/app/admin/AdminPanel";
import {
  fetchAdminDashboardData,
  requireAdminAccess,
} from "@/lib/profiles-server";

export default async function AdminUsersPage() {
  const { user } = await requireAdminAccess();
  const { profiles, invites, auditLogs, adminCount } =
    await fetchAdminDashboardData();

  return (
    <AdminPanel
      currentUserId={user.id}
      profiles={profiles}
      invites={invites}
      auditLogs={auditLogs}
      adminCount={adminCount}
    />
  );
}
