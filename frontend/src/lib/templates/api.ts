import { createClient } from "@/lib/supabase/client";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import type { Project } from "@/lib/projects/types";
import type {
  CreateProjectFromTemplatePayload,
  DependencyType,
  ProjectTemplate,
  ProjectTemplateTask,
  TemplatePayload,
  TemplateTaskDependency,
  TemplateTaskPayload,
  TaskDependency,
} from "@/lib/templates/types";

type TemplateRow = {
  id: string;
  name: string;
  slug: string | null;
  version: number;
  is_latest: boolean;
  is_archived: boolean;
  is_active: boolean;
  category: string | null;
  description: string | null;
  knowledge_notes: string | null;
  health_baseline: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type TemplateTaskRow = ProjectTemplateTask & { metadata?: Record<string, unknown> };

function mapTemplate(row: TemplateRow, taskCount = 0): ProjectTemplate {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    version: row.version,
    is_latest: row.is_latest,
    is_archived: row.is_archived,
    is_active: row.is_active,
    category: row.category,
    description: row.description,
    knowledge_notes: row.knowledge_notes,
    health_baseline: row.health_baseline ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
    task_count: taskCount,
  };
}

function mapTemplateTask(row: TemplateTaskRow): ProjectTemplateTask {
  return {
    ...row,
    metadata: row.metadata ?? {},
  };
}

export async function fetchProjectTemplates(options?: {
  includeArchived?: boolean;
  latestOnly?: boolean;
  category?: string;
}): Promise<ProjectTemplate[]> {
  const supabase = createClient();
  let query = supabase
    .from("project_templates")
    .select("*")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true })
    .order("version", { ascending: false });

  if (options?.latestOnly !== false) {
    query = query.eq("is_latest", true);
  }
  if (!options?.includeArchived) {
    query = query.eq("is_archived", false);
  }
  if (options?.category) {
    query = query.eq("category", options.category);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  const templates = (data ?? []) as TemplateRow[];
  if (templates.length === 0) return [];

  const ids = templates.map((t) => t.id);
  const { data: counts } = await supabase
    .from("project_template_tasks")
    .select("template_id")
    .in("template_id", ids);

  const countMap = new Map<string, number>();
  for (const row of (counts ?? []) as { template_id: string }[]) {
    countMap.set(row.template_id, (countMap.get(row.template_id) ?? 0) + 1);
  }

  return templates.map((row) => mapTemplate(row, countMap.get(row.id) ?? 0));
}

export async function fetchTemplateById(templateId: string): Promise<ProjectTemplate | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();

  if (error) throw new Error(supabaseErrorMessage(error));
  if (!data) return null;
  return mapTemplate(data as TemplateRow);
}

export async function fetchTemplateTasks(templateId: string): Promise<ProjectTemplateTask[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_template_tasks")
    .select("*")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(supabaseErrorMessage(error));
  return ((data ?? []) as TemplateTaskRow[]).map(mapTemplateTask);
}

export async function fetchTemplateDependencies(
  templateId: string
): Promise<TemplateTaskDependency[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_template_task_dependencies")
    .select("*")
    .eq("template_id", templateId);

  if (error) throw new Error(supabaseErrorMessage(error));
  return (data ?? []) as TemplateTaskDependency[];
}

export async function fetchProjectDependencies(
  projectId: string
): Promise<TaskDependency[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_dependencies")
    .select("*")
    .eq("project_id", projectId);

  if (error) throw new Error(supabaseErrorMessage(error));
  return (data ?? []) as TaskDependency[];
}

export async function instantiateProjectFromTemplate(
  payload: CreateProjectFromTemplatePayload
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("instantiate_project_from_template", {
    p_name: payload.name.trim(),
    p_client_name: payload.clientName?.trim() || null,
    p_project_owner: payload.projectOwner?.trim() || null,
    p_start_date: payload.startDate.slice(0, 10),
    p_template_id: payload.templateId || null,
    p_description: payload.description?.trim() || null,
  });

  if (error) throw new Error(supabaseErrorMessage(error));
  if (!data) throw new Error("Project creation returned no id.");
  return data as string;
}

