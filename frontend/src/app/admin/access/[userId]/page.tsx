import { notFound } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import UserAccessDetailView from "@/components/admin/UserAccessDetailView";
import AppShell from "@/components/AppShell";
import { fetchUserAccessDetail } from "@/lib/access/server";
import { requireAdminAccess } from "@/lib/profiles-server";

type PageProps = {
  params: Promise<{ userId: string }>;
};

export default async function AdminUserAccessPage({ params }: PageProps) {
  const { userId } = await params;
  const { profile: adminProfile } = await requireAdminAccess();
  if (!adminProfile) notFound();

  const detail = await fetchUserAccessDetail(userId).catch(() => null);
  if (!detail) notFound();

  return (
    <AppShell
      pageTitle="User access detail"
      pageDescription={detail.profile.email}
      userEmail={adminProfile.email}
      userRole="admin"
      maxWidth="7xl"
      fullWidth
      mainClassName="space-y-6"
    >
      <AdminNav />
      <UserAccessDetailView detail={detail} />
    </AppShell>
  );
}
