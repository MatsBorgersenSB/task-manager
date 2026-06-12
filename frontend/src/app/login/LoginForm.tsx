"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import AuthLayout from "@/components/AuthLayout";
import OAuthButtons from "@/components/OAuthButtons";
import { Divider, FormField, TextInput, submitClass } from "@/components/FormFields";
import { sendPasswordResetEmail, signInWithEmail } from "@/lib/auth";

type LoginFormProps = {
  authError?: string | null;
  footer: ReactNode;
};

export default function LoginForm({ authError, footer }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(authError ?? null);
  const [showReset, setShowReset] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signInWithEmail(email.trim(), password);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSubmit(event: React.FormEvent) {
    event.preventDefault();
    setResetError(null);
    setResetSuccess(null);
    setResetLoading(true);

    try {
      await sendPasswordResetEmail(email.trim());
      setResetSuccess("Password reset email sent");
    } catch (err) {
      setResetError(
        err instanceof Error ? err.message : "Could not send reset email."
      );
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your Task Manager account"
      footer={footer}
    >
      <OAuthButtons mode="login" />

      <Divider />

      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <FormField label="Email">
          <TextInput
            type="email"
            name="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </FormField>

        <FormField label="Password">
          <TextInput
            type="password"
            name="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <p className="mt-1 text-right">
            <button
              type="button"
              onClick={() => {
                setShowReset((value) => !value);
                setResetSuccess(null);
                setResetError(null);
              }}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Forgot password?
            </button>
          </p>
        </FormField>

        {showReset ? (
          <div className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
            {resetSuccess ? (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {resetSuccess}
              </p>
            ) : null}
            {resetError ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {resetError}
              </p>
            ) : null}
            <p className="text-sm text-muted">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>
            <button
              type="button"
              disabled={resetLoading || !email.trim()}
              onClick={(event) => void handleResetSubmit(event)}
              className={submitClass}
            >
              {resetLoading ? "Sending…" : "Send reset link"}
            </button>
          </div>
        ) : null}

        <button type="submit" disabled={loading} className={submitClass}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}
