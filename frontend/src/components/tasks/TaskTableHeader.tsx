"use client";

import { useMemo, useState } from "react";
import type {
  ColumnGroupDef,
  HeaderGroupSegment,
} from "@/lib/tasks/columnLayout";
import AreaColumnHeaderMenu from "@/components/tasks/AreaColumnHeaderMenu";
import ColumnFilterMenu from "@/components/tasks/ColumnFilterMenu";
import { DueDateColumnLegend } from "@/components/tasks/TaskManagerGuidance";
import {
  columnSupportsHeaderFilter,
  getUniqueColumnFilterValues,
  isColumnFilterActive,
} from "@/lib/tasks/columnFilterValues";
import type { ColumnFilterContext } from "@/lib/tasks/columnFilters";
import { STRUCTURED_FILTER_COLUMN_IDS } from "@/lib/tasks/columnFilters";
import type { TableColumnDef } from "@/lib/tasks/labels";
import {
  columnSupportsSort,
  isColumnSortActive,
  sortIndicatorForColumn,
} from "@/lib/tasks/tableHeaderControls";
import type { TaskFilters } from "@/lib/tasks/types";
import {
  isCenterAlignedTableColumn,
  tableColumnHeaderAlignClass,
  tableColumnHeaderContentClass,
} from "@/lib/tasks/tableColumnAlignment";
import { ui } from "@/lib/ui/classes";

type TaskTableHeaderProps = {
  tableColumns: TableColumnDef[];
  groupSegments?: HeaderGroupSegment[];
  onToggleColumnGroup?: (groupId: string) => void;
  onMoveColumn?: (
    sourceColumnId: string,
    targetColumnId: string,
    position: "before" | "after"
  ) => void;
  isInternal: boolean;
  filters: TaskFilters;
  filterSourceTasks: import("@/lib/tasks/types").Task[];
  columnFilterContext: ColumnFilterContext;
  allVisibleSelected: boolean;
  selectAllRef: React.RefObject<HTMLInputElement | null>;
  onToggleSelectAll: () => void;
  onColumnMultiFilterChange: (columnId: string, selected: string[]) => void;
  onToggleSort: (columnId: string) => void;
  getColumnWidth: (columnId: string) => number;
  onStartColumnResize: (
    columnId: string,
    clientX: number,
    pointerId: number,
    captureTarget: HTMLElement
  ) => void;
  onFitColumnToContent: (columnId: string) => void;
  tableColumnPaddingClass: (
    col: TableColumnDef,
    columnIndex: number,
    columnCount: number
  ) => string;
  groupByArea?: boolean;
  onToggleGroupByArea?: () => void;
  onAreaSortAscending?: () => void;
  onAreaSortDescending?: () => void;
};

function columnShowsFilter(columnId: string, isInternal: boolean): boolean {
  if (!columnSupportsHeaderFilter(columnId)) return false;

  if (!isInternal) {
    const internalOnly = new Set([
      "sb_status",
      "sb_priority",
      "visibility",
      "sb_owner",
      "risk",
    ]);
    if (internalOnly.has(columnId)) return false;
  }

  if (STRUCTURED_FILTER_COLUMN_IDS.has(columnId)) {
    return true;
  }

  return true;
}

