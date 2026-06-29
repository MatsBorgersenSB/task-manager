import type { TaskLink } from "@/lib/tasks/types";

export type ProjectUserRole = "internal" | "client";

export type Project = {
  id: string;
  name: string;
  description: string | null;
  is_shared: boolean;
  created_at: string;
  links?: TaskLink[];
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
