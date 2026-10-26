import type { TaskCompactHeader } from "@/types/task-compact";

function formatCompactTaskBullet(task: TaskCompactHeader): string {
  const title = task.title?.trim() || "Untitled";
  const meta: string[] = [];
  if (task.priority) meta.push(task.priority);
  else if (task.sbPriority) meta.push(task.sbPriority);

  if (task.status) meta.push(task.status);
  else if (task.sbStatus) meta.push(task.sbStatus);

  if (task.dateDue) meta.push(`Due ${task.dateDue}`);

  const suffix = meta.length > 0 ? ` (${meta.join(" · ")})` : "";
  return `• #${task.id} ${title}${suffix}`;
}

/**
 * Formats deterministic compact JSON responses from `/api/chat` into
 * human-readable summaries for the ChatAssistant UI, while leaving
 * standard LLM plain-text replies untouched.
 */
export function formatAssistantReply(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    return raw;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;

    if (parsed.action === "complete_task") {
      if (parsed.ok === true && parsed.task && typeof parsed.task === "object") {
        const task = parsed.task as TaskCompactHeader;
        const label = task.title ? ` ("${task.title}")` : "";
        return `Marked task #${task.id}${label} as Complete.`;
      }
      if (typeof parsed.error === "string" && parsed.error.trim()) {
        return parsed.error;
      }
      return "Could not complete the requested task.";
    }

    if (
      typeof parsed.filter === "string" &&
      Array.isArray(parsed.tasks)
    ) {
      const filter = parsed.filter;
      const tasks = parsed.tasks as TaskCompactHeader[];

      if (tasks.length === 0) {
        if (filter === "today") return "No tasks due today.";
        if (filter === "overdue") return "No overdue tasks.";
        return "No tasks found.";
      }

      const header =
        filter === "today"
          ? `Found ${tasks.length} task${tasks.length === 1 ? "" : "s"} due today:`
          : filter === "overdue"
            ? `Found ${tasks.length} overdue task${tasks.length === 1 ? "" : "s"}:`
            : `Found ${tasks.length} task${tasks.length === 1 ? "" : "s"}:`;

      const lines = tasks.slice(0, 15).map(formatCompactTaskBullet);
      if (tasks.length > 15) {
        lines.push(`• …and ${tasks.length - 15} more`);
      }

      return [header, ...lines].join("\n");
    }
  } catch {
    return raw;
  }

  return raw;
}
