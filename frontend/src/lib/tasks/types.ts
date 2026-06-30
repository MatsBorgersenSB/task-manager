import type { VisibilityScope } from "@/lib/tasks/visibility";

export type TaskLinkType = "document" | "photo" | "email" | "folder";

/** Legacy values stored before link-type refresh. */
export type LegacyTaskLinkType = "file" | "image" | "link";

export type TaskLink = {
  id: string;
  name: string;
  url: string;
  type: TaskLinkType;
};

export type SubtaskProgress = {
  completed: number;
  total: number;
};

export type Task = {
  /** Display ID (maps to `task_number` in Supabase). */
  id: number;
  /** Supabase row UUID — used for updates/deletes. */
  _uuid: string;
  /** Parent task UUID when this task is a subtask. */
  parent_task_id?: string | null;
  /** Owning project UUID. */
  project_id?: string | null;
  Issue?: string | null;
  "Registration Date"?: string | null;
  status?: string | null;
  Priority?: string | null;
  areaName?: string | null;
  areaCode?: string | null;
  visibility_scope?: VisibilityScope | null;
  Responsible?: string | null;
  "CE Comments"?: string | null;
  "Response or Action taken by SB"?: string | null;
  "SB Note"?: string | null;
  "Date Due"?: string | null;
  "Intervention Date"?: string | null;
  /** DB column `intervention_date` (ISO date string). */
  intervention_date?: string | null;
  intervention_hours?: number | null;
  "Date Completed"?: string | null;
  "SB Status"?: string | null;
  "SB Priority"?: string | null;
  Risk?: string | null;
  "Risk Comment"?: string | null;
  "SB Owner"?: string | null;
  /** Creator profile role (when joined from Supabase). */
  _createdByRole?: string | null;
  _createdByEmail?: string | null;
  _createdAt?: string | null;
  _updatedAt?: string | null;
  _updatedBy?: string | null;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  /** Internal view only — file/folder/URL attachments. */
  links?: TaskLink[];
  /** Milestone task — zero-duration checkpoint. */
  is_milestone?: boolean;
  is_critical?: boolean;
  template_notes?: string | null;
};

export type TaskPayload = Partial<Omit<Task, "id">>;

export type AppUser = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  user_type?: string | null;
};

export type TaskFilters = {
  columnFilters: Record<string, string>;
  priority: string;
  status: string;
  sbStatus: string;
  sbPriority: string;
  sbOwners: string[];
  area: string;
  visibilityScope: string;
  due: string;
  risk: string;
  sort: string;
};

export type TaskViewMode = "client" | "internal";
