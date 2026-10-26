"use client";

import { PRIORITY_FILTER_OPTIONS } from "@/lib/tasks/constants";
import { ui } from "@/lib/ui/classes";

type FloatingBulkActionBarProps = {
  selectedCount: number;
  isInternalMode: boolean;
  canEditTasks: boolean;
  hasProject: boolean;
  bulkApplying: boolean;
  bulkProgressCompleted: number;
  bulkProgressTotal: number;
  bulkStatusValue: string;
  bulkStatusOptions: readonly string[];
  bulkPriorityValue: string;
  canBulkMoveHierarchy: boolean;
  bulkActionError: string | null;
  onBulkStatusChange: (value: string) => void;
  onApplyBulkStatus: () => void;
  onBulkPriorityChange: (value: string) => void;
  onApplyBulkPriority: () => void;
  onOpenBulkMoveUnderTask: () => void;
  onOpenBulkDelete: () => void;
  onOpenRenumber: () => void;
  onClearSelection: () => void;
};

export default function FloatingBulkActionBar({
  selectedCount,
  isInternalMode,
  canEditTasks,
  hasProject,
  bulkApplying,
  bulkProgressCompleted,
  bulkProgressTotal,
  bulkStatusValue,
  bulkStatusOptions,
  bulkPriorityValue,
  canBulkMoveHierarchy,
  bulkActionError,
  onBulkStatusChange,
  onApplyBulkStatus,
  onBulkPriorityChange,
  onApplyBulkPriority,
  onOpenBulkMoveUnderTask,
  onOpenBulkDelete,
  onOpenRenumber,
  onClearSelection,
}: FloatingBulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      role="region"
      aria-label="Bulk task actions"
      className="no-print fixed bottom-4 left-1/2 z-[120] flex max-w-[95vw] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-[#0B2A2F] px-4 py-2.5 text-white shadow-xl print:hidden"
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white">
        {selectedCount} selected
      </span>

      {bulkApplying && bulkProgressTotal > 0 ? (
        <span className="text-xs text-white/80">
          {bulkProgressCompleted}/{bulkProgressTotal}
        </span>
      ) : null}

      <div className="flex items-center gap-1.5">
        <select
          value={bulkStatusValue}
          onChange={(event) => {
            const val = event.target.value;
            onBulkStatusChange(val);
          }}
          className="h-7 rounded-md border border-white/20 bg-white/10 px-2 text-xs text-white focus:border-white focus:outline-none"
          aria-label="Bulk status"
          disabled={bulkApplying}
        >
          <option value="" className="text-primary">
            {isInternalMode ? "Set SB Status…" : "Set Status…"}
          </option>
          {bulkStatusOptions.map((option) => (
            <option key={option} value={option} className="text-primary">
              {option}
            </option>
          ))}
        </select>
        {bulkStatusValue ? (
          <button
            type="button"
            onClick={onApplyBulkStatus}
            disabled={!bulkStatusValue || bulkApplying}
            className="h-7 rounded-md bg-accent px-2.5 text-xs font-medium text-white transition hover:bg-accent/90 disabled:opacity-40"
          >
            Apply
          </button>
        ) : null}
      </div>

      {isInternalMode ? (
        <div className="flex items-center gap-1.5">
          <select
            value={bulkPriorityValue}
            onChange={(event) => {
              const val = event.target.value;
              onBulkPriorityChange(val);
            }}
            className="h-7 rounded-md border border-white/20 bg-white/10 px-2 text-xs text-white focus:border-white focus:outline-none"
            aria-label="Bulk priority"
            disabled={bulkApplying}
          >
            <option value="" className="text-primary">
              Set Priority…
            </option>
            {PRIORITY_FILTER_OPTIONS.map((option) => (
              <option key={option} value={option} className="text-primary">
                {option}
              </option>
            ))}
          </select>
          {bulkPriorityValue ? (
            <button
              type="button"
              onClick={onApplyBulkPriority}
              disabled={!bulkPriorityValue || bulkApplying}
              className="h-7 rounded-md bg-accent px-2.5 text-xs font-medium text-white transition hover:bg-accent/90 disabled:opacity-40"
            >
              Apply
            </button>
          ) : null}
        </div>
      ) : null}

      {isInternalMode && canBulkMoveHierarchy ? (
        <button
          type="button"
          onClick={onOpenBulkMoveUnderTask}
          disabled={bulkApplying}
          className="h-7 rounded-md border border-white/20 bg-white/10 px-2.5 text-xs font-medium text-white transition hover:bg-white/20 disabled:opacity-40"
        >
          ↳ Move Under Task…
        </button>
      ) : null}

      {isInternalMode && canEditTasks && hasProject ? (
        <button
          type="button"
          onClick={onOpenRenumber}
          disabled={bulkApplying}
          className="h-7 rounded-md border border-white/20 bg-white/10 px-2.5 text-xs font-medium text-white transition hover:bg-white/20 disabled:opacity-40"
        >
          Renumber 1..N
        </button>
      ) : null}

      {canEditTasks ? (
        <button
          type="button"
          onClick={onOpenBulkDelete}
          disabled={bulkApplying}
          className={ui.btnDanger}
        >
          Delete
        </button>
      ) : null}

      <button
        type="button"
        onClick={onClearSelection}
        disabled={bulkApplying}
        className="ml-1 rounded px-2 py-1 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white"
      >
        Clear (Esc)
      </button>

      {bulkActionError ? (
        <p className="basis-full text-center text-xs text-red-300">
          {bulkActionError}
        </p>
      ) : null}
    </div>
  );
}
