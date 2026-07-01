import AdminNav from "@/components/admin/AdminNav";
import ProjectLifecycleDashboard from "@/components/admin/ProjectLifecycleDashboard";
import AppShell from "@/components/AppShell";
import { requireAdminAccess } from "@/lib/profiles-server";

export default async function AdminLifecyclePage() {
  const { profile } = await requireAdminAccess();
  if (!profile) return null;

  return (
    <AppShell
      pageTitle="Project Lifecycle"
      pageDescription="Enterprise project governance and audit trail"
      userEmail={profile.email}
      userRole="admin"
      maxWidth="7xl"
      fullWidth
      mainClassName="space-y-6"
    >
      <AdminNav />
      <ProjectLifecycleDashboard />
    </AppShell>
  );
}
