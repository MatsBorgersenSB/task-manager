import { updateTask } from "@/lib/tasks/api";
import type { Task, TaskPayload, TaskViewMode } from "@/lib/tasks/types";

export const TASK_PANEL_STATUS_OPTIONS = [
  "Blocked",
  "In Progress",
  "Review",
  "Done",
] as const;

export const TASK_PANEL_PRIORITY_OPTIONS = [
  "Low",
  "Medium",
  "High",
  "Critical",
] as const;

export type TaskPanelDraft = {
  title: string;
  status: string;
  priority: string;
  responsible: string;
};

export function taskToPanelDraft(task: Task): TaskPanelDraft {
  return {
    title: task.Issue ?? "",
    status: task.status ?? TASK_PANEL_STATUS_OPTIONS[0],
    priority: task.Priority ?? TASK_PANEL_PRIORITY_OPTIONS[1],
    responsible: task.Responsible ?? "",
  };
}

export function panelDraftToPayload(draft: TaskPanelDraft): TaskPayload {
  return {
    Issue: draft.title,
    status: draft.status,
    Priority: draft.priority,
    Responsible: draft.responsible,
  };
}

export function panelDraftEquals(a: TaskPanelDraft, b: TaskPanelDraft): boolean {
  return (
    a.title === b.title &&
    a.status === b.status &&
    a.priority === b.priority &&
    a.responsible === b.responsible
  );
}

export function formatPanelTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export async function saveTaskPanel(
  mode: TaskViewMode,
  taskUuid: string,
  draft: TaskPanelDraft
): Promise<Task> {
  return updateTask(mode, taskUuid, panelDraftToPayload(draft));
}
