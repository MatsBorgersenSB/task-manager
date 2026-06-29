import { requireInternalAccess } from "@/lib/profiles-server";
import TaskManager from "@/components/tasks/TaskManager";

type InternalPageProps = {
  searchParams: Promise<{ project?: string }>;
};

export default async function InternalPage({ searchParams }: InternalPageProps) {
  const { profile } = await requireInternalAccess();
  const params = await searchParams;

  return (
    <TaskManager
      mode="internal"
      title="Internal View"
      userEmail={profile.email}
      userRole={profile.role}
      backHref="/dashboard"
      initialProjectId={params.project}
    />
  );
}
