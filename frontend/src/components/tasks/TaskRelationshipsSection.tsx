"use client";

import type { Task } from "@/lib/tasks/types";
import { taskHierarchyLabel } from "@/lib/tasks/subtasks";
import { ui } from "@/lib/ui/classes";

type TaskRelationshipsSectionProps = {
  activeTask: Task;
  parentTask?: Task;
  subtasks: Task[];
  canEdit: boolean;
  canReparent: boolean;
  canPromote: boolean;
  onOpenTask?: (task: Task) => void;
  onMoveToDifferentParent?: () => void;
  onPromote?: () => void;
  moveLoading?: boolean;
  promoteDisabled?: boolean;
};

function relationshipLabel(task: Task): string {
  const title = (task.Issue ?? "").trim() || "Untitled";
  return `${title} (#${task.id})`;
}

export default function TaskRelationshipsSection({
  activeTask,
  parentTask,
  subtasks,
  canEdit,
  canReparent,
  canPromote,
  onOpenTask,
  onMoveToDifferentParent,
  onPromote,
  moveLoading = false,
  promoteDisabled = false,
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
          {canEdit && (canReparent || canPromote) ? (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              {canReparent && onMoveToDifferentParent ? (
                <button
                  type="button"
                  disabled={moveLoading}
                  onClick={onMoveToDifferentParent}
                  className={`${ui.btnSecondary} w-full sm:w-auto`}
                >
                  Move to different parent
                </button>
              ) : null}
              {canPromote && onPromote ? (
                <button
                  type="button"
                  disabled={promoteDisabled}
                  onClick={onPromote}
                  className={`${ui.btnSecondary} w-full sm:w-auto`}
                >
                  Promote to main task
                </button>
              ) : null}
            </div>
          ) : null}
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
