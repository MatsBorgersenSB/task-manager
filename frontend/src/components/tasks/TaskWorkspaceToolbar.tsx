"use client";

import ColumnVisibilityMenu from "@/components/tasks/ColumnVisibilityMenu";
import ViewModeTabs, { type TaskViewTab } from "@/components/tasks/ViewModeTabs";
import ExportMenu from "@/components/shared/ExportMenu";
import type { ActiveFilterChip } from "@/lib/tasks/activeFilterChips";
import type {
  ColumnGroupDef,
  TableColumnPresetId,
} from "@/lib/tasks/columnLayout";
import type { TableColumnDef } from "@/lib/tasks/labels";
import type { SummaryFilterKey } from "@/lib/tasks/summaryFilters";
import type { Task, TaskViewMode } from "@/lib/tasks/types";
import { ui } from "@/lib/ui/classes";

type ClientQuickFilterSummary = {
  activeFilter: SummaryFilterKey | null;
  unacknowledgedCount: number;
  myTasksCount: number;
  overdueCount: number;
  dueThisWeekCount: number;
  onSelectFilter: (key: SummaryFilterKey) => void;
};

type TaskWorkspaceToolbarProps = {
  mode: TaskViewMode;
  visibleTasks: Task[];
  disabled?: boolean;
  focusMode?: boolean;
  isFullscreen?: boolean;
  onToggleFocus?: () => void;
  onToggleFullscreen?: () => void;
  onOpenShortcutsHelp?: () => void;
  onNewTask?: () => void;
  onPrint: () => void;
  onClearFilters?: () => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  activeFilterChips?: ActiveFilterChip[];
  onRemoveFilterChip?: (chipKey: string) => void;
  viewMode?: TaskViewTab;
  onViewModeChange?: (view: TaskViewTab) => void;
  showBlueprintTab?: boolean;
  isProjectShared?: boolean;
  showOptionalColumns?: boolean;
  showClientColumns?: boolean;
  onToggleOptionalColumns?: (next: boolean) => void;
  onToggleClientColumns?: (next: boolean) => void;
  showColumnToggle?: boolean;
  orderedColumns?: TableColumnDef[];
  columnGroups?: ColumnGroupDef[];
  onMoveColumn?: (
    sourceColumnId: string,
    targetColumnId: string,
    position: "before" | "after"
  ) => void;
  onAssignColumnGroup?: (columnId: string, groupId: string | null) => void;
  onToggleGroupCollapsed?: (groupId: string) => void;
  onAddColumnGroup?: (label: string) => void;
  onRemoveColumnGroup?: (groupId: string) => void;
  onResetColumnLayout?: () => void;
  onApplyColumnPreset?: (presetId: TableColumnPresetId) => void;
  clientQuickFilters?: ClientQuickFilterSummary;
};

