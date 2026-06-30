"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
  type EnrichedUserNotification,
} from "@/lib/tasks/notifications";
import { notificationTypeLabel, notificationIcon } from "@/lib/tasks/notificationTypes";
import { formatPanelTimestamp } from "@/lib/tasks/taskPanel";
import { ui } from "@/lib/ui/classes";

function formatBadgeCount(count: number): string {
  if (count <= 0) return "0";
  if (count > 12) return "12+";
  return String(count);
}

function taskLink(notification: EnrichedUserNotification): string | null {
  if (!notification.project_id) return null;
  const params = new URLSearchParams({ project: notification.project_id });
  if (notification.task_id) {
    params.set("task", notification.task_id);
  }
  return `/internal?${params.toString()}`;
}

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: EnrichedUserNotification;
  onMarkRead: (id: string) => void;
}) {
  const unread = !notification.read_at;
  const href = taskLink(notification);
  const typeLabel = notificationTypeLabel(notification.title);
  const taskName =
    notification.task_title?.trim() ||
    (notification.task_number != null ? `Task #${notification.task_number}` : null);

  return (
    <li
      className={`px-4 py-3 ${unread ? "bg-blue-50/50" : "bg-white"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-primary">
            {notificationIcon(notification.title)} {typeLabel}
            {unread ? (
              <span className="ml-2 inline-flex rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Unread
              </span>
            ) : null}
          </p>
          {taskName ? (
            <p className="mt-0.5 text-sm text-primary/90">{taskName}</p>
          ) : null}
          {notification.body ? (
            <p className="mt-1 text-xs text-muted">{notification.body}</p>
          ) : null}
          {notification.project_name ? (
            <p className="mt-1 text-[11px] text-muted">
              Project: {notification.project_name}
            </p>
          ) : null}
          <p className="mt-1 text-[10px] text-muted">
            {formatPanelTimestamp(notification.created_at)}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {unread ? (
          <button
            type="button"
            onClick={() => void onMarkRead(notification.id)}
            className="text-xs font-medium text-accent hover:underline"
          >
            Mark read
          </button>
        ) : null}
        {href ? (
          <Link
            href={href}
            className="text-xs font-medium text-accent hover:underline"
          >
            Open task
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<EnrichedUserNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await fetchUserNotifications();
      setNotifications(result.notifications);
      if (result.error) {
        setLoadError(result.error);
      }
    } catch (err) {
      setNotifications([]);
      setLoadError(
        err instanceof Error ? err.message : "Failed to load notifications."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const unread = unreadNotificationCount(notifications);

  async function handleMarkRead(id: string) {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n
      )
    );
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
    );
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`${ui.btnSecondarySm} relative inline-flex items-center gap-1.5`}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
      >
        <span aria-hidden>🔔</span>
        {unread > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white">
            {formatBadgeCount(unread)}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-primary">🔔 Notifications</h2>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                className="text-xs font-medium text-accent hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-[28rem] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-sm text-muted">Loading…</p>
            ) : loadError ? (
              <p className="px-4 py-6 text-sm text-red-700">{loadError}</p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">No notifications yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={handleMarkRead}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
