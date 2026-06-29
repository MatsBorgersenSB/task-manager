import { createClient } from "@/lib/supabase/client";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import {
  extractMissingColumnName,
  isMissingTableError,
  stripRecordKeys,
} from "@/lib/supabase/schemaFallback";
import {
  computeClientVisibleForActivity,
  eventTypeForFieldChange,
  type TaskActivityEventType,
} from "@/lib/tasks/activityEvents";
import { getTableColumns } from "@/lib/tasks/labels";
import { panelFieldDef } from "@/lib/tasks/panelFields";
import {
  getPanelDraftValue,
  type TaskPanelDraft,
} from "@/lib/tasks/taskPanel";
import type { TaskViewMode } from "@/lib/tasks/types";
import { formatSbOwners } from "@/lib/tasks/utils";

export type ActivityLogInsert = {
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  event_type?: TaskActivityEventType;
};

function toLogValue(value: string | string[]): string | null {
  if (Array.isArray(value)) {
    const formatted = formatSbOwners(value);
    const trimmed = (formatted ?? "").trim();
    return trimmed === "" ? null : trimmed;
  }
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/** Compare original draft vs new draft using table column definitions. */
export function detectTaskFieldChanges(
  mode: TaskViewMode,
  originalDraft: TaskPanelDraft,
  newDraft: TaskPanelDraft
): ActivityLogInsert[] {
  const changes: ActivityLogInsert[] = [];

  for (const column of getTableColumns(mode)) {
    if (!column.fieldName) continue;

    const def = panelFieldDef(column, mode);
    if (!def || def.readOnly) continue;

    const oldValue = toLogValue(getPanelDraftValue(originalDraft, column.fieldName));
    const newValue = toLogValue(getPanelDraftValue(newDraft, column.fieldName));

    if (oldValue === newValue) continue;

    changes.push({
      field_name: column.fieldName,
      old_value: oldValue,
      new_value: newValue,
      event_type: eventTypeForFieldChange(column.fieldName),
    });
  }

  return changes;
}

export async function insertActivityLogs(
  taskId: string,
  entries: ActivityLogInsert[]
): Promise<void> {
  if (entries.length === 0) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const rows = entries.map((entry) => ({
    task_id: taskId,
    field_name: entry.field_name,
    old_value: entry.old_value,
    new_value: entry.new_value,
    changed_by: user.id,
    event_type: entry.event_type ?? "field_change",
    client_visible: computeClientVisibleForActivity(
      entry.event_type ?? "field_change",
      entry.field_name
    ),
  }));

  await insertActivityRowsResilient(supabase, rows);
}

const OPTIONAL_ACTIVITY_INSERT_KEYS = ["client_visible", "event_type"] as const;

async function insertActivityRowsResilient(
  supabase: ReturnType<typeof createClient>,
  rows: Record<string, unknown>[]
): Promise<void> {
  let payload = rows;

  for (let attempt = 0; attempt <= OPTIONAL_ACTIVITY_INSERT_KEYS.length; attempt++) {
    const { error } = await supabase.from("activity_logs").insert(payload);

    if (!error) {
      return;
    }

    if (isMissingTableError(error, "activity_logs")) {
      return;
    }

    const missing = extractMissingColumnName(error);
    if (
      missing &&
      OPTIONAL_ACTIVITY_INSERT_KEYS.includes(
        missing as (typeof OPTIONAL_ACTIVITY_INSERT_KEYS)[number]
      )
    ) {
      payload = payload.map((row) => stripRecordKeys(row, [missing]));
      continue;
    }

    throw new Error(supabaseErrorMessage(error));
  }
}

export async function logTaskFieldChanges(
  mode: TaskViewMode,
  taskId: string,
  originalDraft: TaskPanelDraft,
  newDraft: TaskPanelDraft
): Promise<void> {
  const changes = detectTaskFieldChanges(mode, originalDraft, newDraft);
  await insertActivityLogs(taskId, changes);
}

export async function logSingleTaskFieldChange(
  taskId: string,
  fieldName: string,
  oldValue: string | null,
  newValue: string | null
): Promise<void> {
  if (oldValue === newValue) return;
  await insertActivityLogs(taskId, [
    {
      field_name: fieldName,
      old_value: oldValue,
      new_value: newValue,
      event_type: eventTypeForFieldChange(fieldName),
    },
  ]);
}

export async function logTaskEvent(
  taskId: string,
  eventType: TaskActivityEventType,
  fieldName: string,
  oldValue: string | null = null,
  newValue: string | null = null
): Promise<void> {
  await insertActivityLogs(taskId, [
    {
      field_name: fieldName,
      old_value: oldValue,
      new_value: newValue,
      event_type: eventType,
    },
  ]);
}
