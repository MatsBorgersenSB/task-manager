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
};

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

export async function fetchTaskActivityLogs(
  taskId: string
): Promise<TaskActivityFetchResult> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, task_id, field_name, old_value, new_value, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isActivityLogsMissingError(error)) {
      return { logs: [], tableMissing: true };
    }
    throw new Error(supabaseErrorMessage(error));
  }

  return { logs: (data ?? []) as TaskActivityLog[], tableMissing: false };
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
