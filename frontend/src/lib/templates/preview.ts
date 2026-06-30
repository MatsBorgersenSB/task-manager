import type {
  ProjectTemplateTask,
  TemplatePreviewGroup,
  TemplatePreviewNode,
} from "@/lib/templates/types";

export function addDaysIso(startIso: string, offsetDays: number | null | undefined): string | null {
  if (offsetDays == null || Number.isNaN(offsetDays)) return null;
  const base = new Date(`${startIso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  base.setDate(base.getDate() + offsetDays);
  return base.toISOString().slice(0, 10);
}

export function areaLabelForTask(task: ProjectTemplateTask): string {
  const name = (task.area_name ?? "").trim();
  const code = (task.area_code ?? "").trim();
  if (name && code) return `${name} (${code})`;
  if (name) return name;
  if (code) return code;
  return "General";
}

export function buildTemplatePreviewGroups(
  tasks: ProjectTemplateTask[],
  startDate: string
): TemplatePreviewGroup[] {
  const mains = tasks
    .filter((task) => !task.parent_template_task_id)
    .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));

  const byParent = new Map<string, ProjectTemplateTask[]>();
  for (const task of tasks) {
    if (!task.parent_template_task_id) continue;
    const list = byParent.get(task.parent_template_task_id) ?? [];
    list.push(task);
    byParent.set(task.parent_template_task_id, list);
  }

  const nodes: TemplatePreviewNode[] = mains.map((main) => ({
    task: main,
    subtasks: (byParent.get(main.id) ?? []).sort(
      (a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title)
    ),
    computedDueDate: addDaysIso(startDate, main.due_offset_days),
  }));

  const groupMap = new Map<string, TemplatePreviewNode[]>();
  for (const node of nodes) {
    const label = areaLabelForTask(node.task);
    const list = groupMap.get(label) ?? [];
    list.push(node);
    groupMap.set(label, list);
  }

  return [...groupMap.entries()].map(([areaLabel, mainsInArea]) => ({
    areaLabel,
    mains: mainsInArea,
  }));
}

export function countTemplateStats(tasks: ProjectTemplateTask[]) {
  const mains = tasks.filter((t) => !t.parent_template_task_id);
  const subtasks = tasks.filter((t) => t.parent_template_task_id);
  const milestones = tasks.filter((t) => t.is_milestone);
  const areas = new Set(tasks.map(areaLabelForTask));
  return {
    mainTasks: mains.length,
    subtasks: subtasks.length,
    milestones: milestones.length,
    areas: areas.size,
  };
}

export function subtaskTreeMarker(index: number, total: number): string {
  return index === total - 1 ? "└─" : "├─";
}
