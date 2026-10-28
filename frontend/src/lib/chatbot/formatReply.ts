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

    if (parsed.action === "standup") {
      const openCount = Number(parsed.openCount ?? 0);
      const overdue = Array.isArray(parsed.overdue)
        ? (parsed.overdue as TaskCompactHeader[])
        : [];
      const overdueCount = Number(parsed.overdueCount ?? overdue.length);
      const dueToday = Array.isArray(parsed.dueToday)
        ? (parsed.dueToday as TaskCompactHeader[])
        : [];
      const dueTodayCount = Number(parsed.dueTodayCount ?? dueToday.length);
      const blocked = Array.isArray(parsed.blocked)
        ? (parsed.blocked as TaskCompactHeader[])
        : [];
      const blockedCount = Number(parsed.blockedCount ?? blocked.length);
      const critical = Array.isArray(parsed.critical)
        ? (parsed.critical as TaskCompactHeader[])
        : [];
      const criticalCount = Number(parsed.criticalCount ?? critical.length);
      const unassignedCount = Number(parsed.unassignedCount ?? 0);

      if (openCount === 0) {
        return "Project Standup (0 open): All tasks are complete!";
      }

      const lines: string[] = [
        `Project Standup (${openCount} open):`,
        `• Overdue: ${overdueCount} | Due today: ${dueTodayCount} | Blocked: ${blockedCount} | Critical: ${criticalCount} | Unassigned: ${unassignedCount}`,
      ];

      if (blocked.length > 0) {
        lines.push(
          `Blocked (${blockedCount}):`,
          ...blocked.slice(0, 3).map(formatCompactTaskBullet)
        );
      }
      if (overdue.length > 0) {
        lines.push(
          `Overdue (${overdueCount}):`,
          ...overdue.slice(0, 3).map(formatCompactTaskBullet)
        );
      }
      if (dueToday.length > 0) {
        lines.push(
          `Due today (${dueTodayCount}):`,
          ...dueToday.slice(0, 3).map(formatCompactTaskBullet)
        );
      }

      return lines.join("\n");
    }

    if (parsed.action === "workload") {
      const openCount = Number(parsed.openCount ?? 0);
      const unassignedCount = Number(parsed.unassignedCount ?? 0);
      const owners = Array.isArray(parsed.owners)
        ? (parsed.owners as Array<{ owner: string; open: number; overdue: number }>)
        : [];

      if (openCount === 0) {
        return "Owner Workload: No open tasks.";
      }

      const lines: string[] = [`Owner Workload (${openCount} open):`];
      for (const entry of owners.slice(0, 12)) {
        const overdueNote =
          entry.overdue > 0 ? ` (${entry.overdue} overdue)` : "";
        lines.push(`• ${entry.owner}: ${entry.open} open${overdueNote}`);
      }
      if (unassignedCount > 0) {
        lines.push(`• Unassigned: ${unassignedCount} open`);
      }

      return lines.join("\n");
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
        if (filter === "blocked") return "No blocked tasks.";
        if (filter === "critical") return "No critical or high-priority tasks.";
        if (filter === "milestones") return "No open milestone tasks.";
        if (filter === "unassigned") return "No unassigned open tasks.";
        return "No tasks found.";
      }

      const labelMap: Record<string, string> = {
        today: `Found ${tasks.length} task${tasks.length === 1 ? "" : "s"} due today:`,
        overdue: `Found ${tasks.length} overdue task${tasks.length === 1 ? "" : "s"}:`,
        blocked: `Found ${tasks.length} blocked task${tasks.length === 1 ? "" : "s"}:`,
        critical: `Found ${tasks.length} critical/high-priority task${tasks.length === 1 ? "" : "s"}:`,
        milestones: `Found ${tasks.length} milestone task${tasks.length === 1 ? "" : "s"}:`,
        unassigned: `Found ${tasks.length} unassigned task${tasks.length === 1 ? "" : "s"}:`,
      };

      const header =
        labelMap[filter] ??
        `Found ${tasks.length} task${tasks.length === 1 ? "" : "s"}:`;

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
