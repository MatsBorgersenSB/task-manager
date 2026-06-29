import { createClient } from "@/lib/supabase/client";
import type { TaskComment } from "@/lib/tasks/comments";

type CommentSnapshot = {
  task_id: string;
  type: "client" | "internal";
  created_at: string;
};

/** True when the latest client message has no internal reply after it. */
export function taskHasUnansweredClientComment(
  comments: Pick<TaskComment, "type" | "created_at">[]
): boolean {
  if (comments.length === 0) return false;

  const sorted = [...comments].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  let latestClientAt: string | null = null;
  for (const comment of sorted) {
    if (comment.type === "client") {
      latestClientAt = comment.created_at;
    }
  }

  if (!latestClientAt) return false;

  const latestClientTime = new Date(latestClientAt).getTime();
  return !sorted.some(
    (comment) =>
      comment.type === "internal" &&
      new Date(comment.created_at).getTime() > latestClientTime
  );
}

export function countUnansweredFromSnapshots(
  snapshots: CommentSnapshot[]
): number {
  const byTask = new Map<string, CommentSnapshot[]>();
  for (const row of snapshots) {
    const list = byTask.get(row.task_id) ?? [];
    list.push(row);
    byTask.set(row.task_id, list);
  }

  let count = 0;
  for (const comments of byTask.values()) {
    if (taskHasUnansweredClientComment(comments)) {
      count += 1;
    }
  }
  return count;
}

export function waitingTaskIdsFromSnapshots(
  snapshots: CommentSnapshot[]
): Set<string> {
  const byTask = new Map<string, CommentSnapshot[]>();
  for (const row of snapshots) {
    const list = byTask.get(row.task_id) ?? [];
    list.push(row);
    byTask.set(row.task_id, list);
  }

  const waiting = new Set<string>();
  for (const [taskId, comments] of byTask.entries()) {
    if (taskHasUnansweredClientComment(comments)) {
      waiting.add(taskId);
    }
  }
  return waiting;
}

export async function fetchWaitingForResponseTaskIds(
  taskIds: string[]
): Promise<Set<string>> {
  if (taskIds.length === 0) return new Set();

  const supabase = createClient();
  const { data, error } = await supabase
    .from("comments")
    .select("task_id, type, created_at")
    .in("task_id", taskIds)
    .order("created_at", { ascending: true });

  if (error) {
    return new Set();
  }

  return waitingTaskIdsFromSnapshots((data ?? []) as CommentSnapshot[]);
}