function ColumnResizeHandle({
  columnId,
  label,
  onStartColumnResize,
  onFitColumnToContent,
}: {
  columnId: string;
  label: string;
  onStartColumnResize: (
    columnId: string,
    clientX: number,
    pointerId: number,
    captureTarget: HTMLElement
  ) => void;
  onFitColumnToContent: (columnId: string) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label} column`}
      title="Drag to resize · double-click to fit content"
      draggable={false}
      className="absolute right-0 top-0 z-40 flex h-full w-3 cursor-col-resize touch-none select-none items-stretch justify-end print:hidden"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        onStartColumnResize(
          columnId,
          event.clientX,
          event.pointerId,
          event.currentTarget
        );
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onFitColumnToContent(columnId);
      }}
    >
      <span
        aria-hidden
        className="my-0.5 w-0.5 rounded-full bg-white/40 transition-colors group-hover:bg-white/90 hover:bg-white/90"
      />
    </div>
  );
}

function renderHeaderLabel(col: TableColumnDef, isInternal: boolean) {
  const scopeBadge =
    isInternal && col.group === "sb" ? (
      <span
        className="ml-1 shrink-0 rounded bg-amber-400/20 px-1 py-px text-[9px] font-bold uppercase tracking-tight text-amber-200 print:hidden"
        title="Internal (Standard Bio) field — hidden from external clients"
      >
        SB
      </span>
    ) : isInternal && (col.id === "status" || col.id === "ce_comments") ? (
      <span
        className="ml-1 shrink-0 rounded bg-emerald-400/20 px-1 py-px text-[9px] font-bold uppercase tracking-tight text-emerald-200 print:hidden"
        title="Client Portal field — visible to and editable by shared project clients"
      >
        Client
      </span>
    ) : null;

  if (col.headerLines?.length) {
    return (
      <span className="inline-flex items-center gap-0.5">
        <span className="flex flex-col leading-[1.1] text-[10px]">
          {col.headerLines.map((line) => (
            <span key={line} className="whitespace-nowrap">
              {line}
            </span>
          ))}
        </span>
        {scopeBadge}
      </span>
    );
  }

  return (
    <span className="inline-flex min-w-0 items-center">
      <span className="truncate">{col.label}</span>
      {scopeBadge}
    </span>
  );
}

function groupLookupByColumnId(
  segments: HeaderGroupSegment[]
): Map<string, { group: ColumnGroupDef; hiddenCount: number }> {
  const map = new Map<string, { group: ColumnGroupDef; hiddenCount: number }>();
  for (const seg of segments) {
    if (!seg.group) continue;
    for (const col of seg.visibleColumns) {
      map.set(col.id, { group: seg.group, hiddenCount: seg.hiddenCount });
    }
  }
  return map;
}

export default function TaskTableHeader({
  tableColumns,
  groupSegments = [],
  onToggleColumnGroup,
  onMoveColumn,
  isInternal,
  filters,
  filterSourceTasks,
  columnFilterContext,
  allVisibleSelected,
  selectAllRef,
  onToggleSelectAll,
  onColumnMultiFilterChange,
  onToggleSort,
  getColumnWidth,
  onStartColumnResize,
  onFitColumnToContent,
  tableColumnPaddingClass,
  groupByArea = false,
  onToggleGroupByArea,
  onAreaSortAscending,
  onAreaSortDescending,
}: TaskTableHeaderProps) {
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    columnId: string;
    position: "before" | "after";
  } | null>(null);

  const filterOptionsByColumn = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const column of tableColumns) {
      if (!columnShowsFilter(column.id, isInternal)) continue;
      map.set(
        column.id,
        getUniqueColumnFilterValues(
          filterSourceTasks,
          column,
          columnFilterContext
        )
      );
    }
    return map;
  }, [tableColumns, filterSourceTasks, columnFilterContext, isInternal]);

  const hasGroupRow = useMemo(
    () => groupSegments.some((seg) => seg.group != null),
    [groupSegments]
  );

  const columnGroupMap = useMemo(
    () => groupLookupByColumnId(groupSegments),
    [groupSegments]
  );

  return (
    <>
      {hasGroupRow ? (
        <tr className="task-table-column-group-row print:hidden">
          <th
            className="w-10 border-b border-white/10 bg-[#0b222c] !px-2 !py-1"
            aria-hidden
          />
          {groupSegments.map((segment) => {
            const colSpan = segment.visibleColumns.length;
            const group = segment.group;
            if (!group) {
              return (
                <th
                  key={segment.key}
                  colSpan={colSpan}
                  className="border-b border-r border-white/10 bg-[#0b222c] !px-2.5 !py-1 text-left text-[10px] font-medium uppercase tracking-wider text-white/45"
                >
                  <span className="truncate">Columns</span>
                </th>
              );
            }

            const canCollapse = segment.allGroupColumns.length > 1;
            const isCollapsed = group.collapsed && segment.hiddenCount > 0;

            return (
              <th
                key={segment.key}
                colSpan={colSpan}
                className="border-b border-r border-white/15 bg-[#0b222c] !px-2.5 !py-1 text-left align-middle"
              >
                <div className="flex min-w-0 items-center justify-between gap-1.5">
                  {canCollapse && onToggleColumnGroup ? (
                    <button
                      type="button"
                      onClick={() => onToggleColumnGroup(group.id)}
                      className="inline-flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90 transition-colors hover:bg-white/10 hover:text-white"
                      aria-expanded={!group.collapsed}
                      title={
                        group.collapsed
                          ? `Expand ${group.label} (${segment.allGroupColumns.length} columns)`
                          : `Collapse ${group.label} (${segment.allGroupColumns.length} columns)`
                      }
                    >
                      <span
                        aria-hidden
                        className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded bg-white/15 text-[9px] leading-none text-white"
                      >
                        {group.collapsed ? "+" : "−"}
                      </span>
                      <span className="truncate">{group.label}</span>
                      {isCollapsed ? (
                        <span className="shrink-0 rounded-full bg-accent/80 px-1.5 py-0.2 text-[9px] font-bold normal-case tracking-normal text-white">
                          +{segment.hiddenCount} hidden
                        </span>
                      ) : (
                        <span className="shrink-0 text-[9px] font-normal normal-case tracking-normal text-white/55">
                          ({segment.allGroupColumns.length})
                        </span>
                      )}
                    </button>
                  ) : (
                    <span className="truncate px-1 text-[10px] font-semibold uppercase tracking-wider text-white/80">
                      {group.label}
                    </span>
                  )}
                </div>
              </th>
            );
          })}
        </tr>
      ) : null}

      <tr className="task-table-header-label-row">
        <th
          className={`${ui.tableHeadCell} task-table-header-select w-10 !px-2.5 !py-1.5 pl-3 pr-2 whitespace-nowrap print:hidden`}
        >
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allVisibleSelected}
            onChange={onToggleSelectAll}
            aria-label="Select all visible tasks"
            className="rounded border-border text-accent focus:ring-accent/20"
          />
        </th>
        {tableColumns.map((col, columnIndex) => {
          const sortable = columnSupportsSort(col.id);
          const sortActive = isColumnSortActive(col.id, filters.sort);
          const showFilter = columnShowsFilter(col.id, isInternal);
          const filterActive = isColumnFilterActive(
            filters.columnMultiFilters,
            col.id
          );
          const filterOptions = filterOptionsByColumn.get(col.id) ?? [];
          const isDateDueColumn = col.id === "date_due";
          const isAreaColumn = col.id === "area";
          const groupInfo = columnGroupMap.get(col.id);
          const isDropBefore =
            dropTarget?.columnId === col.id &&
            dropTarget.position === "before";
          const isDropAfter =
            dropTarget?.columnId === col.id && dropTarget.position === "after";

          return (
            <th
              key={col.id}
              draggable={Boolean(onMoveColumn)}
              onDragStart={(event) => {
                if (!onMoveColumn) return;
                setDraggedColumnId(col.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(
                  "application/x-task-column-id",
                  col.id
                );
              }}
              onDragEnd={() => {
                setDraggedColumnId(null);
                setDropTarget(null);
              }}
              onDragOver={(event) => {
                if (!onMoveColumn || !draggedColumnId) return;
                if (draggedColumnId === col.id) return;
                event.preventDefault();
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                const midpoint = rect.left + rect.width / 2;
                const position: "before" | "after" =
                  event.clientX < midpoint ? "before" : "after";
                setDropTarget({ columnId: col.id, position });
              }}
              onDragLeave={() => {
                if (dropTarget?.columnId === col.id) {
                  setDropTarget(null);
                }
              }}
              onDrop={(event) => {
                if (!onMoveColumn) return;
                event.preventDefault();
                event.stopPropagation();
                const sourceId =
                  draggedColumnId ||
                  event.dataTransfer.getData("application/x-task-column-id");
                const pos = dropTarget?.position ?? "before";
                setDraggedColumnId(null);
                setDropTarget(null);
                if (sourceId && sourceId !== col.id) {
                  onMoveColumn(sourceId, col.id, pos);
                }
              }}
              className={`${ui.tableHeadCell} group relative min-w-0 overflow-visible !px-3 !py-1.5 align-middle print:text-black ${tableColumnHeaderAlignClass(
                col
              )} ${tableColumnPaddingClass(
                col,
                columnIndex,
                tableColumns.length
              )} ${col.headerClass ?? ""} ${
                draggedColumnId === col.id ? "opacity-50" : ""
              } ${
                isDropBefore
                  ? "shadow-[inset_3px_0_0_0_#38bdf8]"
                  : isDropAfter
                    ? "shadow-[inset_-3px_0_0_0_#38bdf8]"
                    : ""
              }`}
              style={{ width: `${getColumnWidth(col.id)}px` }}
            >
              <div
                className={`flex min-w-0 flex-col gap-1 pr-3 ${isDateDueColumn ? "items-center" : ""}`}
              >
                <div
                  className={`flex min-w-0 items-center gap-0.5 ${tableColumnHeaderContentClass(
                    col
                  )}`}
                >
                  {onMoveColumn ? (
                    <span
                      aria-hidden
                      title={`Drag to move ${col.label} column`}
                      className="mr-0.5 cursor-grab select-none text-[10px] leading-none text-white/35 opacity-60 transition-opacity group-hover:opacity-100 active:cursor-grabbing print:hidden"
                    >
                      ⋮⋮
                    </span>
                  ) : null}

                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => onToggleSort(col.id)}
                      className={`inline-flex min-w-0 max-w-full items-center gap-0.5 hover:text-white/90 ${
                        isCenterAlignedTableColumn(col)
                          ? "justify-center text-center"
                          : "text-left"
                      } ${
                        sortActive
                          ? "text-white underline decoration-white/40"
                          : ""
                      }`}
                      title={`Sort by ${col.label}`}
                    >
                      {renderHeaderLabel(col, isInternal)}
                      {sortIndicatorForColumn(col.id, filters.sort)}
                    </button>
                  ) : (
                    renderHeaderLabel(col, isInternal)
                  )}

                  {groupInfo &&
                  groupInfo.group.collapsed &&
                  groupInfo.hiddenCount > 0 &&
                  onToggleColumnGroup ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleColumnGroup(groupInfo.group.id);
                      }}
                      className="ml-1 shrink-0 rounded bg-white/15 px-1 py-0.5 text-[9px] font-semibold text-white hover:bg-white/25 print:hidden"
                      title={`Expand ${groupInfo.group.label} (+${groupInfo.hiddenCount} columns)`}
                    >
                      +{groupInfo.hiddenCount}
                    </button>
                  ) : null}

                  {isAreaColumn &&
                  onToggleGroupByArea &&
                  onAreaSortAscending &&
                  onAreaSortDescending ? (
                    <AreaColumnHeaderMenu
                      sort={filters.sort}
                      groupByArea={groupByArea}
                      filterOptions={filterOptions}
                      selectedFilters={filters.columnMultiFilters[col.id] ?? []}
                      onSortAscending={onAreaSortAscending}
                      onSortDescending={onAreaSortDescending}
                      onToggleGroupByArea={onToggleGroupByArea}
                      onFilterChange={(selected) =>
                        onColumnMultiFilterChange(col.id, selected)
                      }
                    />
                  ) : showFilter ? (
                    <ColumnFilterMenu
                      columnLabel={col.label}
                      options={filterOptions}
                      selected={filters.columnMultiFilters[col.id] ?? []}
                      onChange={(selected) =>
                        onColumnMultiFilterChange(col.id, selected)
                      }
                    />
                  ) : null}

                  {filterActive ? (
                    <span className="sr-only">Filter active</span>
                  ) : null}
                </div>

                {isDateDueColumn ? (
                  <DueDateColumnLegend className="print:hidden" />
                ) : null}
              </div>

              <ColumnResizeHandle
                columnId={col.id}
                label={col.label}
                onStartColumnResize={onStartColumnResize}
                onFitColumnToContent={onFitColumnToContent}
              />
            </th>
          );
        })}
      </tr>
    </>
  );
}

export { cycleColumnSort } from "@/lib/tasks/tableHeaderControls";
