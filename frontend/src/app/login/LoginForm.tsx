"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import AuthLayout from "@/components/AuthLayout";
import OAuthButtons from "@/components/OAuthButtons";
import { Divider, FormField, TextInput, submitClass } from "@/components/FormFields";
import { signInWithEmail } from "@/lib/auth";

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
        </FormField>

        <button type="submit" disabled={loading} className={submitClass}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}
