"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fieldLabel } from "@/lib/tasks/labels";
import { formatVisibilityScope } from "@/lib/tasks/visibility";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import { formatPanelTimestamp } from "@/lib/tasks/taskPanel";

export type TaskActivityLog = {
  id: string;
  task_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  changed_by: string | null;
  changed_by_email: string | null;
};

type ActivityLogRow = {
  id: string;
  task_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  changed_by: string | null;
  changer: { email: string } | { email: string }[] | null;
};

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
  return email && email.length > 0 ? email : "Unknown user";
}

export async function fetchTaskActivityLogs(
  taskId: string
): Promise<TaskActivityFetchResult> {
  const supabase = createClient();
  const baseSelect =
    "id, task_id, field_name, old_value, new_value, created_at, changed_by";

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
      logs: fallbackRows.map((row) =>
        mapActivityLogRow({
          ...row,
          changer: row.changed_by
            ? { email: emailById.get(row.changed_by) ?? "" }
            : null,
        })
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
    logs: ((data ?? []) as ActivityLogRow[]).map(mapActivityLogRow),
    tableMissing: false,
  };
}

export function useTaskActivity(taskId: string | null, refreshKey?: string | null) {
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
      const result = await fetchTaskActivityLogs(taskId);
      setLogs(result.logs);
      setTableMissing(result.tableMissing);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity.");
      setTableMissing(false);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) {
      setLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    void loadLogs();
  }, [loadLogs, refreshKey, taskId]);

  return { logs, loading, error, tableMissing, reload: loadLogs };
}

export { formatPanelTimestamp };
