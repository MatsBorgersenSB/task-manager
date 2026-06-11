"use client";

import { useState } from "react";
import { signInWithOAuth } from "@/lib/auth";
import { ui } from "@/lib/ui/classes";

type OAuthButtonsProps = {
  mode?: "login" | "signup";
};

const btnBase = `${ui.btnSecondary} flex w-full items-center justify-center gap-2 py-2.5`;

export default function OAuthButtons({ mode = "login" }: OAuthButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const verb = mode === "signup" ? "Sign up" : "Continue";

  async function handleOAuth(provider: "google" | "azure") {
    setError(null);
    setLoading(provider);
    try {
      await signInWithOAuth(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OAuth sign-in failed.");
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className={ui.alertError} role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!!loading}
        onClick={() => handleOAuth("azure")}
        className={btnBase}
      >
        {loading === "azure" ? "Redirecting..." : `${verb} with Microsoft`}
      </button>

      <button
        type="button"
        disabled={!!loading}
        onClick={() => handleOAuth("google")}
        className={btnBase}
      >
        {loading === "google" ? "Redirecting..." : `${verb} with Google`}
      </button>
    </div>
  );
}
