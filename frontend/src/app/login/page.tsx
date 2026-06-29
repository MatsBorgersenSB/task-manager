import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  authCallbackErrorMessage,
  resolvePostLoginPath,
} from "@/lib/auth/callback-redirect";
import { getAuthContextServer } from "@/lib/profiles-server";
import LoginForm from "./LoginForm";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { profile } = await getAuthContextServer();
    redirect(resolvePostLoginPath(profile?.role ?? null, params.next));
  }

  const authError = params.error
    ? authCallbackErrorMessage(params.error)
    : null;

  return (
    <LoginForm
      authError={authError}
      nextPath={params.next}
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-semibold text-indigo-600 hover:text-indigo-500"
          >
            Create account
          </Link>
        </>
      }
    />
  );
}
