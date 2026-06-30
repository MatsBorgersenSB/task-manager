"use client";

import type { Task } from "@/lib/tasks/types";
import {
  canMoveTaskToSubtask,
  canReparentSubtask,
} from "@/lib/tasks/subtasks";

export type TaskRowContextMenuState = {
  task: Task;
  x: number;
  y: number;
} | null;

type TaskRowContextMenuProps = {
  menu: TaskRowContextMenuState;
  allTasks: Task[];
  canEdit: boolean;
  onClose: () => void;
  onOpenTask: (task: Task) => void;
  onCreateSubtask: (task: Task) => void;
  onConvertToSubtask: (task: Task) => void;
  onPromoteToMain: (task: Task) => void;
  onMoveToParent: (task: Task) => void;
};

export default function TaskRowContextMenu({
  menu,
  allTasks,
  canEdit,
  onClose,
  onOpenTask,
  onCreateSubtask,
  onConvertToSubtask,
  onPromoteToMain,
  onMoveToParent,
}: TaskRowContextMenuProps) {
  if (!menu || !canEdit) return null;

  const { task, x, y } = menu;
  const isSubtask = Boolean(task.parent_task_id);
  const isMain = !isSubtask;
  const canConvert = canMoveTaskToSubtask(task, allTasks);
  const canReparent = canReparentSubtask(task, allTasks);
  const canPromote = isSubtask;
  const canAddSubtask = isMain;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[65] cursor-default bg-transparent"
        aria-label="Close menu"
        onClick={onClose}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose();
        }}
      />
      <div
        className="fixed z-[66] min-w-[12rem] rounded-lg border border-border bg-white py-1 shadow-lg"
        style={{ left: x, top: y }}
        role="menu"
      >
        <button
          type="button"
          role="menuitem"
          className="block w-full px-3 py-2 text-left text-sm text-primary transition hover:bg-slate-100"
          onClick={() => {
            onOpenTask(task);
            onClose();
          }}
        >
          Open task
        </button>

        <div className="my-1 border-t border-border/70" role="separator" />

        <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Hierarchy
        </p>

        {canAddSubtask ? (
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-primary transition hover:bg-slate-100"
            onClick={() => {
              onCreateSubtask(task);
              onClose();
            }}
          >
            Create subtask
          </button>
        ) : null}

        {canConvert ? (
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-primary transition hover:bg-slate-100"
            onClick={() => {
              onConvertToSubtask(task);
              onClose();
            }}
          >
            Convert to subtask
          </button>
        ) : null}

        {canPromote ? (
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-primary transition hover:bg-slate-100"
            onClick={() => {
              onPromoteToMain(task);
              onClose();
            }}
          >
            Promote to main task
          </button>
        ) : null}

        {canReparent ? (
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-primary transition hover:bg-slate-100"
            onClick={() => {
              onMoveToParent(task);
              onClose();
            }}
          >
            Move to different parent
          </button>
        ) : null}
      </div>
    </>
  );
}
