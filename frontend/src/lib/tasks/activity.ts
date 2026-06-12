"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fieldLabel } from "@/lib/tasks/labels";
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

function displayActivityValue(value: string | null | undefined): string {
  if (value == null || value.trim() === "") {
    return "empty";
  }
  return value.trim();
}

export function formatActivityEntry(log: TaskActivityLog): string {
  const label = fieldLabel(log.field_name);
  const oldValue = displayActivityValue(log.old_value);
  const newValue = displayActivityValue(log.new_value);
  return `${label} changed from ${oldValue} to ${newValue}`;
}

export async function fetchTaskActivityLogs(
  taskId: string
): Promise<TaskActivityLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, task_id, field_name, old_value, new_value, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return (data ?? []) as TaskActivityLog[];
}

export function useTaskActivity(taskId: string | null, refreshKey?: string | null) {
  const [logs, setLogs] = useState<TaskActivityLog[]>([]);
  const [loading, setLoading] = useState(Boolean(taskId));
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    if (!taskId) {
      setLogs([]);
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const next = await fetchTaskActivityLogs(taskId);
      setLogs(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity.");
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

  return { logs, loading, error, reload: loadLogs };
}

export { formatPanelTimestamp };
