"use client";

import { useEffect, useMemo, useState } from "react";
import type { Task } from "@/lib/tasks/types";
import type { Project } from "@/lib/projects/types";
import {
  fetchProjectDependencies,
  fetchTemplateTasks,
} from "@/lib/templates/api";
import type {
  ProjectTemplateTask,
  TaskDependency,
} from "@/lib/templates/types";
import { DEPENDENCY_TYPE_LABELS } from "@/lib/templates/types";
import {
  isMainTask,
  mainTaskTitleClass,
  milestoneBadgeClass,
} from "@/lib/tasks/hierarchyDisplay";
import { computeTemplateDrift } from "@/lib/tasks/pmAnalytics";
import { taskHierarchyLabel } from "@/lib/tasks/subtasks";
import { subtaskTreeMarker as subtaskIndexMarker } from "@/lib/templates/preview";
import { ui } from "@/lib/ui/classes";

type ProjectBlueprintViewProps = {
  project: Project | null | undefined;
  tasks: Task[];
  loading?: boolean;
  onImportMissingTemplateTask?: (templateTask: ProjectTemplateTask) => Promise<void>;
};

export default function ProjectBlueprintView({
  project,
  tasks,
  loading = false,
  onImportMissingTemplateTask,
}: ProjectBlueprintViewProps) {
  const [deps, setDeps] = useState<TaskDependency[]>([]);
  const [templateTasks, setTemplateTasks] = useState<ProjectTemplateTask[]>([]);
  const [importingId, setImportingId] = useState<string | null>(null);

  useEffect(() => {
    if (!project?.id) {
      setDeps([]);
      return;
    }
    void fetchProjectDependencies(project.id)
      .then(setDeps)
      .catch(() => setDeps([]));
  }, [project?.id]);

  useEffect(() => {
    if (!project?.source_template_id) {
      setTemplateTasks([]);
      return;
    }
    void fetchTemplateTasks(project.source_template_id)
      .then(setTemplateTasks)
      .catch(() => setTemplateTasks([]));
  }, [project?.source_template_id]);

  const missingTemplateTasks = useMemo(
    () => computeTemplateDrift(tasks, templateTasks),
    [tasks, templateTasks]
  );

  const mains = useMemo(
    () =>
      tasks
        .filter((t) => isMainTask(t))
        .sort((a, b) => a.id - b.id),
    [tasks]
  );

  const byParent = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.parent_task_id) continue;
      const list = map.get(task.parent_task_id) ?? [];
      list.push(task);
      map.set(task.parent_task_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.id - b.id);
    }
    return map;
  }, [tasks]);

  const taskTitle = (id: string) => {
    const task = tasks.find((t) => t._uuid === id);
    if (!task) return "Task";
    return taskHierarchyLabel(task, tasks);
  };

  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const task of tasks) {
      const label = (task.areaName ?? task.areaCode ?? "General").trim() || "General";
      set.add(label);
    }
    return [...set].sort();
  }, [tasks]);

  if (loading) {
    return <p className="px-4 py-8 text-sm text-muted">Loading blueprint…</p>;
  }

  return (
    <div className="px-4 pb-8 pt-2">
      <div className={`mb-6 p-5 ${ui.card}`}>
        <h3 className="text-lg font-bold text-primary">{project?.name ?? "Project"}</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase text-muted">Client</dt>
            <dd>{project?.client_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-muted">Owner</dt>
            <dd>{project?.project_owner ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-muted">Start</dt>
            <dd>{project?.start_date ?? "—"}</dd>
          </div>
          {project?.source_template_id ? (
            <div className="sm:col-span-3">
              <dt className="text-xs font-semibold uppercase text-muted">Template version</dt>
              <dd>v{project.template_version ?? 1} (pinned at creation)</dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-3 text-xs text-muted">
          Read-only planning view — {areas.length} areas · {mains.length} main tasks ·{" "}
          {tasks.filter((t) => t.is_milestone).length} milestones · {deps.length} dependencies
        </p>

        {project?.source_template_id && templateTasks.length > 0 ? (
          <div className="mt-4 border-t border-border/70 pt-3">
            {missingTemplateTasks.length === 0 ? (
              <p className="text-xs font-medium text-emerald-700">
                ✓ Blueprint is 100% aligned with template baseline ({templateTasks.length} template checks present).
              </p>
            ) : (
              <div>
                <p className="text-xs font-semibold text-amber-800">
                  Template Drift Detected: {missingTemplateTasks.length} template check
                  {missingTemplateTasks.length === 1 ? "" : "s"} not yet in this project
                </p>
                <ul className="mt-2 space-y-1.5">
                  {missingTemplateTasks.map((tt) => (
                    <li
                      key={tt.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-200 bg-amber-50/60 px-2.5 py-1.5 text-xs"
                    >
                      <span>
                        <strong className="text-primary">{tt.title}</strong>
                        {tt.area_name || tt.area_code ? (
                          <span className="ml-1.5 text-muted">
                            ({tt.area_name ?? tt.area_code})
                          </span>
                        ) : null}
                      </span>
                      {onImportMissingTemplateTask ? (
                        <button
                          type="button"
                          disabled={importingId === tt.id}
                          onClick={async () => {
                            setImportingId(tt.id);
                            try {
                              await onImportMissingTemplateTask(tt);
                            } finally {
                              setImportingId(null);
                            }
                          }}
                          className={ui.btnSecondarySm}
                        >
                          {importingId === tt.id ? "Adding…" : "+ Add to project"}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {areas.map((area) => {
        const areaMains = mains.filter(
          (m) => ((m.areaName ?? m.areaCode ?? "General").trim() || "General") === area
        );
        if (areaMains.length === 0) return null;
        return (
          <section key={area} className="mb-6">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{area}</h4>
            <ul className="mt-2 space-y-3">
              {areaMains.map((main) => {
                const subtasks = byParent.get(main._uuid) ?? [];
                return (
                  <li key={main._uuid} className={`rounded-lg border border-border p-3 ${ui.card}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={mainTaskTitleClass()}>{main.Issue ?? "Task"}</span>
                      {main.is_milestone ? (
                        <span className={milestoneBadgeClass()}>Milestone</span>
                      ) : null}
                      {main.is_critical ? (
                        <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                          Critical
                        </span>
                      ) : null}
                      {main["Date Due"] ? (
                        <span className="text-xs text-muted">Due {main["Date Due"]}</span>
                      ) : null}
                    </div>
                    {subtasks.length > 0 ? (
                      <ul className="mt-2 space-y-0.5 pl-1">
                        {subtasks.map((sub, index) => (
                          <li key={sub._uuid} className="flex items-center gap-2 text-sm">
                            <span className="w-5 font-mono text-xs text-muted">
                              {subtaskIndexMarker(index, subtasks.length)}
                            </span>
                            <span>{sub.Issue ?? "Subtask"}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {deps.length > 0 ? (
        <section className={`p-4 ${ui.card}`}>
          <h4 className="text-sm font-semibold text-primary">Dependency chain</h4>
          <ul className="mt-3 space-y-2 text-sm">
            {deps.map((dep) => (
              <li key={dep.id} className="flex items-center gap-2">
                <span className="font-medium">{taskTitle(dep.predecessor_task_id)}</span>
                <span className="text-muted">→</span>
                <span className="font-medium">{taskTitle(dep.successor_task_id)}</span>
                <span className="text-xs text-muted">
                  ({DEPENDENCY_TYPE_LABELS[dep.dependency_type]})
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
