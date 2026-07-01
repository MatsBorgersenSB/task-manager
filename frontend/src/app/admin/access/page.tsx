import AccessCenter from "@/components/admin/AccessCenter";
import AdminNav from "@/components/admin/AdminNav";
import AppShell from "@/components/AppShell";
import {
  fetchAccessDirectory,
  fetchSuspiciousLogins,
} from "@/lib/access/server";
import { requireAdminAccess } from "@/lib/profiles-server";
import { ui } from "@/lib/ui/classes";

export default async function AdminAccessPage() {
  const { profile: adminProfile } = await requireAdminAccess();
  if (!adminProfile) {
    return null;
  }

  let users: Awaited<ReturnType<typeof fetchAccessDirectory>> = [];
  let suspiciousLogins: Awaited<ReturnType<typeof fetchSuspiciousLogins>> = [];
  let loadError: string | null = null;

  try {
    [users, suspiciousLogins] = await Promise.all([
      fetchAccessDirectory(),
      fetchSuspiciousLogins(),
    ]);
  } catch (err) {
    loadError =
      err instanceof Error
        ? err.message
        : "Access Center data is unavailable. Apply migration 050_user_access_intelligence.sql.";
  }

  return (
    <AppShell
      pageTitle="Access Center"
      pageDescription="Login intelligence and user activity monitoring"
      userEmail={adminProfile.email}
      userRole="admin"
      maxWidth="7xl"
      fullWidth
      mainClassName="space-y-6"
    >
      <AdminNav />
      {loadError ? (
        <div className={`p-4 text-sm text-red-700 ${ui.alertError}`}>{loadError}</div>
      ) : (
        <AccessCenter users={users} suspiciousLogins={suspiciousLogins} />
      )}
    </AppShell>
  );
}
