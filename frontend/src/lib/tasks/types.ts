import type { VisibilityScope } from "@/lib/tasks/visibility";

export type TaskLinkType = "file" | "image" | "folder" | "link";

export type TaskLink = {
  id: string;
  name: string;
  url: string;
  type: TaskLinkType;
};

export type Task = {
  /** Display ID (maps to `task_number` in Supabase). */
  id: number;
  /** Supabase row UUID — used for updates/deletes. */
  _uuid: string;
  Issue?: string | null;
  "Registration Date"?: string | null;
  status?: string | null;
  Priority?: string | null;
  areaName?: string | null;
  areaCode?: string | null;
  equipmentTypeName?: string | null;
  equipmentTypeCode?: string | null;
  visibility_scope?: VisibilityScope | null;
  Responsible?: string | null;
  "CE Comments"?: string | null;
  "Response or Action taken by SB"?: string | null;
  "SB Note"?: string | null;
  "Date Due"?: string | null;
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
  /** Internal view only — file/folder/URL attachments. */
  links?: TaskLink[];
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
  searchText: string;
  priority: string;
  status: string;
  sbStatus: string;
  sbPriority: string;
  sbOwners: string[];
  area: string;
  equipmentType: string;
  visibilityScope: string;
  due: string;
  sort: string;
};

export type TaskViewMode = "client" | "internal";
