import { redirect } from "next/navigation";
import { getAuthContextServer } from "@/lib/profiles-server";
import { isInternal } from "@/lib/roles";

type ShareProjectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ShareProjectPage({ params }: ShareProjectPageProps) {
  const { id } = await params;
  const { user, profile } = await getAuthContextServer();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/share/project/${id}`)}`);
  }

  if (!profile) {
    redirect("/dashboard");
  }

  const target = isInternal(profile.role) ? "/internal" : "/client";
  redirect(`${target}?project=${encodeURIComponent(id)}`);
}
