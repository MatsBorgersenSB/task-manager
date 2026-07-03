"use client";

import { useMemo } from "react";
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
      // Positioned fully INSIDE the cell at its right edge. A previous
      // implementation used a negative right offset so the handle overlapped the
      // next column; the following <th> then covered it, leaving only the last
      // column resizable. Keeping it inside guarantees every column's handle is
      // independently hit-testable. `justify-end` keeps the visible bar on the border.
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

export default function TaskTableHeader({
  tableColumns,
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
}: TaskTableHeaderProps) {
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

  return (
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

        return (
          <th
            key={col.id}
            className={`${ui.tableHeadCell} group relative min-w-0 overflow-visible !px-3 !py-1.5 align-middle print:text-black ${tableColumnHeaderAlignClass(
              col
            )} ${tableColumnPaddingClass(
              col,
              columnIndex,
              tableColumns.length
            )} ${col.headerClass ?? ""}`}
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
              {sortable ? (
                <button
                  type="button"
                  onClick={() => onToggleSort(col.id)}
                  className={`inline-flex min-w-0 max-w-full items-center gap-0.5 truncate hover:text-white/90 ${
                    isCenterAlignedTableColumn(col) ? "justify-center text-center" : "text-left"
                  } ${
                    sortActive ? "text-white underline decoration-white/40" : ""
                  }`}
                  title={`Sort by ${col.label}`}
                >
                  <span className="truncate">{col.label}</span>
                  {sortIndicatorForColumn(col.id, filters.sort)}
                </button>
              ) : (
                <span className="min-w-0 truncate">{col.label}</span>
              )}

              {showFilter ? (
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
  );
}

export { cycleColumnSort } from "@/lib/tasks/tableHeaderControls";
