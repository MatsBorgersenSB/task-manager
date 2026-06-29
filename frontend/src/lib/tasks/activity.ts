"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fieldLabel } from "@/lib/tasks/labels";
import {
  isActivityVisibleToClient,
  type TaskActivityEventType,
} from "@/lib/tasks/activityEvents";
import { formatVisibilityScope } from "@/lib/tasks/visibility";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import { formatPanelTimestamp } from "@/lib/tasks/taskPanel";
import type { TaskViewMode } from "@/lib/tasks/types";

export type TaskActivityLog = {
  id: string;
  task_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  changed_by: string | null;
  changed_by_email: string | null;
  event_type: TaskActivityEventType;
};

type ActivityLogRow = {
  id: string;
  task_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  changed_by: string | null;
  event_type?: string | null;
  changer: { email: string } | { email: string }[] | null;
};

function normalizeEventType(value: string | null | undefined): TaskActivityEventType {
  const allowed: TaskActivityEventType[] = [
    "field_change",
    "task_created",
    "status_changed",
    "due_date_changed",
    "responsible_changed",
    "comment_added",
    "link_added",
    "subtask_created",
    "converted_to_subtask",
    "promoted_to_main",
  ];
  if (value && allowed.includes(value as TaskActivityEventType)) {
    return value as TaskActivityEventType;
  }
  return "field_change";
}

function mapActivityLogRow(row: ActivityLogRow): TaskActivityLog {
  const changer = row.changer;
  const email = Array.isArray(changer)
    ? changer[0]?.email ?? null
    : changer?.email ?? null;

  return {
    id: row.id,
    task_id: row.task_id,
    field_name: row.field_name,
    old_value: row.old_value,
    new_value: row.new_value,
    created_at: row.created_at,
    changed_by: row.changed_by,
    changed_by_email: email,
    event_type: normalizeEventType(row.event_type),
  };
}

export type TaskActivityFetchResult = {
  logs: TaskActivityLog[];
  /** True when the activity_logs table has not been created in Supabase yet. */
  tableMissing: boolean;
};

function isActivityLogsMissingError(error: { message: string; code?: string }): boolean {
  const message = error.message.toLowerCase();
  return (
    error.code === "PGRST205" ||
    (message.includes("activity_logs") &&
      (message.includes("schema cache") ||
        message.includes("does not exist") ||
        message.includes("could not find the table")))
  );
}

function displayActivityValue(value: string | null | undefined): string {
  if (value == null || value.trim() === "") {
    return "empty";
  }
  return value.trim();
}

export function formatActivityEntry(log: TaskActivityLog): string {
  const label = fieldLabel(log.field_name);
  const formatValue = (value: string | null | undefined) =>
    log.field_name === "Visibility"
      ? formatVisibilityScope(value)
      : displayActivityValue(value);
  const oldValue = formatValue(log.old_value);
  const newValue = formatValue(log.new_value);
  return `${label} changed from ${oldValue} to ${newValue}`;
}

export function formatActivityUser(log: TaskActivityLog): string {
  const email = log.changed_by_email?.trim();
  if (email && email.length > 0) {
    const localPart = email.split("@")[0] ?? email;
    return localPart.replace(/[._]/g, " ");
  }
  return "Unknown user";
}

export function formatHistoryHeadline(log: TaskActivityLog): string {
  const user = formatActivityUser(log);

  switch (log.event_type) {
    case "task_created":
      return `${user} created this task`;
    case "comment_added":
      return `${user} added ${log.field_name.toLowerCase()}`;
    case "link_added":
      return `${user} added a link`;
    case "subtask_created":
      return `${user} created subtask`;
    case "converted_to_subtask":
      return `${user} converted task to subtask`;
    case "promoted_to_main":
      return `${user} promoted subtask to main task`;
    case "status_changed":
      return `${user} changed ${fieldLabel("status")}`;
    case "due_date_changed":
      return `${user} changed ${fieldLabel("Date Due")}`;
    case "responsible_changed":
      return `${user} changed ${fieldLabel("Responsible")}`;
    default:
      return `${user} changed ${fieldLabel(log.field_name)}`;
  }
}

export function formatHistoryDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function filterActivityLogsForMode(
  logs: TaskActivityLog[],
  mode: TaskViewMode
): TaskActivityLog[] {
  if (mode === "internal") return logs;
  return logs.filter((log) =>
    isActivityVisibleToClient(log.event_type, log.field_name)
  );
}

export async function fetchTaskActivityLogs(
  taskId: string,
  mode: TaskViewMode = "internal"
): Promise<TaskActivityFetchResult> {
  const supabase = createClient();
  const baseSelect =
    "id, task_id, field_name, old_value, new_value, created_at, changed_by, event_type";

  let { data, error } = await supabase
    .from("activity_logs")
    .select(
      `${baseSelect}, changer:profiles!activity_logs_changed_by_fkey(email)`
    )
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error && !isActivityLogsMissingError(error)) {
    const fallback = await supabase
      .from("activity_logs")
      .select(baseSelect)
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });

    if (fallback.error) {
      if (isActivityLogsMissingError(fallback.error)) {
        return { logs: [], tableMissing: true };
      }
      throw new Error(supabaseErrorMessage(fallback.error));
    }

    const fallbackRows = (fallback.data ?? []) as Omit<ActivityLogRow, "changer">[];
    error = null;

    const userIds = [
      ...new Set(
        fallbackRows
          .map((row) => row.changed_by)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const emailById = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);

      for (const profile of profiles ?? []) {
        if (profile.id && profile.email) {
          emailById.set(profile.id, profile.email);
        }
      }
    }

    return {
      logs: filterActivityLogsForMode(
        fallbackRows.map((row) =>
          mapActivityLogRow({
            ...row,
            changer: row.changed_by
              ? { email: emailById.get(row.changed_by) ?? "" }
              : null,
          })
        ),
        mode
      ),
      tableMissing: false,
    };
  }

  if (error) {
    if (isActivityLogsMissingError(error)) {
      return { logs: [], tableMissing: true };
    }
    throw new Error(supabaseErrorMessage(error));
  }

  return {
    logs: filterActivityLogsForMode(
      ((data ?? []) as ActivityLogRow[]).map(mapActivityLogRow),
      mode
    ),
    tableMissing: false,
  };
}

export function useTaskActivity(
  taskId: string | null,
  mode: TaskViewMode = "internal",
  refreshKey?: string | null
) {
  const [logs, setLogs] = useState<TaskActivityLog[]>([]);
  const [loading, setLoading] = useState(Boolean(taskId));
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);

  const loadLogs = useCallback(async () => {
    if (!taskId) {
      setLogs([]);
      setLoading(false);
      setTableMissing(false);
      return;
    }

    setError(null);
    try {
      const result = await fetchTaskActivityLogs(taskId, mode);
      setLogs(result.logs);
      setTableMissing(result.tableMissing);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity.");
      setTableMissing(false);
    } finally {
      setLoading(false);
    }
  }, [taskId, mode]);

  useEffect(() => {
    if (!taskId) {
      setLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    void loadLogs();
  }, [loadLogs, refreshKey, taskId, mode]);

  return { logs, loading, error, tableMissing, reload: loadLogs };
}

export { formatPanelTimestamp };
