import { requireInternalAccess } from "@/lib/profiles-server";
import TaskManager from "@/components/tasks/TaskManager";

export default async function InternalPage() {
  const { profile } = await requireInternalAccess();

  return (
    <TaskManager
      mode="internal"
      title="Internal View"
      userEmail={profile.email}
      userRole={profile.role}
      backHref="/dashboard"
    />
  );
}
