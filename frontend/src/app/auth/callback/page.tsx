"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import AuthLayout from "@/components/AuthLayout";
import { getCurrentUserRole } from "@/lib/auth";
import { resolveAuthCallbackRedirect } from "@/lib/auth/callback-redirect";
import {
  isRecoveryFromParams,
  parseAuthCallbackParams,
} from "@/lib/auth/recovery";
import { bootstrapProfile } from "@/lib/profiles";
import { beginAccessSession, detectAuthProvider } from "@/lib/access/client";
import { createClient } from "@/lib/supabase/client";

function waitForRecoveryEvent(
  supabase: ReturnType<typeof createClient>,
  timeoutMs = 500
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (isRecovery: boolean) => {
      if (settled) return;
      settled = true;
      subscription.unsubscribe();
      clearTimeout(timer);
      resolve(isRecovery);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      console.debug("[auth/callback] auth event:", event);
      if (event === "PASSWORD_RECOVERY") {
        console.debug("[auth/callback] PASSWORD_RECOVERY detected");
        finish(true);
      }
    });

    const timer = setTimeout(() => finish(false), timeoutMs);
  });
}

async function establishSession(
  supabase: ReturnType<typeof createClient>,
  params: ReturnType<typeof parseAuthCallbackParams>
) {
  const hasCode = Boolean(params.code);
  const hasHashToken = Boolean(params.accessToken && params.refreshToken);

  if (!hasCode && !hasHashToken) {
    throw new Error("Missing authentication code or token in the link.");
  }

  // The @supabase/ssr browser client is created with detectSessionInUrl=true and
  // flowType="pkce" (both hardcoded by the library). That means the PKCE code
  // (or implicit hash token) in this callback URL is exchanged AUTOMATICALLY as
  // the client initializes — the exchange consumes and deletes the code verifier.
  //
  // We must NOT call exchangeCodeForSession() ourselves: doing so is a second
  // exchange with an already-consumed verifier and throws
  // "PKCE code verifier not found in storage". Instead we subscribe for the
  // recovery event and read the session via getSession(), which awaits the
  // client's internal initialize()/auto-exchange before resolving.
  console.debug("[auth/callback] awaiting auto session detection", {
    hasCode,
    hasHashToken,
  });

  const recoveryPromise = waitForRecoveryEvent(supabase);
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  if (!data.session) {
    throw new Error(
      "Could not complete sign-in. This usually means the login was started " +
        "on a different site address than this one. Please return to the app " +
        "and sign in again from the same URL."
    );
  }

  const recoveryFromEvent = await recoveryPromise;
  return { recoveryFromEvent };
}

function AuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState("Completing sign in…");

  useEffect(() => {
    let cancelled = false;

    async function completeAuth() {
      const supabase = createClient();
      const params = parseAuthCallbackParams(searchParams);

      if (params.error) {
        if (!cancelled) {
          setStatus("error");
          setMessage(params.errorDescription ?? "Authentication was denied or failed.");
        }
        return;
      }

      const recoveryFromParams = isRecoveryFromParams(params);
      if (recoveryFromParams) {
        console.debug("[auth/callback] recovery detected from URL params");
      }

      try {
        const { recoveryFromEvent } = await establishSession(supabase, params);
        const isRecovery = recoveryFromParams || recoveryFromEvent;

        if (isRecovery) {
          console.debug("[auth/callback] redirecting to /reset-password (recovery flow)");
          if (!cancelled) {
            router.replace("/reset-password");
            router.refresh();
          }
          return;
        }

        await bootstrapProfile(supabase);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          void beginAccessSession(detectAuthProvider(user.app_metadata));
        }
        const role = await getCurrentUserRole();
        const destination = resolveAuthCallbackRedirect(role, {
          next: params.next,
          type: params.type,
          isRecovery: false,
        });

        console.debug("[auth/callback] redirecting to", destination);
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
