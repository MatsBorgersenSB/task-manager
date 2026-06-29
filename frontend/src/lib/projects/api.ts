import { createClient } from "@/lib/supabase/client";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import { parseTaskLinks } from "@/lib/tasks/taskLinks";
import type { TaskLink } from "@/lib/tasks/types";
import type {
  Project,
  ProjectPayload,
  ProjectUser,
  ProjectUserRole,
} from "@/lib/projects/types";

export const DEFAULT_PROJECT_NAME = "Carbon Emergente";

export const LEGACY_DEFAULT_PROJECT_NAMES = [
  "Dashboard Project",
  "Default Project",
] as const;

export const DEFAULT_PROJECT_DESCRIPTION =
  "Default project for tasks without a project assignment";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  is_shared: boolean;
  created_at: string;
  links?: unknown;
};

const PROJECT_COLUMNS =
  "id, name, description, is_shared, created_at, links";

type ProjectUserRow = {
  id: string;
  project_id: string;
  email: string;
  role: ProjectUserRole;
  created_at: string;
};

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    is_shared: row.is_shared,
    created_at: row.created_at,
    links: parseTaskLinks(row.links),
  };
}

function mapProjectUser(row: ProjectUserRow): ProjectUser {
  return {
    id: row.id,
    project_id: row.project_id,
    email: row.email,
    role: row.role,
    created_at: row.created_at,
  };
}

export async function fetchProjects(isInternal: boolean): Promise<Project[]> {
  const supabase = createClient();

  if (isInternal) {
    const { data, error } = await supabase
      .from("projects")
      .select(PROJECT_COLUMNS)
      .order("name", { ascending: true });

    if (error) {
      throw new Error(supabaseErrorMessage(error));
    }

    return ((data ?? []) as ProjectRow[]).map(mapProject);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.trim().toLowerCase();
  if (!email) return [];

  const { data: memberships, error: membershipError } = await supabase
    .from("project_users")
    .select("project_id")
    .ilike("email", email);

  if (membershipError) {
    const message = membershipError.message.toLowerCase();
    const missingProjectUsersTable =
      message.includes("project_users") || message.includes("schema cache");

    if (!missingProjectUsersTable) {
      throw new Error(supabaseErrorMessage(membershipError));
    }

    // Legacy fallback before project_users migration: shared projects only.
    const { data, error } = await supabase
      .from("projects")
      .select(PROJECT_COLUMNS)
      .eq("is_shared", true)
      .order("name", { ascending: true });

    if (error) {
      throw new Error(supabaseErrorMessage(error));
    }

    return ((data ?? []) as ProjectRow[]).map(mapProject);
  }

  const projectIds = [
    ...new Set(
      ((memberships ?? []) as { project_id: string }[]).map(
        (row) => row.project_id
      )
    ),
  ];

  if (projectIds.length === 0) return [];

  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .in("id", projectIds)
    .eq("is_shared", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return ((data ?? []) as ProjectRow[]).map(mapProject);
}

/** Internal users always get at least one project (created on demand). */
export async function fetchProjectsWithDefault(
  isInternal: boolean
): Promise<Project[]> {
  const projects = await fetchProjects(isInternal);
  if (projects.length > 0 || !isInternal) {
    return projects;
  }

  return [
    await createProject({
      name: DEFAULT_PROJECT_NAME,
      description: DEFAULT_PROJECT_DESCRIPTION,
    }),
  ];
}

/** Prefer the named default project; fall back to legacy names or first project. */
export function getDefaultProjectId(projects: Project[]): string | null {
  const match = projects.find(
    (project) =>
      project.name === DEFAULT_PROJECT_NAME ||
      LEGACY_DEFAULT_PROJECT_NAMES.includes(
        project.name as (typeof LEGACY_DEFAULT_PROJECT_NAMES)[number]
      )
  );
  return match?.id ?? projects[0]?.id ?? null;
}

export async function createProject(payload: ProjectPayload): Promise<Project> {
  const name = payload.name.trim();
  if (!name) {
    throw new Error("Project name is required.");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("projects")
    .insert({
      name,
      description: payload.description?.trim() || null,
      created_by: user?.id ?? null,
      is_shared: false,
    })
    .select(PROJECT_COLUMNS)
    .single();

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return mapProject(data as ProjectRow);
}

export async function shareProject(projectId: string): Promise<Project> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ is_shared: true })
    .eq("id", projectId)
    .select(PROJECT_COLUMNS)
    .single();

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return mapProject(data as ProjectRow);
}

export async function updateProjectLinks(
  projectId: string,
  links: TaskLink[]
): Promise<Project> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ links })
    .eq("id", projectId)
    .select(PROJECT_COLUMNS)
    .single();

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return mapProject(data as ProjectRow);
}

export async function inviteProjectUser(
  projectId: string,
  email: string,
  role: ProjectUserRole = "client"
): Promise<ProjectUser> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  const supabase = createClient();

  const { data: existing, error: lookupError } = await supabase
    .from("project_users")
    .select("id")
    .eq("project_id", projectId)
    .ilike("email", trimmed)
    .maybeSingle();

  if (lookupError) {
    throw new Error(supabaseErrorMessage(lookupError));
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from("project_users")
      .update({ role })
      .eq("id", existing.id)
      .select("id, project_id, email, role, created_at")
      .single();

    if (error) {
      throw new Error(supabaseErrorMessage(error));
    }

    return mapProjectUser(data as ProjectUserRow);
  }

  const { data, error } = await supabase
    .from("project_users")
    .insert({
      project_id: projectId,
      email: trimmed,
      role,
    })
    .select("id, project_id, email, role, created_at")
    .single();

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return mapProjectUser(data as ProjectUserRow);
}

export async function fetchProjectUsers(projectId: string): Promise<ProjectUser[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_users")
    .select("id, project_id, email, role, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return ((data ?? []) as ProjectUserRow[]).map(mapProjectUser);
}
