import { createClient } from "@/lib/supabase/client";
import {
  isMissingSchemaError,
  migrationHint,
} from "@/lib/supabase/schemaCapabilities";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import type { Project } from "@/lib/projects/types";
import type {
  LifecycleDashboard,
  ProjectDeleteImpact,
  ProjectLifecycleAction,
} from "@/lib/projects/lifecycle";
import { fetchProjectAfterInstantiate } from "@/lib/templates/api";

function lifecycleUnavailableError(error: { message?: string } | null): Error {
  if (isMissingSchemaError(error)) {
    return new Error(
      `Project lifecycle is unavailable. ${migrationHint("projectLifecycle")}`
    );
  }
  return new Error(supabaseErrorMessage(error));
}

function mapLifecycleProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    is_shared: Boolean(row.is_shared),
    created_at: row.created_at as string,
    project_status: (row.project_status as Project["project_status"]) ?? "active",
    completed_at: (row.completed_at as string | null) ?? null,
    archived_at: (row.archived_at as string | null) ?? null,
    deleted_at: (row.deleted_at as string | null) ?? null,
    client_name: (row.client_name as string | null) ?? null,
    project_owner: (row.project_owner as string | null) ?? null,
    start_date: (row.start_date as string | null) ?? null,
    source_template_id: (row.source_template_id as string | null) ?? null,
    template_version: (row.template_version as number | null) ?? null,
  };
}

export async function fetchProjectDeleteImpact(
  projectId: string
): Promise<ProjectDeleteImpact> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_project_delete_impact", {
    p_project_id: projectId,
  });
  if (error) throw lifecycleUnavailableError(error);
  return data as ProjectDeleteImpact;
}

export async function transitionProjectLifecycle(
  projectId: string,
  action: ProjectLifecycleAction,
  reason?: string | null
): Promise<Project> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("transition_project_lifecycle", {
    p_project_id: projectId,
    p_action: action,
    p_reason: reason ?? null,
  });
  if (error) throw lifecycleUnavailableError(error);
  return mapLifecycleProject(data as Record<string, unknown>);
}

export async function permanentlyDeleteProject(
  projectId: string,
  reason: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("permanently_delete_project", {
    p_project_id: projectId,
    p_reason: reason,
  });
  if (error) throw lifecycleUnavailableError(error);
}

export async function fetchLifecycleDashboard(): Promise<LifecycleDashboard> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("admin_get_lifecycle_dashboard");
  if (error) throw lifecycleUnavailableError(error);
  return data as LifecycleDashboard;
}

export async function fetchArchivedProjects(): Promise<Project[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("project_status", "archived")
    .is("deleted_at", null)
    .order("archived_at", { ascending: false });

  if (error) throw lifecycleUnavailableError(error);
  return ((data ?? []) as Record<string, unknown>[]).map(mapLifecycleProject);
}

/** Re-fetch single project after lifecycle change when RPC returns partial row. */
export async function refreshProject(projectId: string): Promise<Project> {
  return fetchProjectAfterInstantiate(projectId);
}
