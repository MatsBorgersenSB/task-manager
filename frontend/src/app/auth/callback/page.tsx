"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import AuthLayout from "@/components/AuthLayout";
import { getCurrentUserRole } from "@/lib/auth";
import { resolveAuthCallbackRedirect } from "@/lib/auth/callback-redirect";
import { bootstrapProfile } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/client";

function AuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState("Completing sign in…");

  useEffect(() => {
    let cancelled = false;

    async function completeAuth() {
      const supabase = createClient();
      const oauthError = searchParams.get("error");
      const oauthDescription = searchParams.get("error_description");

      if (oauthError) {
        if (!cancelled) {
          setStatus("error");
          setMessage(oauthDescription ?? "Authentication was denied or failed.");
        }
        return;
      }

      const code = searchParams.get("code");
      const type = searchParams.get("type");
      const next = searchParams.get("next");
      const hasHashToken =
        typeof window !== "undefined" &&
        /access_token=|refresh_token=/.test(window.location.hash);

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (hasHashToken) {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (!data.session) {
            throw new Error("Could not establish a session from the email link.");
          }
        } else {
          throw new Error("Missing authentication code or token in the link.");
        }

        await bootstrapProfile(supabase);
        const role = await getCurrentUserRole();
        const destination = resolveAuthCallbackRedirect(role, { next, type });

        if (!cancelled) {
          router.replace(destination);
          router.refresh();
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setMessage(
            err instanceof Error ? err.message : "Authentication failed."
          );
        }
      }
    }

    void completeAuth();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  if (status === "error") {
    return (
      <AuthLayout
        title="Sign-in problem"
        subtitle="We could not complete authentication"
        footer={
          <>
            <Link
              href="/login"
              className="font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Back to sign in
            </Link>
          </>
        }
      >
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {message}
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Signing you in" subtitle="Please wait a moment">
      <p className="text-sm text-muted">{message}</p>
    </AuthLayout>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout title="Signing you in" subtitle="Please wait a moment">
          <p className="text-sm text-muted">Completing sign in…</p>
        </AuthLayout>
      }
    >
      <AuthCallbackHandler />
    </Suspense>
  );
}
