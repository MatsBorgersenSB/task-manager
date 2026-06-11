"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import AuthLayout from "@/components/AuthLayout";
import OAuthButtons from "@/components/OAuthButtons";
import { Divider, FormField, TextInput, submitClass } from "@/components/FormFields";
import { signUpWithEmail } from "@/lib/auth";

type SignUpFormProps = {
  footer: ReactNode;
};

export default function SignUpForm({ footer }: SignUpFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const data = await signUpWithEmail(email.trim(), password);
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setSuccess(
          "Account created. Check your email to confirm, then sign in."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Create account"
      subtitle="Register for Task Manager"
      footer={footer}
    >
      <OAuthButtons mode="signup" />

      <Divider />

      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
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
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </FormField>

        <button type="submit" disabled={loading} className={submitClass}>
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
