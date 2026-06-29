/** Typed audit events stored in activity_logs.event_type */
export type TaskActivityEventType =
  | "field_change"
  | "task_created"
  | "status_changed"
  | "due_date_changed"
  | "responsible_changed"
  | "comment_added"
  | "link_added"
  | "subtask_created"
  | "converted_to_subtask"
  | "promoted_to_main";

export const INTERNAL_ACTIVITY_FIELDS = new Set([
  "Response or Action taken by SB",
  "SB Status",
  "SB Priority",
  "SB Owner",
  "Risk",
  "Risk Comment",
  "SB Note",
  "Priority",
  "Visibility",
  "Internal Comment",
]);

export function isActivityVisibleToClient(
  eventType: string,
  fieldName: string
): boolean {
  if (INTERNAL_ACTIVITY_FIELDS.has(fieldName)) return false;
  if (eventType === "comment_added" && fieldName === "Internal Comment") {
    return false;
  }
  return true;
}

export function eventTypeForFieldChange(fieldName: string): TaskActivityEventType {
  if (fieldName === "status") return "status_changed";
  if (fieldName === "Date Due") return "due_date_changed";
  if (fieldName === "Responsible") return "responsible_changed";
  return "field_change";
}
