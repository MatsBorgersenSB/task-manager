export type TemplateCategory =
  | "Commissioning"
  | "Installation"
  | "FAT"
  | "Service"
  | "Biochar"
  | "Internal"
  | "Custom";

export type DependencyType = "FS" | "FF" | "SS" | "SF";

export const DEPENDENCY_TYPE_LABELS: Record<DependencyType, string> = {
  FS: "Finish → Start",
  FF: "Finish → Finish",
  SS: "Start → Start",
  SF: "Start → Finish",
};

export type ProjectTemplate = {
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
  health_baseline: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  task_count?: number;
};

export type ProjectTemplateTask = {
  id: string;
  template_id: string;
  parent_template_task_id: string | null;
  sort_order: number;
  title: string;
  description: string | null;
  area_id: string | null;
  area_name: string | null;
  area_code: string | null;
  responsible: string | null;
  sb_owner: string | null;
  sb_status: string | null;
  priority: string | null;
  visibility_scope: string | null;
  due_offset_days: number | null;
  intervention_offset_days: number | null;
  estimated_duration_days: number | null;
  default_status: string | null;
  is_milestone: boolean;
  is_critical: boolean;
  template_notes: string | null;
  metadata: Record<string, unknown>;
};

export type TemplateTaskDependency = {
  id: string;
  template_id: string;
  predecessor_template_task_id: string;
  successor_template_task_id: string;
  dependency_type: DependencyType;
  lag_days: number;
};

export type TemplatePreviewNode = {
  task: ProjectTemplateTask;
  subtasks: ProjectTemplateTask[];
  computedDueDate: string | null;
};

export type TemplatePreviewGroup = {
  areaLabel: string;
  mains: TemplatePreviewNode[];
};

export type CreateProjectFromTemplatePayload = {
  name: string;
  clientName?: string | null;
  projectOwner?: string | null;
  startDate: string;
  templateId?: string | null;
  description?: string | null;
};

export type TemplateTaskPayload = Partial<
  Omit<ProjectTemplateTask, "id" | "template_id" | "metadata">
> & {
  title: string;
};

export type TemplatePayload = {
  name: string;
  slug?: string | null;
  category?: string | null;
  description?: string | null;
  knowledge_notes?: string | null;
};

export type TaskDependency = {
  id: string;
  project_id: string;
  predecessor_task_id: string;
  successor_task_id: string;
  dependency_type: DependencyType;
  lag_days: number;
};