export default function TaskWorkspaceToolbar({
  mode,
  visibleTasks,
  disabled = false,
  focusMode = false,
  isFullscreen = false,
  onToggleFocus,
  onToggleFullscreen,
  onOpenShortcutsHelp,
  onNewTask,
  onPrint,
  onClearFilters,
  searchQuery = "",
  onSearchQueryChange,
  activeFilterChips = [],
  onRemoveFilterChip,
  viewMode,
  onViewModeChange,
  showBlueprintTab = false,
  isProjectShared = true,
  showOptionalColumns = false,
  showClientColumns = false,
  onToggleOptionalColumns,
  onToggleClientColumns,
  showColumnToggle = false,
  orderedColumns = [],
  columnGroups = [],
  onMoveColumn,
  onAssignColumnGroup,
  onToggleGroupCollapsed,
  onAddColumnGroup,
  onRemoveColumnGroup,
  onResetColumnLayout,
  onApplyColumnPreset,
  clientQuickFilters,
}: TaskWorkspaceToolbarProps) {
  return (
    <div className="no-print border-b border-border/70 bg-surface print:hidden">
      <div
        className={`${ui.compactBar} flex-wrap items-center justify-between gap-x-3 gap-y-2`}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
          {viewMode && onViewModeChange ? (
            <ViewModeTabs
              value={viewMode}
              onChange={onViewModeChange}
              showBlueprint={showBlueprintTab}
            />
          ) : null}

          {onSearchQueryChange ? (
            <div className="relative flex min-w-[12rem] max-w-xs flex-1 items-center">
              <span
                aria-hidden
                className="pointer-events-none absolute left-2.5 text-xs text-muted"
              >
                🔍
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder="Quick search (#ID, issue, area, owner)…"
                aria-label="Quick search tasks"
                className="h-7 w-full rounded-md border border-border/90 bg-white pl-7 pr-6 text-xs text-primary placeholder:text-muted/75 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/25"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => onSearchQueryChange("")}
                  aria-label="Clear search query"
                  className="absolute right-1.5 rounded px-1 text-xs text-muted hover:text-primary"
                >
                  ×
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {onNewTask ? (
            <button
              type="button"
              onClick={onNewTask}
              disabled={disabled}
              className={ui.btnPrimarySm}
              title="Create a new task in this project"
            >
              + New Task
            </button>
          ) : null}

          {showColumnToggle &&
          onToggleOptionalColumns &&
          onToggleClientColumns &&
          onMoveColumn &&
          onAssignColumnGroup &&
          onToggleGroupCollapsed &&
          onAddColumnGroup &&
          onRemoveColumnGroup &&
          onResetColumnLayout ? (
            <ColumnVisibilityMenu
              isInternal={mode === "internal"}
              isProjectShared={isProjectShared}
              showClientColumns={showClientColumns}
              showOptionalColumns={showOptionalColumns}
              onToggleClientColumns={onToggleClientColumns}
              onToggleOptionalColumns={onToggleOptionalColumns}
              orderedColumns={orderedColumns}
              groups={columnGroups}
              onMoveColumn={onMoveColumn}
              onAssignColumnGroup={onAssignColumnGroup}
              onToggleGroupCollapsed={onToggleGroupCollapsed}
              onAddGroup={onAddColumnGroup}
              onRemoveGroup={onRemoveColumnGroup}
              onResetLayout={onResetColumnLayout}
              onApplyPreset={onApplyColumnPreset}
            />
          ) : null}

          <ExportMenu
            mode={mode}
            tasks={visibleTasks}
            disabled={disabled}
            onPrint={onPrint}
          />

          {onToggleFocus ? (
            <button
              type="button"
              onClick={onToggleFocus}
              className={`${ui.btnUtilitySm}${
                focusMode ? " bg-accent/10 text-accent" : ""
              }`}
              aria-pressed={focusMode}
              title="Collapse workspace header for maximum table space (F)"
            >
              {focusMode ? "Show header" : "Focus"}
              <kbd className="ml-1 hidden rounded border border-border/80 bg-slate-100 px-1 py-px font-mono text-[10px] text-muted sm:inline">
                F
              </kbd>
            </button>
          ) : null}

          {onToggleFullscreen ? (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className={`${ui.btnUtilitySm}${
                isFullscreen ? " bg-accent/10 text-accent" : ""
              }`}
              aria-pressed={isFullscreen}
              title="Toggle fullscreen"
            >
              {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            </button>
          ) : null}

          {onOpenShortcutsHelp ? (
            <button
              type="button"
              onClick={onOpenShortcutsHelp}
              className={ui.btnUtilitySm}
              title="Keyboard shortcuts (?)"
              aria-label="Keyboard shortcuts"
            >
              <kbd className="font-mono text-xs font-semibold">?</kbd>
            </button>
          ) : null}
        </div>
      </div>

      {mode === "client" && clientQuickFilters ? (
        <div
          role="group"
          aria-label="Client quick action filters"
          className="flex flex-wrap items-center gap-1.5 border-t border-border/50 bg-slate-50/60 px-3 py-1.5"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Quick triage:
          </span>
          {(
            [
              {
                key: "unacknowledged" as const,
                label: "Needs My Acknowledgement",
                count: clientQuickFilters.unacknowledgedCount,
              },
              {
                key: "myTasks" as const,
                label: "Assigned to Me",
                count: clientQuickFilters.myTasksCount,
              },
              {
                key: "overdue" as const,
                label: "Overdue",
                count: clientQuickFilters.overdueCount,
              },
              {
                key: "dueThisWeek" as const,
                label: "Due This Week",
                count: clientQuickFilters.dueThisWeekCount,
              },
            ] as const
          ).map((item) => {
            const active = clientQuickFilters.activeFilter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={active}
                onClick={() => clientQuickFilters.onSelectFilter(item.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
                  active
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-white text-primary hover:border-accent/60 hover:bg-accent/5"
                }`}
              >
                <span>{item.label}</span>
                <span
                  className={`rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-muted"
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {activeFilterChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 bg-slate-50/70 px-3 py-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Active filters ({activeFilterChips.length}):
          </span>
          {activeFilterChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              <span className="text-muted">{chip.label}:</span>
              <span>{chip.value}</span>
              {onRemoveFilterChip ? (
                <button
                  type="button"
                  onClick={() => onRemoveFilterChip(chip.key)}
                  className="ml-0.5 rounded-full px-1 text-xs leading-none text-muted hover:bg-accent/20 hover:text-primary"
                  aria-label={`Remove ${chip.label} filter`}
                >
                  ×
                </button>
              ) : null}
            </span>
          ))}
          {onClearFilters ? (
            <button
              type="button"
              onClick={onClearFilters}
              className="ml-1 text-xs font-semibold text-accent underline-offset-2 hover:underline"
            >
              Clear all
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
