import { redirect } from "next/navigation";
import { getAuthContextServer } from "@/lib/profiles-server";
import { isInternal } from "@/lib/roles";

/** Root route — internal staff open the dashboard; clients open the client view. */
export default async function HomePage() {
  const { user, profile } = await getAuthContextServer();

  if (!user) {
    redirect("/login");
  }

  if (profile && !isInternal(profile.role)) {
    redirect("/client");
  }

  redirect("/dashboard");
}
