"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { inviteUserAction, updateUserRoleAction } from "@/app/admin/actions";
import AppShell from "@/components/AppShell";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  isLastAdminDemotion,
  USER_ROLES,
} from "@/lib/admin/validation";
import { roleBadgeClass, type UserRole } from "@/lib/roles";
import type { AuditLog, Invite, Profile } from "@/lib/types";
import { ui } from "@/lib/ui/classes";

type AdminPanelProps = {
  currentUserId: string;
  profiles: Profile[];
  invites: Invite[];
  auditLogs: AuditLog[];
  adminCount: number;
};

type PendingRoleChange = {
  userId: string;
  email: string;
  oldRole: UserRole;
  newRole: UserRole;
};

type PendingInvite = {
  email: string;
  role: UserRole;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatAuditDetail(log: AuditLog): string {
  const meta = log.metadata;
  if (log.action === "role_change" && meta.old_role && meta.new_role) {
    return `${meta.old_role} → ${meta.new_role}${meta.target_email ? ` (${meta.target_email})` : ""}`;
  }
  if (
    (log.action === "invite_created" || log.action === "invite_updated") &&
    meta.email
  ) {
    return `${meta.email} as ${meta.role}`;
  }
  if (log.action.endsWith("_denied") && meta.reason) {
    return `Denied: ${String(meta.reason)}`;
  }
  if (Object.keys(meta).length > 0) {
    return JSON.stringify(meta);
  }
  return "—";
}

function Alert({
  type,
  message,
  onDismiss,
}: {
  type: "success" | "error";
  message: string;
  onDismiss: () => void;
}) {
  const styles =
    type === "success"
      ? ui.alertSuccess
      : ui.alertError;

  return (
    <div
      className={`flex items-start justify-between gap-4 text-sm ${styles}`}
      role="alert"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-xs font-semibold opacity-70 hover:opacity-100"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

export default function AdminPanel({
  currentUserId,
  profiles,
  invites,
  auditLogs,
  adminCount,
}: AdminPanelProps) {
  const router = useRouter();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);
  const [inviteSaving, setInviteSaving] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] =
    useState<PendingRoleChange | null>(null);
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(
    null
  );
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("internal");
  // Track displayed role per user so we can revert select on cancel
  const [displayRoles, setDisplayRoles] = useState<Record<string, UserRole>>(
    () => Object.fromEntries(profiles.map((p) => [p.id, p.role]))
  );

  const isBusy = roleSaving || inviteSaving;

  const showResult = useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text });
  }, []);

  function handleRoleSelect(
    profile: Profile,
    newRole: UserRole,
    selectEl: HTMLSelectElement
  ) {
    if (profile.id === currentUserId) {
      showResult("error", "You cannot change your own role.");
      selectEl.value = profile.role;
      return;
    }

    if (newRole === profile.role) return;

    if (isLastAdminDemotion(profile, newRole, adminCount)) {
      showResult("error", "Cannot remove the last admin.");
      selectEl.value = profile.role;
      return;
    }

    setPendingRoleChange({
      userId: profile.id,
      email: profile.email,
      oldRole: profile.role,
      newRole,
    });
    setDisplayRoles((prev) => ({ ...prev, [profile.id]: newRole }));
  }

  async function confirmRoleChange() {
    if (!pendingRoleChange) return;

    setRoleSaving(true);
    const result = await updateUserRoleAction(
      pendingRoleChange.userId,
      pendingRoleChange.newRole
    );
    setRoleSaving(false);
    setPendingRoleChange(null);

    if (result.success) {
      setDisplayRoles((prev) => ({
        ...prev,
        [pendingRoleChange.userId]: pendingRoleChange.newRole,
      }));
      showResult(
        "success",
        `${pendingRoleChange.email} is now ${pendingRoleChange.newRole}.`
      );
      router.refresh();
    } else {
      setDisplayRoles((prev) => ({
        ...prev,
        [pendingRoleChange.userId]: pendingRoleChange.oldRole,
      }));
      showResult("error", result.error);
    }
  }

  function cancelRoleChange() {
    if (pendingRoleChange) {
      setDisplayRoles((prev) => ({
        ...prev,
        [pendingRoleChange.userId]: pendingRoleChange.oldRole,
      }));
    }
    setPendingRoleChange(null);
  }

  function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = inviteEmail.trim().toLowerCase();
    if (!normalized) return;

    setPendingInvite({ email: normalized, role: inviteRole });
  }

  async function confirmInvite() {
    if (!pendingInvite) return;

    setInviteSaving(true);
    const result = await inviteUserAction(
      pendingInvite.email,
      pendingInvite.role
    );
    setInviteSaving(false);
    setPendingInvite(null);

    if (result.success) {
      showResult("success", `Invite saved for ${pendingInvite.email}.`);
      setInviteEmail("");
      router.refresh();
    } else {
      showResult("error", result.error);
    }
  }

  const currentEmail =
    profiles.find((p) => p.id === currentUserId)?.email ?? "";

  return (
    <>
      <ConfirmDialog
        open={pendingRoleChange !== null}
        title="Change user role?"
        description={
          pendingRoleChange
            ? `Change ${pendingRoleChange.email} from "${pendingRoleChange.oldRole}" to "${pendingRoleChange.newRole}"? This is logged in the audit trail.`
            : ""
        }
        confirmLabel="Change role"
        variant="danger"
        loading={roleSaving}
        onConfirm={confirmRoleChange}
        onCancel={cancelRoleChange}
      />

      <ConfirmDialog
        open={pendingInvite !== null}
        title="Send invite?"
        description={
          pendingInvite
            ? `Invite ${pendingInvite.email} with role "${pendingInvite.role}"? They will receive this role when they sign up.`
            : ""
        }
        confirmLabel="Send invite"
        loading={inviteSaving}
        onConfirm={confirmInvite}
        onCancel={() => setPendingInvite(null)}
      />

      <AppShell
        pageTitle="Admin Panel"
        pageDescription="User roles, invites, and audit log"
        userEmail={currentEmail}
        userRole="admin"
        maxWidth="6xl"
        headerActions={
          <Link href="/dashboard" className={ui.btnHeader}>
            Back to dashboard
          </Link>
        }
        mainClassName="space-y-8"
      >
        {message ? (
          <Alert
            type={message.type}
            message={message.text}
            onDismiss={() => setMessage(null)}
          />
        ) : null}

        <section className={ui.card}>
          <div className={ui.cardHeader}>
            <h2 className={ui.sectionTitle}>Users</h2>
            <p className={ui.sectionSubtitle}>
              {profiles.length} registered · {adminCount} admin
              {adminCount === 1 ? "" : "s"}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className={ui.table}>
              <thead className={ui.tableHead}>
                <tr>
                  <th className={ui.tableHeadCell}>Email</th>
                  <th className={ui.tableHeadCell}>Role</th>
                  <th className={ui.tableHeadCell}>Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {profiles.map((profile) => {
                  const isSelf = profile.id === currentUserId;
                  const isAdminUser = profile.role === "admin";
                  const displayRole =
                    displayRoles[profile.id] ?? profile.role;
                  const wouldBeLastAdmin = isLastAdminDemotion(
                    profile,
                    "internal",
                    adminCount
                  );

                  return (
                    <tr
                      key={profile.id}
                      className={
                        isAdminUser
                          ? "bg-accent/10 hover:bg-accent/10"
                          : ui.tableRow
                      }
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 font-medium text-primary">
                          {isAdminUser ? (
                            <span
                              className="inline-block h-2 w-2 rounded-full bg-accent"
                              title="Admin"
                            />
                          ) : null}
                          {profile.email}
                          {isSelf ? (
                            <span className="text-xs font-normal text-muted">
                              (you)
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {isSelf ? (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadgeClass(profile.role)}`}
                          >
                            {profile.role}
                          </span>
                        ) : (
                          <select
                            value={displayRole}
                            disabled={isBusy}
                            onChange={(e) => {
                              const el = e.target;
                              handleRoleSelect(
                                profile,
                                el.value as UserRole,
                                el
                              );
                            }}
                            className={`${ui.input} max-w-[10rem] py-1.5 disabled:opacity-50`}
                            aria-label={`Change role for ${profile.email}`}
                          >
                            {USER_ROLES.map((role) => (
                              <option
                                key={role}
                                value={role}
                                disabled={
                                  isLastAdminDemotion(
                                    profile,
                                    role,
                                    adminCount
                                  ) && role !== "admin"
                                }
                              >
                                {role}
                                {wouldBeLastAdmin && role !== "admin"
                                  ? " (last admin)"
                                  : ""}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className={`px-6 py-4 text-muted`}>
                        {formatDate(profile.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className={ui.card}>
          <div className={ui.cardHeader}>
            <h2 className={ui.sectionTitle}>
              Invite user
            </h2>
            <p className={ui.sectionSubtitle}>
              Pre-assign a role before sign-up. Invited role overrides domain
              rules.
            </p>
          </div>

          <form
            onSubmit={handleInviteSubmit}
            className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label
                htmlFor="invite-email"
                className={ui.label}
              >
                Email
              </label>
              <input
                id="invite-email"
                type="email"
                required
                disabled={isBusy}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className={`${ui.input} disabled:opacity-50`}
              />
            </div>
            <div>
              <label
                htmlFor="invite-role"
                className={ui.label}
              >
                Role
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                disabled={isBusy}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className={`${ui.input} disabled:opacity-50`}
              >
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={isBusy || !inviteEmail.trim()}
              className={`${ui.btnPrimary} px-5 disabled:opacity-50`}
            >
              Review invite
            </button>
          </form>

          {invites.length > 0 ? (
            <div className="border-t border-border px-6 py-4">
              <h3 className="text-sm font-semibold text-primary">
                Pending invites ({invites.length})
              </h3>
              <ul className="mt-3 divide-y divide-border">
                {invites.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span className="font-medium text-primary">
                      {invite.email}
                    </span>
                    <span className="flex items-center gap-3 text-muted">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${roleBadgeClass(invite.role)}`}
                      >
                        {invite.role}
                      </span>
                      {formatDate(invite.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className={ui.card}>
          <div className={ui.cardHeader}>
            <h2 className={ui.sectionTitle}>Audit log</h2>
            <p className={ui.sectionSubtitle}>
              Role changes, invites, and denied admin actions.
            </p>
          </div>

          {auditLogs.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted">
              No admin actions recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className={ui.table}>
                <thead className={ui.tableHead}>
                  <tr>
                    <th className={ui.tableHeadCell}>Action</th>
                    <th className={ui.tableHeadCell}>Details</th>
                    <th className={ui.tableHeadCell}>When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {auditLogs.map((log) => (
                    <tr
                      key={log.id}
                      className={
                        log.action.endsWith("_denied")
                          ? "bg-red-50/40"
                          : ui.tableRow
                      }
                    >
                      <td className="px-6 py-4 font-mono text-xs text-primary/80">
                        {log.action}
                      </td>
                      <td className="max-w-xs truncate px-6 py-4 text-muted">
                        {formatAuditDetail(log)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-muted">
                        {formatDate(log.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </AppShell>
    </>
  );
}
