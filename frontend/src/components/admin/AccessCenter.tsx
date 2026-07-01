"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useOnlineUsers } from "@/lib/presence/useOnlineUsers";
import type { AccessDirectoryUser, SuspiciousLogin } from "@/lib/access/types";
import {
  formatAccessDateTime,
  formatRelativeLastSeen,
  isUserOnline,
  roleStatusLabel,
  userDisplayName,
} from "@/lib/access/format";
import { roleBadgeClass } from "@/lib/roles";
import { ui } from "@/lib/ui/classes";

type AccessCenterProps = {
  users: AccessDirectoryUser[];
  suspiciousLogins: SuspiciousLogin[];
};

function OnlineStatus({
  user,
  onlineIds,
}: {
  user: AccessDirectoryUser;
  onlineIds: Set<string>;
}) {
  const online = isUserOnline(user.last_activity_at, onlineIds, user.id);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            online ? "bg-emerald-500" : "bg-slate-300"
          }`}
          aria-hidden
        />
        {online ? "Online" : "Offline"}
      </span>
      <span className="text-xs text-muted">
        Last seen {formatRelativeLastSeen(user.last_activity_at)}
      </span>
    </div>
  );
}

export default function AccessCenter({ users, suspiciousLogins }: AccessCenterProps) {
  const onlineUsers = useOnlineUsers();
  const onlineIds = useMemo(
    () => new Set(onlineUsers.map((u) => u.id)),
    [onlineUsers]
  );

  const stats = useMemo(
    () => ({
      total: users.length,
      online: users.filter((u) => isUserOnline(u.last_activity_at, onlineIds, u.id)).length,
      suspicious: suspiciousLogins.length,
      admins: users.filter((u) => u.role === "admin").length,
    }),
    [onlineIds, suspiciousLogins.length, users]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total users", value: stats.total },
          { label: "Online now", value: stats.online },
          { label: "Admins", value: stats.admins },
          { label: "Suspicious events", value: stats.suspicious },
        ].map((card) => (
          <div key={card.label} className={`p-4 ${ui.card}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-primary">{card.value}</p>
          </div>
        ))}
      </div>

      {suspiciousLogins.length > 0 ? (
        <section className={`border-amber-200 bg-amber-50/50 p-5 ${ui.card}`}>
          <h2 className="text-sm font-semibold text-amber-900">Suspicious activity</h2>
          <p className="mt-1 text-xs text-amber-800">
            New device or browser sign-ins flagged for review.
          </p>
          <ul className="mt-4 divide-y divide-amber-200/80">
            {suspiciousLogins.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <Link
                    href={`/admin/access/${entry.user_id}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {entry.email}
                  </Link>
                  <p className="text-xs text-muted">
                    {entry.suspicion_reason ?? "Flagged sign-in"} · {entry.browser} on{" "}
                    {entry.platform}
                  </p>
                </div>
                <span className="text-xs text-muted">{formatAccessDateTime(entry.login_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={ui.card}>
        <div className={ui.cardHeader}>
          <h2 className={ui.sectionTitle}>User directory</h2>
          <p className={ui.sectionSubtitle}>
            Login history, activity, and project access for Standard Bio accounts.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className={ui.table}>
            <thead className={ui.tableHead}>
              <tr>
                <th className={ui.tableHeadCell}>User</th>
                <th className={ui.tableHeadCell}>Role</th>
                <th className={ui.tableHeadCell}>Status</th>
                <th className={ui.tableHeadCell}>Last login</th>
                <th className={ui.tableHeadCell}>Last activity</th>
                <th className={ui.tableHeadCell}>Projects</th>
                <th className={ui.tableHeadCell}>Logins</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id} className={ui.tableRow}>
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/access/${user.id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {userDisplayName(user.email, user.display_name)}
                    </Link>
                    <p className="text-xs text-muted">{user.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadgeClass(user.role)}`}
                    >
                      {roleStatusLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <OnlineStatus user={user} onlineIds={onlineIds} />
                  </td>
                  <td className="px-6 py-4 text-sm text-muted">
                    {formatAccessDateTime(user.last_login_at)}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted">
                    {formatRelativeLastSeen(user.last_activity_at)}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted">
                    <span title="Assigned via project_users">
                      {user.projects_assigned} assigned
                    </span>
                    <span className="mx-1">·</span>
                    <span title="Shared client projects">{user.projects_shared} shared</span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="text-primary">{user.login_count}</span>
                    {user.suspicious_login_count > 0 ? (
                      <span className="ml-2 text-xs font-semibold text-amber-700">
                        {user.suspicious_login_count} flagged
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
