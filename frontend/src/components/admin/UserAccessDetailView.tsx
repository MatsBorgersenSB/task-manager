"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useOnlineUsers } from "@/lib/presence/useOnlineUsers";
import type { UserAccessDetail } from "@/lib/access/types";
import {
  formatAccessDateTime,
  formatRelativeLastSeen,
  formatSessionDuration,
  isUserOnline,
  roleStatusLabel,
  userDisplayName,
} from "@/lib/access/format";
import { roleBadgeClass } from "@/lib/roles";
import { ui } from "@/lib/ui/classes";

type UserAccessDetailViewProps = {
  detail: UserAccessDetail;
};

export default function UserAccessDetailView({ detail }: UserAccessDetailViewProps) {
  const { profile, sessions } = detail;
  const onlineUsers = useOnlineUsers();
  const onlineIds = useMemo(
    () => new Set(onlineUsers.map((u) => u.id)),
    [onlineUsers]
  );
  const online = isUserOnline(profile.last_activity_at, onlineIds, profile.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/access" className={`${ui.btnSecondarySm} mb-4 inline-flex`}>
          ← Access Center
        </Link>
        <h2 className="text-2xl font-bold text-primary">
          {userDisplayName(profile.email, profile.display_name)}
        </h2>
        <p className="text-sm text-muted">{profile.email}</p>
      </div>

      <section className={`p-5 ${ui.card}`}>
        <h3 className={ui.sectionTitle}>Profile</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase text-muted">Role</dt>
            <dd className="mt-1">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadgeClass(profile.role)}`}
              >
                {roleStatusLabel(profile.role)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-muted">Status</dt>
            <dd className="mt-1 inline-flex items-center gap-2 text-sm font-medium">
              <span
                className={`h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500" : "bg-slate-300"}`}
              />
              {online ? "Online" : "Offline"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-muted">Created</dt>
            <dd className="mt-1 text-sm">{formatAccessDateTime(profile.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-muted">Last login</dt>
            <dd className="mt-1 text-sm">{formatAccessDateTime(profile.last_login_at)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-muted">Last activity</dt>
            <dd className="mt-1 text-sm">{formatRelativeLastSeen(profile.last_activity_at)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-muted">Projects assigned</dt>
            <dd className="mt-1 text-sm">{profile.projects_assigned}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-muted">Shared projects</dt>
            <dd className="mt-1 text-sm">{profile.projects_shared}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-muted">Total sign-ins</dt>
            <dd className="mt-1 text-sm">{profile.login_count}</dd>
          </div>
        </dl>
      </section>

      <section className={ui.card}>
        <div className={ui.cardHeader}>
          <h3 className={ui.sectionTitle}>Login history</h3>
          <p className={ui.sectionSubtitle}>
            Authentication events, devices, and session duration.
          </p>
        </div>

        {sessions.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted">No login sessions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={ui.table}>
              <thead className={ui.tableHead}>
                <tr>
                  <th className={ui.tableHeadCell}>Login</th>
                  <th className={ui.tableHeadCell}>Logout</th>
                  <th className={ui.tableHeadCell}>Duration</th>
                  <th className={ui.tableHeadCell}>Provider</th>
                  <th className={ui.tableHeadCell}>IP</th>
                  <th className={ui.tableHeadCell}>Device</th>
                  <th className={ui.tableHeadCell}>Browser</th>
                  <th className={ui.tableHeadCell}>Platform</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.map((session) => (
                  <tr
                    key={session.id}
                    className={
                      session.is_suspicious ? "bg-amber-50/60" : ui.tableRow
                    }
                  >
                    <td className="px-6 py-4 text-sm">
                      {formatAccessDateTime(session.login_at)}
                      {session.is_suspicious ? (
                        <p className="mt-1 text-xs font-semibold text-amber-800">
                          {session.suspicion_reason ?? "Suspicious"}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted">
                      {formatAccessDateTime(session.logout_at)}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted">
                      {formatSessionDuration(session.session_duration_seconds)}
                    </td>
                    <td className="px-6 py-4 text-sm capitalize text-muted">
                      {session.auth_provider ?? "—"}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-muted">
                      {session.ip_address ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm capitalize text-muted">
                      {session.device_type ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted">
                      {session.browser ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted">
                      {session.platform ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
