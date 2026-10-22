import { createClient } from "@/lib/supabase/client";
import { waitingTaskIdsFromSnapshots } from "@/lib/tasks/commentAttention";
import { getTaskDueStatus, isTaskComplete } from "@/lib/tasks/taskDates";

export type ProjectWorkSignal = {
  overdue: number;
  waiting: number;
};

type TaskSignalRow = {
  id: string;
  project_id: string | null;
  parent_task_id: string | null;
  status: string | null;
  date_due: string | null;
  date_completed: string | null;
};

type CommentSignalRow = {
  task_id: string;
  type: "client" | "internal";
  created_at: string;
};

const TASK_ID_CHUNK = 150;

function emptySignal(): ProjectWorkSignal {
  return { overdue: 0, waiting: 0 };
}

/** Overdue and waiting counts for main tasks, grouped by project. */
export async function fetchProjectWorkSignals(): Promise<
  Record<string, ProjectWorkSignal>
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, project_id, parent_task_id, status, date_due, date_completed");

  if (error || !data) return {};

  const signals: Record<string, ProjectWorkSignal> = {};
  const openMainTaskProject = new Map<string, string>();

  for (const row of data as TaskSignalRow[]) {
    if (!row.project_id || row.parent_task_id) continue;
    const task = {
      status: row.status,
      "Date Due": row.date_due?.slice(0, 10) ?? null,
      "Date Completed": row.date_completed?.slice(0, 10) ?? null,
    };
    const bucket = signals[row.project_id] ?? emptySignal();
    if (getTaskDueStatus(task) === "overdue") bucket.overdue += 1;
    signals[row.project_id] = bucket;
    if (!isTaskComplete(task)) {
      openMainTaskProject.set(row.id, row.project_id);
    }
  }

  const taskIds = [...openMainTaskProject.keys()];
  for (let index = 0; index < taskIds.length; index += TASK_ID_CHUNK) {
    const chunk = taskIds.slice(index, index + TASK_ID_CHUNK);
    const { data: comments, error: commentError } = await supabase
      .from("comments")
      .select("task_id, type, created_at")
      .in("task_id", chunk);

    if (commentError || !comments) continue;

    const waiting = waitingTaskIdsFromSnapshots(comments as CommentSignalRow[]);
    for (const taskId of waiting) {
      const projectId = openMainTaskProject.get(taskId);
      if (!projectId) continue;
      const bucket = signals[projectId] ?? emptySignal();
      bucket.waiting += 1;
      signals[projectId] = bucket;
    }
  }

  return signals;
}
