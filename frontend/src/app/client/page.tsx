import { getAuthContextServer } from "@/lib/profiles-server";
import { redirect } from "next/navigation";
import ProfileSetupPending from "@/app/dashboard/ProfileSetupPending";
import TaskManager from "@/components/tasks/TaskManager";

export default async function ClientPage() {
  const { user, profile } = await getAuthContextServer();

  if (!user) redirect("/login");
  if (!profile) return <ProfileSetupPending email={user.email ?? ""} />;

  return (
    <TaskManager
      mode="client"
      title="Client View"
      userEmail={profile.email}
      userRole={profile.role}
      backHref="/dashboard"
    />
  );
}
