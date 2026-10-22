"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import DashboardProjectSection from "@/components/projects/DashboardProjectSection";
import AppShell from "@/components/AppShell";
import { signOut } from "@/lib/auth";
import { isInternal, type UserRole } from "@/lib/roles";
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
      pageDescription="Open a project to work its tasks"
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
      {canAccessInternal ? (
        <>
          <section
            className={`mb-8 grid gap-4 sm:grid-cols-2 ${
              userIsAdmin ? "lg:grid-cols-3" : ""
            }`}
          >
            <Link href="/internal" className={ui.navCard}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Staff
              </p>
              <p className="mt-1 text-lg font-semibold text-primary">Internal view</p>
              <p className="mt-1 text-sm text-muted">
                Where Standard Bio accounts land. Full fields, owners, and project tools.
              </p>
            </Link>
            <Link href="/client" className={ui.navCard}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Clients
              </p>
              <p className="mt-1 text-lg font-semibold text-primary">Client view</p>
              <p className="mt-1 text-sm text-muted">
                Where invited client accounts land. Shared projects and client-visible tasks only.
              </p>
            </Link>
            {userIsAdmin ? (
              <Link href="/admin/users" className={ui.navCard}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Admins
                </p>
                <p className="mt-1 text-lg font-semibold text-primary">Admin view</p>
                <p className="mt-1 text-sm text-muted">
                  Invite people, change roles, and correct accounts. Only admins can open this.
                </p>
              </Link>
            ) : null}
          </section>
          <DashboardProjectSection role={role} />
          <section className={`flex flex-wrap items-center justify-between gap-4 p-5 ${ui.card}`}>
            <div>
              <h2 className="text-sm font-semibold text-primary">Across projects</h2>
              <p className="mt-1 text-sm text-muted">
                Today collects tasks, alerts, and activity from every project.
              </p>
            </div>
            <Link href="/today" className={ui.btnSecondary}>
              Open Today
            </Link>
          </section>
        </>
      ) : (
        <section className={`p-8 ${ui.card}`}>
          <h2 className={ui.sectionTitle}>Your projects</h2>
          <p className="mt-2 text-sm text-muted">
            Signed in as {email}.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link href="/today" className={ui.navCard}>
              <p className="font-semibold text-primary">Today</p>
              <p className="mt-1 text-sm text-muted">
                Attention Center — tasks, alerts, and activity.
              </p>
            </Link>
            <Link href="/client" className={ui.navCard}>
              <p className="font-semibold text-primary">Client view</p>
              <p className="mt-1 text-sm text-muted">
                Client-visible issues and status updates.
              </p>
            </Link>
          </div>
        </section>
      )}
    </AppShell>
  );
}
