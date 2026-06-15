import {
  CLIENT_STATUS_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
  RISK_OPTIONS,
  SB_STATUS_OPTIONS,
  SB_PRIORITY_OPTIONS,
} from "@/lib/tasks/constants";
import {
  DEFAULT_VISIBILITY_SCOPE,
  normalizeVisibilityScope,
} from "@/lib/tasks/visibility";
import { createTask, updateTask } from "@/lib/tasks/api";
import { logTaskFieldChanges } from "@/lib/tasks/activityLogging";
import { formatSbOwners, normalizeDateInput, parseSbOwners } from "@/lib/tasks/utils";
import type { Task, TaskPayload, TaskViewMode } from "@/lib/tasks/types";

export type TaskPanelDraft = {
  title: string;
  clientStatus: string;
  priority: string;
  visibilityScope: string;
  responsible: string;
  ceComments: string;
  dateDue: string;
  dateCompleted: string;
  actionComment: string;
  sbStatus: string;
  sbPriority: string;
  sbOwners: string[];
  risk: string;
  riskComment: string;
  sbNote: string;
};

/** Maps table field names to TaskPanelDraft keys. */
export const FIELD_TO_DRAFT_KEY: Record<string, keyof TaskPanelDraft> = {
  Issue: "title",
  status: "clientStatus",
  Priority: "priority",
  Visibility: "visibilityScope",
  Responsible: "responsible",
  "CE Comments": "ceComments",
  "Date Due": "dateDue",
  "Date Completed": "dateCompleted",
  "Response or Action taken by SB": "actionComment",
  "SB Status": "sbStatus",
  "SB Priority": "sbPriority",
  "SB Owner": "sbOwners",
  Risk: "risk",
  "Risk Comment": "riskComment",
  "SB Note": "sbNote",
};

export function getPanelDraftValue(
  draft: TaskPanelDraft,
  fieldName: string
): string | string[] {
  const key = FIELD_TO_DRAFT_KEY[fieldName];
  if (!key) return "";
  return draft[key];
}

export function setPanelDraftField(
  draft: TaskPanelDraft,
  fieldName: string,
  value: string | string[]
): TaskPanelDraft {
  const key = FIELD_TO_DRAFT_KEY[fieldName];
  if (!key) return draft;
  return { ...draft, [key]: value };
}

export function emptyPanelDraft(): TaskPanelDraft {
  return {
    title: "",
    clientStatus: CLIENT_STATUS_OPTIONS[0],
    priority: "",
    visibilityScope: DEFAULT_VISIBILITY_SCOPE,
    responsible: "",
    ceComments: "",
    dateDue: "",
    dateCompleted: "",
    actionComment: "",
    sbStatus: "",
    sbPriority: "",
    sbOwners: [],
    risk: "",
    riskComment: "",
    sbNote: "",
  };
}

export function taskToPanelDraft(task: Task): TaskPanelDraft {
  return {
    title: task.Issue ?? "",
    clientStatus: task.status ?? CLIENT_STATUS_OPTIONS[0],
    priority: task.Priority ?? "",
    visibilityScope: normalizeVisibilityScope(task.visibility_scope),
    responsible: task.Responsible ?? "",
    ceComments: task["CE Comments"] ?? "",
    dateDue: normalizeDateInput(task["Date Due"]) ?? "",
    dateCompleted: normalizeDateInput(task["Date Completed"]) ?? "",
    actionComment: task["Response or Action taken by SB"] ?? "",
    sbStatus: task["SB Status"] ?? "",
    sbPriority: task["SB Priority"] ?? "",
    sbOwners: parseSbOwners(task["SB Owner"]),
    risk: task.Risk ?? "",
    riskComment: task["Risk Comment"] ?? "",
    sbNote: task["SB Note"] ?? "",
  };
}

export function panelDraftToPayload(draft: TaskPanelDraft): TaskPayload {
  const sbOwner = formatSbOwners(draft.sbOwners);

  return {
    Issue: draft.title,
    status: draft.clientStatus,
    Priority: draft.priority,
    visibility_scope: normalizeVisibilityScope(draft.visibilityScope),
    Responsible: draft.responsible,
    "CE Comments": draft.ceComments,
    "Date Due": draft.dateDue,
    "Date Completed": draft.dateCompleted,
    "Response or Action taken by SB": draft.actionComment,
    "SB Status": draft.sbStatus,
    "SB Priority": draft.sbPriority,
    "SB Owner": sbOwner ?? "",
    Risk: draft.risk,
    "Risk Comment": draft.riskComment,
    "SB Note": draft.sbNote,
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
    a.visibilityScope === b.visibilityScope &&
    a.responsible === b.responsible &&
    a.ceComments === b.ceComments &&
    a.dateDue === b.dateDue &&
    a.dateCompleted === b.dateCompleted &&
    a.actionComment === b.actionComment &&
    a.sbStatus === b.sbStatus &&
    a.sbPriority === b.sbPriority &&
    ownersEqual(a.sbOwners, b.sbOwners) &&
    a.risk === b.risk &&
    a.riskComment === b.riskComment &&
    a.sbNote === b.sbNote
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
  draft: TaskPanelDraft,
  previousDraft?: TaskPanelDraft
): Promise<Task> {
  const payload = panelDraftToPayload(draft);
  if (taskUuid) {
    if (previousDraft) {
      try {
        await logTaskFieldChanges(mode, taskUuid, previousDraft, draft);
      } catch {
        // Activity logging must not block task saves.
      }
    }
    return updateTask(mode, taskUuid, payload);
  }
  return createTask(mode, payload);
}

export { CLIENT_STATUS_OPTIONS, PRIORITY_FILTER_OPTIONS, RISK_OPTIONS, SB_PRIORITY_OPTIONS, SB_STATUS_OPTIONS };
