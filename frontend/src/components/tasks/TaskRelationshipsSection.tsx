"use client";

import type { Task } from "@/lib/tasks/types";
import { taskHierarchyLabel } from "@/lib/tasks/subtasks";
import { ui } from "@/lib/ui/classes";

type TaskRelationshipsSectionProps = {
  activeTask: Task;
  parentTask?: Task;
  subtasks: Task[];
  onOpenTask?: (task: Task) => void;
};

function relationshipLabel(task: Task): string {
  const title = (task.Issue ?? "").trim() || "Untitled";
  return `${title} (#${task.id})`;
}

export default function TaskRelationshipsSection({
  activeTask,
  parentTask,
  subtasks,
  onOpenTask,
}: TaskRelationshipsSectionProps) {
  const isSubtask = Boolean(activeTask.parent_task_id);
  const hasChildren = subtasks.length > 0;

  if (!isSubtask && !hasChildren) {
    return (
      <p className="text-sm text-muted">
        No parent or subtasks linked to this task.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {parentTask ? (
        <div>
          <p className={ui.textMicro}>Parent task</p>
          <button
            type="button"
            onClick={() => onOpenTask?.(parentTask)}
            className="mt-1 text-left text-sm font-medium text-accent hover:underline"
          >
            {relationshipLabel(parentTask)}
          </button>
        </div>
      ) : null}

      {hasChildren ? (
        <div>
          <p className={ui.textMicro}>
            Subtasks ({subtasks.length})
          </p>
          <ul className="mt-2 space-y-1.5">
            {subtasks.map((subtask) => (
              <li key={subtask._uuid}>
                <button
                  type="button"
                  onClick={() => onOpenTask?.(subtask)}
                  className="text-left text-sm text-primary hover:text-accent hover:underline"
                >
                  {taskHierarchyLabel(subtask)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : isSubtask ? null : (
        <p className="text-sm text-muted">No subtasks yet.</p>
      )}
    </div>
  );
}
