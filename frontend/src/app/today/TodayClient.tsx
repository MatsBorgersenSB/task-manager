"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import TodayView from "@/components/attention/TodayView";
import AppShell from "@/components/AppShell";
import { signOut } from "@/lib/auth";
import { isInternal, roleBadgeClass, type UserRole } from "@/lib/roles";
import { ui } from "@/lib/ui/classes";

type TodayClientProps = {
  email: string;
  role: UserRole;
  isAdmin: boolean;
};

export default function TodayClient({ email, role, isAdmin }: TodayClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await signOut();
      router.push("/login");
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  return (
    <AppShell
      pageTitle="Today"
      pageDescription="Attention Center & personal workspace"
      userEmail={email}
      userRole={role}
      fullWidth
      headerActions={
        <>
          {isAdmin ? (
            <Link href="/admin" className={ui.btnHeader}>
              Admin
            </Link>
          ) : null}
          {isInternal(role) ? (
            <Link href="/dashboard" className={ui.btnHeader}>
              Projects
            </Link>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loading}
            className={ui.btnHeader}
          >
            {loading ? "Signing out…" : "Log out"}
          </button>
        </>
      }
    >
      <p className="text-xs text-muted">
        Signed in as{" "}
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleBadgeClass(role)}`}
        >
          {role}
        </span>
      </p>
      <TodayView userEmail={email} />
    </AppShell>
  );
}
