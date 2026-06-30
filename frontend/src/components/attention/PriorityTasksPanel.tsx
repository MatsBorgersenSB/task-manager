"use client";

import type { Task } from "@/lib/tasks/types";
import type { Project } from "@/lib/projects/types";
import QuickTaskActions from "@/components/attention/QuickTaskActions";
import { classifyMyTaskPriority } from "@/lib/attention/myTasksWorkspace";

type PriorityTasksPanelProps = {
  tasks: Task[];
  projects: Project[];
  waitingTaskIds: Set<string>;
  onUpdated?: () => void;
};

function projectName(projects: Project[], projectId: string | null | undefined): string {
  if (!projectId) return "Unknown project";
  return projects.find((project) => project.id === projectId)?.name ?? "Project";
}

function priorityLabel(group: ReturnType<typeof classifyMyTaskPriority>): string {
  switch (group) {
    case "overdue":
      return "Overdue";
    case "dueToday":
      return "Due Today";
    case "waiting":
      return "Waiting";
    case "blocked":
      return "Blocked";
    default:
      return "";
  }
}

export default function PriorityTasksPanel({
  tasks,
  projects,
  waitingTaskIds,
  onUpdated,
}: PriorityTasksPanelProps) {
  if (tasks.length === 0) {
    return (
      <section className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <p className="text-sm font-medium text-green-900">
          No priority items — you are caught up.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Priority tasks">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Priority Tasks
      </h3>
      <ul className="mt-2 space-y-2">
        {tasks.slice(0, 12).map((task) => {
          const group = classifyMyTaskPriority(task, waitingTaskIds);
          return (
            <li
              key={task._uuid}
              className="rounded-lg border border-border bg-white px-3 py-2 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {priorityLabel(group)} · {projectName(projects, task.project_id)}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-primary">
                    #{task.id} {task.Issue}
                  </p>
                  {task["Date Due"] ? (
                    <p className="mt-0.5 text-xs text-muted">Due {task["Date Due"]}</p>
                  ) : null}
                </div>
                <QuickTaskActions
                  task={task}
                  projectId={task.project_id}
                  waiting={waitingTaskIds.has(task._uuid)}
                  compact
                  onUpdated={onUpdated}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
