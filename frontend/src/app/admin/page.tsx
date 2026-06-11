import AdminPanel from "@/app/admin/AdminPanel";
import {
  fetchAdminDashboardData,
  requireAdminAccess,
} from "@/lib/profiles-server";

/**
 * Admin page — protected server-side via requireAdminAccess().
 * Middleware also redirects non-admins before this runs.
 */
export default async function AdminPage() {
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
