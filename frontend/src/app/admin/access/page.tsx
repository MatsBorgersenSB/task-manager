import AccessCenter from "@/components/admin/AccessCenter";
import AdminNav from "@/components/admin/AdminNav";
import AppShell from "@/components/AppShell";
import {
  accessLoginHistoryAvailable,
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
  let loginHistoryAvailable = true;
  let loadError: string | null = null;

  try {
    [users, suspiciousLogins, loginHistoryAvailable] = await Promise.all([
      fetchAccessDirectory(),
      fetchSuspiciousLogins(),
      accessLoginHistoryAvailable(),
    ]);
  } catch (err) {
    loadError =
      err instanceof Error ? err.message : "Access Center data is unavailable.";
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
        <>
          {loginHistoryAvailable ? null : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Login history is not enabled on this database yet. The directory
              below is the account list. Apply migration
              050_user_access_intelligence.sql in the Supabase SQL editor, then
              refresh, to record sign-ins, devices, and suspicious logins.
            </div>
          )}
          <AccessCenter users={users} suspiciousLogins={suspiciousLogins} />
        </>
      )}
    </AppShell>
  );
}
