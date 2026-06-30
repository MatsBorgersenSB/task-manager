import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  bootstrapProfileOnServer,
  getAuthContextServer,
} from "@/lib/profiles-server";
import { isInternal } from "@/lib/roles";
import TemplatesClient from "./TemplatesClient";

export default async function TemplatesPage() {
  let { user, profile } = await getAuthContextServer();

  if (!user) redirect("/login");

  if (!profile) {
    const supabase = await createClient();
    profile = await bootstrapProfileOnServer(supabase);
  }

  if (!profile || !isInternal(profile.role)) {
    redirect("/client");
  }

  return <TemplatesClient />;
}