export async function fetchProjectAfterInstantiate(projectId: string): Promise<Project> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, is_shared, created_at, client_name, project_owner, start_date, source_template_id, template_version")
    .eq("id", projectId)
    .single();

  if (error) throw new Error(supabaseErrorMessage(error));
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    is_shared: Boolean(row.is_shared),
    created_at: row.created_at as string,
    client_name: (row.client_name as string | null) ?? null,
    project_owner: (row.project_owner as string | null) ?? null,
    start_date: (row.start_date as string | null) ?? null,
    source_template_id: (row.source_template_id as string | null) ?? null,
    template_version: (row.template_version as number | null) ?? null,
  };
}

export async function createTemplate(payload: TemplatePayload): Promise<ProjectTemplate> {
  const supabase = createClient();
  const slug =
    payload.slug?.trim() ||
    payload.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const { data, error } = await supabase
    .from("project_templates")
    .insert({
      name: payload.name.trim(),
      slug,
      category: payload.category ?? "Custom",
      description: payload.description?.trim() || null,
      knowledge_notes: payload.knowledge_notes?.trim() || null,
      version: 1,
      is_latest: true,
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(supabaseErrorMessage(error));
  return mapTemplate(data as TemplateRow);
}

export async function cloneTemplate(
  sourceId: string,
  newName?: string
): Promise<ProjectTemplate> {
  const source = await fetchTemplateById(sourceId);
  if (!source) throw new Error("Template not found.");

  const tasks = await fetchTemplateTasks(sourceId);
  const deps = await fetchTemplateDependencies(sourceId);

  const created = await createTemplate({
    name: newName?.trim() || `${source.name} (Copy)`,
    slug: `${source.slug ?? "custom"}-copy-${Date.now()}`,
    category: source.category ?? "Custom",
    description: source.description,
    knowledge_notes: source.knowledge_notes,
  });

  const supabase = createClient();
  const idMap = new Map<string, string>();

  const mains = tasks.filter((t) => !t.parent_template_task_id);
  for (const task of mains) {
    const { data, error } = await supabase
      .from("project_template_tasks")
      .insert({
        template_id: created.id,
        sort_order: task.sort_order,
        title: task.title,
        description: task.description,
        area_name: task.area_name,
        area_code: task.area_code,
        responsible: task.responsible,
        sb_owner: task.sb_owner,
        priority: task.priority,
        visibility_scope: task.visibility_scope,
        due_offset_days: task.due_offset_days,
        intervention_offset_days: task.intervention_offset_days,
        estimated_duration_days: task.estimated_duration_days,
        default_status: task.default_status,
        is_milestone: task.is_milestone,
        is_critical: task.is_critical,
        template_notes: task.template_notes,
      })
      .select("id")
      .single();
    if (error) throw new Error(supabaseErrorMessage(error));
    idMap.set(task.id, (data as { id: string }).id);
  }

  for (const task of tasks.filter((t) => t.parent_template_task_id)) {
    const parentId = idMap.get(task.parent_template_task_id!);
    if (!parentId) continue;
    const { data, error } = await supabase
      .from("project_template_tasks")
      .insert({
        template_id: created.id,
        parent_template_task_id: parentId,
        sort_order: task.sort_order,
        title: task.title,
        description: task.description,
        due_offset_days: task.due_offset_days,
        default_status: task.default_status,
        is_milestone: task.is_milestone,
        visibility_scope: task.visibility_scope,
        template_notes: task.template_notes,
      })
      .select("id")
      .single();
    if (error) throw new Error(supabaseErrorMessage(error));
    idMap.set(task.id, (data as { id: string }).id);
  }

  for (const dep of deps) {
    const pred = idMap.get(dep.predecessor_template_task_id);
    const succ = idMap.get(dep.successor_template_task_id);
    if (!pred || !succ) continue;
    await supabase.from("project_template_task_dependencies").insert({
      template_id: created.id,
      predecessor_template_task_id: pred,
      successor_template_task_id: succ,
      dependency_type: dep.dependency_type,
      lag_days: dep.lag_days,
    });
  }

  return created;
}

export async function createTemplateVersion(sourceId: string): Promise<ProjectTemplate> {
  const source = await fetchTemplateById(sourceId);
  if (!source || !source.slug) throw new Error("Template not found.");

  const supabase = createClient();
  await supabase
    .from("project_templates")
    .update({ is_latest: false })
    .eq("slug", source.slug)
    .eq("is_latest", true);

  const { data: maxRow } = await supabase
    .from("project_templates")
    .select("version")
    .eq("slug", source.slug)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = ((maxRow as { version?: number } | null)?.version ?? source.version) + 1;

  const cloned = await cloneTemplate(sourceId, `${source.name} v${nextVersion}`);
  const { data, error } = await supabase
    .from("project_templates")
    .update({
      slug: source.slug,
      version: nextVersion,
      is_latest: true,
      cloned_from_id: sourceId,
    })
    .eq("id", cloned.id)
    .select("*")
    .single();

  if (error) throw new Error(supabaseErrorMessage(error));
  return mapTemplate(data as TemplateRow);
}

export async function updateTemplateMeta(
  templateId: string,
  patch: Partial<TemplatePayload> & { is_archived?: boolean; is_active?: boolean }
): Promise<ProjectTemplate> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_templates")
    .update({
      ...(patch.name != null ? { name: patch.name.trim() } : {}),
      ...(patch.category != null ? { category: patch.category } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.knowledge_notes !== undefined ? { knowledge_notes: patch.knowledge_notes } : {}),
      ...(patch.is_archived !== undefined ? { is_archived: patch.is_archived } : {}),
      ...(patch.is_active !== undefined ? { is_active: patch.is_active } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId)
    .select("*")
    .single();

  if (error) throw new Error(supabaseErrorMessage(error));
  return mapTemplate(data as TemplateRow);
}

export async function upsertTemplateTask(
  templateId: string,
  payload: TemplateTaskPayload,
  taskId?: string
): Promise<ProjectTemplateTask> {
  const supabase = createClient();
  const row = {
    template_id: templateId,
    title: payload.title.trim(),
    description: payload.description ?? null,
    parent_template_task_id: payload.parent_template_task_id ?? null,
    sort_order: payload.sort_order ?? 0,
    area_name: payload.area_name ?? null,
    area_code: payload.area_code ?? null,
    responsible: payload.responsible ?? null,
    sb_owner: payload.sb_owner ?? null,
    priority: payload.priority ?? null,
    visibility_scope: payload.visibility_scope ?? null,
    due_offset_days: payload.due_offset_days ?? null,
    intervention_offset_days: payload.intervention_offset_days ?? null,
    estimated_duration_days: payload.estimated_duration_days ?? null,
    default_status: payload.default_status ?? "Pending",
    is_milestone: payload.is_milestone ?? false,
    is_critical: payload.is_critical ?? false,
    template_notes: payload.template_notes ?? null,
  };

  if (taskId) {
    const { data, error } = await supabase
      .from("project_template_tasks")
      .update(row)
      .eq("id", taskId)
      .select("*")
      .single();
    if (error) throw new Error(supabaseErrorMessage(error));
    return mapTemplateTask(data as TemplateTaskRow);
  }

  const { data, error } = await supabase
    .from("project_template_tasks")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(supabaseErrorMessage(error));
  return mapTemplateTask(data as TemplateTaskRow);
}

export async function deleteTemplateTask(taskId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("project_template_tasks")
    .delete()
    .eq("id", taskId);
  if (error) throw new Error(supabaseErrorMessage(error));
}

export async function upsertTemplateDependency(
  templateId: string,
  predecessorId: string,
  successorId: string,
  dependencyType: DependencyType = "FS",
  lagDays = 0
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("project_template_task_dependencies").upsert(
    {
      template_id: templateId,
      predecessor_template_task_id: predecessorId,
      successor_template_task_id: successorId,
      dependency_type: dependencyType,
      lag_days: lagDays,
    },
    { onConflict: "predecessor_template_task_id,successor_template_task_id" }
  );
  if (error) throw new Error(supabaseErrorMessage(error));
}

export async function deleteTemplateDependency(dependencyId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("project_template_task_dependencies")
    .delete()
    .eq("id", dependencyId);
  if (error) throw new Error(supabaseErrorMessage(error));
}

export async function searchTemplates(query: string): Promise<ProjectTemplate[]> {
  const all = await fetchProjectTemplates({ latestOnly: true });
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      (t.category ?? "").toLowerCase().includes(q) ||
      (t.description ?? "").toLowerCase().includes(q)
  );
}
