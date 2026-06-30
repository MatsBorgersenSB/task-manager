"use client";

import type { Task } from "@/lib/tasks/types";
import type { Project } from "@/lib/projects/types";
import type { MyTasksWorkspaceStats } from "@/lib/attention/myTasksWorkspace";
import QuickTaskActions from "@/components/attention/QuickTaskActions";

type MyTasksWorkspaceProps = {
  stats: MyTasksWorkspaceStats;
  tasks: Task[];
  projects: Project[];
  waitingTaskIds: Set<string>;
  onUpdated?: () => void;
};

function projectName(projects: Project[], projectId: string | null | undefined): string {
  if (!projectId) return "Unknown project";
  return projects.find((project) => project.id === projectId)?.name ?? "Project";
}

export default function MyTasksWorkspace({
  stats,
  tasks,
  projects,
  waitingTaskIds,
  onUpdated,
}: MyTasksWorkspaceProps) {
  return (
    <section aria-label="My Tasks">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
        My Tasks
      </h3>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        <span>
          Open <strong className="text-primary">{stats.open}</strong>
        </span>
        <span>
          Due Today <strong className="text-primary">{stats.dueToday}</strong>
        </span>
        <span>
          Overdue <strong className="text-primary">{stats.overdue}</strong>
        </span>
        <span>
          Due This Week <strong className="text-primary">{stats.dueThisWeek}</strong>
        </span>
        <span>
          Completed This Week{" "}
          <strong className="text-primary">{stats.completedThisWeek}</strong>
        </span>
      </div>

      {tasks.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No open tasks assigned to you.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {tasks.slice(0, 20).map((task) => (
            <li
              key={task._uuid}
              className="rounded-lg border border-border bg-white px-3 py-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">
                    {projectName(projects, task.project_id)}
                  </p>
                  <p className="text-sm font-medium text-primary">
                    #{task.id} {task.Issue}
                  </p>
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
          ))}
        </ul>
      )}
    </section>
  );
}
