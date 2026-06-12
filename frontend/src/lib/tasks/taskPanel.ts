import {
  CLIENT_STATUS_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
  RISK_OPTIONS,
  SB_STATUS_OPTIONS,
} from "@/lib/tasks/constants";
import { createTask, updateTask } from "@/lib/tasks/api";
import { formatSbOwners, normalizeDateInput, parseSbOwners } from "@/lib/tasks/utils";
import type { Task, TaskPayload, TaskViewMode } from "@/lib/tasks/types";

export type TaskPanelDraft = {
  title: string;
  clientStatus: string;
  priority: string;
  responsible: string;
  dateDue: string;
  dateCompleted: string;
  actionComment: string;
  sbStatus: string;
  sbOwners: string[];
  risk: string;
  riskComment: string;
};

export function emptyPanelDraft(): TaskPanelDraft {
  return {
    title: "",
    clientStatus: CLIENT_STATUS_OPTIONS[0],
    priority: "",
    responsible: "",
    dateDue: "",
    dateCompleted: "",
    actionComment: "",
    sbStatus: "",
    sbOwners: [],
    risk: "",
    riskComment: "",
  };
}

export function taskToPanelDraft(task: Task): TaskPanelDraft {
  return {
    title: task.Issue ?? "",
    clientStatus: task.status ?? CLIENT_STATUS_OPTIONS[0],
    priority: task.Priority ?? "",
    responsible: task.Responsible ?? "",
    dateDue: normalizeDateInput(task["Date Due"]) ?? "",
    dateCompleted: normalizeDateInput(task["Date Completed"]) ?? "",
    actionComment: task["Response or Action taken by SB"] ?? "",
    sbStatus: task["SB Status"] ?? "",
    sbOwners: parseSbOwners(task["SB Owner"]),
    risk: task.Risk ?? "",
    riskComment: task["Risk Comment"] ?? "",
  };
}

export function panelDraftToPayload(draft: TaskPanelDraft): TaskPayload {
  const sbOwner = formatSbOwners(draft.sbOwners);

  return {
    Issue: draft.title,
    status: draft.clientStatus,
    Priority: draft.priority,
    Responsible: draft.responsible,
    "Date Due": draft.dateDue,
    "Date Completed": draft.dateCompleted,
    "Response or Action taken by SB": draft.actionComment,
    "SB Status": draft.sbStatus,
    "SB Owner": sbOwner ?? "",
    Risk: draft.risk,
    "Risk Comment": draft.riskComment,
  };
}

function ownersEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

export function panelDraftEquals(a: TaskPanelDraft, b: TaskPanelDraft): boolean {
  return (
    a.title === b.title &&
    a.clientStatus === b.clientStatus &&
    a.priority === b.priority &&
    a.responsible === b.responsible &&
    a.dateDue === b.dateDue &&
    a.dateCompleted === b.dateCompleted &&
    a.actionComment === b.actionComment &&
    a.sbStatus === b.sbStatus &&
    ownersEqual(a.sbOwners, b.sbOwners) &&
    a.risk === b.risk &&
    a.riskComment === b.riskComment
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
  taskUuid: string | null,
  draft: TaskPanelDraft
): Promise<Task> {
  const payload = panelDraftToPayload(draft);
  if (taskUuid) {
    return updateTask(mode, taskUuid, payload);
  }
  return createTask(mode, payload);
}

export { CLIENT_STATUS_OPTIONS, PRIORITY_FILTER_OPTIONS, RISK_OPTIONS, SB_STATUS_OPTIONS };
