import { getAuthContextServer } from "@/lib/profiles-server";
import { redirect } from "next/navigation";
import ProfileSetupPending from "@/app/dashboard/ProfileSetupPending";
import TaskManager from "@/components/tasks/TaskManager";

type ClientPageProps = {
  searchParams: Promise<{ project?: string }>;
};

export default async function ClientPage({ searchParams }: ClientPageProps) {
  const { user, profile } = await getAuthContextServer();
  const params = await searchParams;

  if (!user) redirect("/login");
  if (!profile) return <ProfileSetupPending email={user.email ?? ""} />;

  return (
    <TaskManager
      mode="client"
      subtitle="Client-visible tasks and fields only."
      userEmail={profile.email}
      userRole={profile.role}
      initialProjectId={params.project}
    />
  );
}
