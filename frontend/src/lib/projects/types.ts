import type { TaskLink } from "@/lib/tasks/types";

export type ProjectUserRole = "internal" | "client";

export type Project = {
  id: string;
  name: string;
  description: string | null;
  is_shared: boolean;
  created_at: string;
  links?: TaskLink[];
  client_name?: string | null;
  project_owner?: string | null;
  start_date?: string | null;
  source_template_id?: string | null;
  template_version?: number | null;
};

export type ProjectUser = {
  id: string;
  project_id: string;
  email: string;
  role: ProjectUserRole;
  created_at: string;
};

export type ProjectPayload = {
  name: string;
  description?: string | null;
};
