/** Column sets for compact task queries in `/api/chat`, ordered from newest schema to base schema. */
export const COMPACT_TASK_SELECT_FULL =
  "id, task_number, title, status, priority, sb_status, sb_priority, sb_owner, responsible, date_due, date_completed, area_name, area_code, project_id, parent_task_id, is_milestone, is_critical, board_label_ids, visibility_scope";

export const COMPACT_TASK_SELECT_WITHOUT_BOARD =
  "id, task_number, title, status, priority, sb_status, sb_priority, sb_owner, responsible, date_due, date_completed, area_name, area_code, project_id, parent_task_id, is_milestone, is_critical, visibility_scope";

export const COMPACT_TASK_SELECT_BASE =
  "id, task_number, title, status, priority, sb_status, sb_priority, sb_owner, responsible, date_due, date_completed, area_name, area_code, project_id";

export const COMPACT_TASK_SELECT_COLUMN_SETS = [
  COMPACT_TASK_SELECT_FULL,
  COMPACT_TASK_SELECT_WITHOUT_BOARD,
  COMPACT_TASK_SELECT_BASE,
] as const;
