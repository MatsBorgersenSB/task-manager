export type Task = {
  /** Display ID (maps to `task_number` in Supabase). */
  id: number;
  /** Supabase row UUID — used for updates/deletes. */
  _uuid: string;
  Issue?: string | null;
  "Registration Date"?: string | null;
  status?: string | null;
  Priority?: string | null;
  Responsible?: string | null;
  "CE Comments"?: string | null;
  "Response or Action taken by SB"?: string | null;
  "SB Note"?: string | null;
  "Date Due"?: string | null;
  "Date Completed"?: string | null;
  "SB Status"?: string | null;
  Risk?: string | null;
  "Risk Comment"?: string | null;
  "SB Owner"?: string | null;
  /** Creator profile role (when joined from Supabase). */
  _createdByRole?: string | null;
  _createdByEmail?: string | null;
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
  priority: string;
  status: string;
  sbStatus: string;
  due: string;
  sort: string;
};

export type TaskViewMode = "client" | "internal";
