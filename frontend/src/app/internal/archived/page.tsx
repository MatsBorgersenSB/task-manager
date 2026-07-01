import ArchivedProjectsExplorer from "@/components/projects/ArchivedProjectsExplorer";
import AppShell from "@/components/AppShell";
import { requireInternalAccess } from "@/lib/profiles-server";

export default async function ArchivedProjectsPage() {
  const { profile } = await requireInternalAccess();

  return (
    <AppShell
      pageTitle="Archived Projects"
      pageDescription="Search and view archived projects in read-only mode"
      userEmail={profile.email}
      userRole={profile.role}
      maxWidth="5xl"
      fullWidth
    >
      <ArchivedProjectsExplorer />
    </AppShell>
  );
}
