"use client";

import type { TemplatePreviewGroup } from "@/lib/templates/types";
import { subtaskTreeMarker } from "@/lib/templates/preview";
import { DEPENDENCY_TYPE_LABELS } from "@/lib/templates/types";
import type { TemplateTaskDependency } from "@/lib/templates/types";

type TemplatePreviewTreeProps = {
  groups: TemplatePreviewGroup[];
  dependencies?: TemplateTaskDependency[];
  taskTitleById?: Map<string, string>;
  compact?: boolean;
};

export default function TemplatePreviewTree({
  groups,
  dependencies = [],
  taskTitleById,
  compact = false,
}: TemplatePreviewTreeProps) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted">
        This template has no tasks yet. Add structure in the Template Editor.
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      {groups.map((group) => (
        <section key={group.areaLabel}>
          {!compact ? (
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
              {group.areaLabel}
            </h4>
          ) : null}
          <ul className={compact ? "mt-1 space-y-2" : "mt-2 space-y-3"}>
            {group.mains.map((node) => (
              <li key={node.task.id}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span
                    className={`text-sm ${node.task.is_milestone ? "font-bold text-amber-800" : "font-bold text-primary"}`}
                  >
                    {node.task.is_milestone ? "◆ " : null}
                    {node.task.title}
                  </span>
                  {node.computedDueDate ? (
                    <span className="text-xs text-muted">Due {node.computedDueDate}</span>
                  ) : node.task.due_offset_days != null ? (
                    <span className="text-xs text-muted">
                      +{node.task.due_offset_days}d
                    </span>
                  ) : null}
                  {node.task.is_critical ? (
                    <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                      Critical
                    </span>
                  ) : null}
                </div>
                {node.subtasks.length > 0 ? (
                  <ul className="mt-1 space-y-0.5 pl-1">
                    {node.subtasks.map((sub, index) => (
                      <li
                        key={sub.id}
                        className="flex items-baseline gap-2 font-mono text-xs text-primary/85"
                      >
                        <span className="w-5 shrink-0 text-muted/80">
                          {subtaskTreeMarker(index, node.subtasks.length)}
                        </span>
                        <span>{sub.title}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {dependencies.length > 0 ? (
        <section className="rounded-md border border-border bg-slate-50/80 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Dependencies
          </h4>
          <ul className="mt-2 space-y-1 text-xs text-primary">
            {dependencies.map((dep) => {
              const from =
                taskTitleById?.get(dep.predecessor_template_task_id) ?? "Task";
              const to =
                taskTitleById?.get(dep.successor_template_task_id) ?? "Task";
              return (
                <li key={dep.id}>
                  {from} → {to}{" "}
                  <span className="text-muted">
                    ({DEPENDENCY_TYPE_LABELS[dep.dependency_type]})
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
