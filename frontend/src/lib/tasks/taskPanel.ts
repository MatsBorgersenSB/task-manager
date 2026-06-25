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
import { mergeAreas, replaceAreaInList, AREA_CUSTOM_VALUE, AREA_NONE_VALUE, findAreaOption, findAreaRecordByCode, findAreaInListById, isNoAreaValue, type Area } from "@/lib/tasks/areas";
import { resolveAreaForTask, resolveExistingAreaForTask, type AreaUpdateInfo } from "@/lib/tasks/areasApi";
import { createTask, updateTask } from "@/lib/tasks/api";
import { logTaskFieldChanges } from "@/lib/tasks/activityLogging";
import { formatSbOwners, normalizeDateInput, parseSbOwners } from "@/lib/tasks/utils";
import type { Task, TaskPayload, TaskViewMode } from "@/lib/tasks/types";

export type AreaDraftChangeMeta = {
  areaId?: string;
  editName?: string;
};

export type TaskPanelDraft = {
  title: string;
  clientStatus: string;
  priority: string;
  areaSelectedValue: string;
  areaSelectedId: string;
  areaEditName: string;
  customAreaInput: string;
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
  if (fieldName === "Area") {
    if (draft.areaSelectedValue === AREA_CUSTOM_VALUE) {
      return draft.customAreaInput.trim();
    }
    if (isNoAreaValue(draft.areaSelectedValue)) {
      return AREA_NONE_VALUE;
    }
    const code = draft.areaSelectedValue.trim();
    const name = draft.areaEditName.trim();
    if (name) {
      return `${name} (${code})`;
    }
    return code;
  }
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
    areaSelectedValue: AREA_NONE_VALUE,
    areaSelectedId: "",
    areaEditName: "",
    customAreaInput: "",
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

export function taskToPanelDraft(task: Task, areas: Area[] = []): TaskPanelDraft {
  const base = {
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

  const areaCode = (task.areaCode ?? "").trim();
  const areaName = (task.areaName ?? "").trim();
  const byCode = areaCode ? findAreaRecordByCode(areaCode, areas) : undefined;
  if (byCode) {
    return {
      ...base,
      areaSelectedValue: byCode.code,
      areaSelectedId: byCode.id,
      areaEditName: areaName || byCode.name,
      customAreaInput: "",
    };
  }

  const predefined = findAreaOption(areas, task.areaName, task.areaCode);
  if (predefined) {
    const record = findAreaRecordByCode(predefined.code, areas);
    return {
      ...base,
      areaSelectedValue: predefined.code,
      areaSelectedId: record?.id ?? "",
      areaEditName: areaName || record?.name || predefined.name,
      customAreaInput: "",
    };
  }

  if (areaName || areaCode) {
    return {
      ...base,
      areaSelectedValue: AREA_CUSTOM_VALUE,
      areaSelectedId: "",
      areaEditName: "",
      customAreaInput: areaName || areaCode,
    };
  }

  return {
    ...base,
    areaSelectedValue: AREA_NONE_VALUE,
    areaSelectedId: "",
    areaEditName: "",
    customAreaInput: "",
  };
}

export function panelDraftToPayload(
  draft: TaskPanelDraft,
  area: { areaName: string; areaCode: string } = { areaName: "", areaCode: "" }
): TaskPayload {
  const sbOwner = formatSbOwners(draft.sbOwners);

  return {
    Issue: draft.title,
    status: draft.clientStatus,
    Priority: draft.priority,
    areaName: area.areaName,
    areaCode: area.areaCode,
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
    a.areaSelectedValue === b.areaSelectedValue &&
    a.areaSelectedId === b.areaSelectedId &&
    a.areaEditName === b.areaEditName &&
    a.customAreaInput === b.customAreaInput &&
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

export function resolveAreaIdFromDraft(
  draft: TaskPanelDraft,
  areas: Area[]
): string {
  const existing = draft.areaSelectedId.trim();
  if (existing) return existing;

  const code = draft.areaSelectedValue.trim();
  if (!code || isNoAreaValue(code) || code === AREA_CUSTOM_VALUE) return "";

  return findAreaRecordByCode(code, areas)?.id ?? "";
}

/** Prefer area id over dropdown code (code may be stale after rename). */
export function resolveAreaSelectionFromDraft(
  draft: TaskPanelDraft,
  areas: Area[]
): { areaId: string; code: string; name: string } | null {
  const areaId = resolveAreaIdFromDraft(draft, areas);
  if (areaId) {
    const byId = findAreaInListById(areaId, areas);
    if (byId) {
      return { areaId: byId.id, code: byId.code, name: byId.name };
    }
    return { areaId, code: draft.areaSelectedValue.trim(), name: draft.areaEditName.trim() };
  }

  const code = draft.areaSelectedValue.trim();
  if (!code || isNoAreaValue(code) || code === AREA_CUSTOM_VALUE) return null;

  const byCode = findAreaRecordByCode(code, areas);
  if (!byCode) return null;

  return { areaId: byCode.id, code: byCode.code, name: byCode.name };
}

export function applyUpdatedAreaToDraft(
  draft: TaskPanelDraft,
  area: Area
): TaskPanelDraft {
  return {
    ...draft,
    areaSelectedId: area.id,
    areaSelectedValue: area.code,
    areaEditName: area.name,
    customAreaInput: "",
  };
}

export function mergePanelDraftFromTask(
  preserved: TaskPanelDraft,
  fromTask: TaskPanelDraft
): TaskPanelDraft {
  const preserveArea =
    Boolean(preserved.areaSelectedId.trim()) &&
    (preserved.areaSelectedId !== fromTask.areaSelectedId ||
      preserved.areaSelectedValue !== fromTask.areaSelectedValue ||
      preserved.areaEditName !== fromTask.areaEditName);

  if (!preserveArea) return fromTask;

  return {
    ...fromTask,
    areaSelectedId: preserved.areaSelectedId,
    areaSelectedValue: preserved.areaSelectedValue,
    areaEditName: preserved.areaEditName,
    customAreaInput: preserved.customAreaInput,
  };
}

export function syncDraftAfterSave(
  task: Task,
  areas: Area[],
  updatedArea?: Area
): TaskPanelDraft {
  let draft = taskToPanelDraft(task, areas);
  if (updatedArea) {
    return applyUpdatedAreaToDraft(draft, updatedArea);
  }

  const byId = draft.areaSelectedId
    ? findAreaInListById(draft.areaSelectedId, areas)
    : undefined;
  if (byId) {
    return applyUpdatedAreaToDraft(draft, byId);
  }

  return draft;
}

export function getAreaInputForSave(
  draft: TaskPanelDraft,
  areas: Area[] = []
): {
  isCustom: boolean;
  areaInput: string;
  areaId: string;
  editName: string;
} {
  if (isNoAreaValue(draft.areaSelectedValue)) {
    return { isCustom: false, areaInput: "", areaId: "", editName: "" };
  }

  const isCustom = draft.areaSelectedValue === AREA_CUSTOM_VALUE;
  if (isCustom) {
    return {
      isCustom: true,
      areaInput: draft.customAreaInput.trim(),
      areaId: "",
      editName: "",
    };
  }

  const selection = resolveAreaSelectionFromDraft(draft, areas);

  return {
    isCustom: false,
    areaInput: selection?.code ?? draft.areaSelectedValue.trim(),
    areaId: selection?.areaId ?? resolveAreaIdFromDraft(draft, areas),
    editName: draft.areaEditName.trim(),
  };
}

export async function saveTaskPanel(
  mode: TaskViewMode,
  taskUuid: string | null,
  draft: TaskPanelDraft,
  areas: Area[],
  previousDraft?: TaskPanelDraft
): Promise<{
  task: Task;
  areas?: Area[];
  areaUpdate?: AreaUpdateInfo;
  updatedArea?: Area;
}> {
  const { areaInput, areaId, editName, isCustom } = getAreaInputForSave(
    draft,
    areas
  );
  const resolved =
    areaId && !isCustom
      ? await resolveExistingAreaForTask(areaId, editName, areas)
      : await resolveAreaForTask(areaInput, areas, {
          areaId,
          editName,
          isCustom,
        });
  const payload = panelDraftToPayload(draft, {
    areaName: resolved.areaName,
    areaCode: resolved.areaCode,
  });

  let task: Task;
  if (taskUuid) {
    if (previousDraft) {
      try {
        await logTaskFieldChanges(mode, taskUuid, previousDraft, draft);
      } catch {
        // Activity logging must not block task saves.
      }
    }
    task = await updateTask(mode, taskUuid, payload);
  } else {
    task = await createTask(mode, payload);
  }

  let nextAreas = areas;
  if (resolved.newArea) {
    nextAreas = mergeAreas(nextAreas, resolved.newArea);
  }
  if (resolved.updatedArea) {
    nextAreas = replaceAreaInList(nextAreas, resolved.updatedArea);
  }

  return {
    task,
    areas: resolved.newArea || resolved.updatedArea ? nextAreas : undefined,
    areaUpdate: resolved.areaUpdate,
    updatedArea: resolved.updatedArea,
  };
}

export { CLIENT_STATUS_OPTIONS, PRIORITY_FILTER_OPTIONS, RISK_OPTIONS, SB_PRIORITY_OPTIONS, SB_STATUS_OPTIONS };
