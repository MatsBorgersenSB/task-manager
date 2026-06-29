"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import DashboardProjectSection from "@/components/projects/DashboardProjectSection";
import AppShell from "@/components/AppShell";
import { signOut } from "@/lib/auth";
import { isInternal, roleBadgeClass, type UserRole } from "@/lib/roles";
import { ui } from "@/lib/ui/classes";

type DashboardClientProps = {
  email: string;
  role: UserRole;
  isAdmin: boolean;
};

export default function DashboardClient({
  email,
  role,
  isAdmin: userIsAdmin,
}: DashboardClientProps) {
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

  const canAccessInternal = isInternal(role);

  return (
    <AppShell
      pageTitle="Dashboard"
      pageDescription="Internal task management"
      userEmail={email}
      userRole={role}
      maxWidth="5xl"
      headerActions={
        <>
          {userIsAdmin ? (
            <Link href="/admin" className={ui.btnHeader}>
              Admin Panel
            </Link>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loading}
            className={ui.btnHeader}
          >
            {loading ? "Signing out..." : "Log out"}
          </button>
        </>
      }
    >
      {canAccessInternal ? <DashboardProjectSection /> : null}

      <section className={`p-8 ${ui.card}`}>
        <h2 className={ui.sectionTitle}>Welcome, {email}</h2>
        <p className="mt-2 text-sm text-muted">
          You are signed in as an{" "}
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadgeClass(role)}`}
          >
            {role}
          </span>{" "}
          user.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link href="/client" className={ui.navCard}>
            <p className="font-semibold text-primary">Client view</p>
            <p className="mt-1 text-sm text-muted">
              Client-visible issues and status updates.
            </p>
          </Link>
          {canAccessInternal ? (
            <Link href="/internal" className={ui.navCard}>
              <p className="font-semibold text-primary">Internal view</p>
              <p className="mt-1 text-sm text-muted">
                Full fields — internal and admin users.
              </p>
            </Link>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-background p-5 text-sm text-muted">
              Internal task views are available to @yourcompany.com accounts and
              admins.
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
