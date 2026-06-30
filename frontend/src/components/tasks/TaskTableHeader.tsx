"use client";

import type { Area } from "@/lib/tasks/areas";
import { AREA_FILTER_ALL, AREA_FILTER_NONE, areaOptionLabel } from "@/lib/tasks/areas";
import {
  CLIENT_STATUS_FILTER_ALL,
  PRIORITY_FILTER_OPTIONS,
  RISK_OPTIONS,
  SB_PRIORITY_OPTIONS,
  SB_STATUS_OPTIONS,
  VISIBILITY_SCOPE_VALUES,
} from "@/lib/tasks/constants";
import {
  fieldLabel,
  filterStatusLabel,
  type TableColumnDef,
} from "@/lib/tasks/labels";
import { NO_FILTER_COLUMN_IDS, STRUCTURED_FILTER_COLUMN_IDS } from "@/lib/tasks/columnFilters";
import {
  columnSupportsSort,
  isColumnSortActive,
  sortIndicatorForColumn,
} from "@/lib/tasks/tableHeaderControls";
import type { TaskFilters } from "@/lib/tasks/types";
import { formatVisibilityScope } from "@/lib/tasks/visibility";
import { ui } from "@/lib/ui/classes";

const headerSelectClass =
  "mt-0.5 w-full min-w-0 rounded border border-white/40 bg-white px-1 py-0.5 text-[10px] font-normal leading-tight text-slate-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 print:hidden [&>option]:bg-white [&>option]:text-slate-900";

const headerInputClass =
  "mt-0.5 w-full min-w-0 rounded border border-white/40 bg-white px-1 py-0.5 text-[10px] font-normal leading-tight text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 print:hidden";

type TaskTableHeaderProps = {
  tableColumns: TableColumnDef[];
  isInternal: boolean;
  filters: TaskFilters;
  columnFilterDrafts: Record<string, string>;
  areas: Area[];
  statusOptions: string[];
  sbOwnerOptions: string[];
  allVisibleSelected: boolean;
  selectAllRef: React.RefObject<HTMLInputElement | null>;
  onToggleSelectAll: () => void;
  onColumnFilterDraftChange: (columnId: string, value: string) => void;
  onUpdateFilter: <K extends keyof TaskFilters>(
    key: K,
    value: TaskFilters[K]
  ) => void;
  onToggleSort: (columnId: string) => void;
  tableColumnPaddingClass: (
    col: TableColumnDef,
    columnIndex: number,
    columnCount: number
  ) => string;
};

function ColumnTextFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Filter…"
      className={headerInputClass}
      aria-label={`Filter ${label}`}
      onClick={(event) => event.stopPropagation()}
    />
  );
}

function HeaderFilterCell({
  columnId,
  columnLabel,
  isInternal,
  filters,
  columnFilterDrafts,
  areas,
  statusOptions,
  sbOwnerOptions,
  onColumnFilterDraftChange,
  onUpdateFilter,
}: Pick<
  TaskTableHeaderProps,
  | "isInternal"
  | "filters"
  | "columnFilterDrafts"
  | "areas"
  | "statusOptions"
  | "sbOwnerOptions"
  | "onColumnFilterDraftChange"
  | "onUpdateFilter"
> & { columnId: string; columnLabel: string }) {
  const textFilter = (
    <ColumnTextFilter
      label={columnLabel}
      value={columnFilterDrafts[columnId] ?? ""}
      onChange={(value) => onColumnFilterDraftChange(columnId, value)}
    />
  );

  switch (columnId) {
    case "id":
      return null;
    case "area":
      return (
        <select
          value={filters.area}
          onChange={(event) => onUpdateFilter("area", event.target.value)}
          className={headerSelectClass}
          aria-label={fieldLabel("Area")}
          onClick={(event) => event.stopPropagation()}
        >
          <option value={AREA_FILTER_ALL}>All</option>
          <option value={AREA_FILTER_NONE}>—</option>
          {areas.map((area) => (
            <option key={area.id} value={area.code}>
              {areaOptionLabel(area)}
            </option>
          ))}
        </select>
      );
    case "status":
      return (
        <div className="space-y-1 print:hidden">
          <select
            value={filters.status}
            onChange={(event) => onUpdateFilter("status", event.target.value)}
            className={headerSelectClass}
            aria-label={filterStatusLabel(isInternal ? "internal" : "client")}
            onClick={(event) => event.stopPropagation()}
          >
            <option value="">Active</option>
            <option value={CLIENT_STATUS_FILTER_ALL}>All</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-[10px] font-normal text-white/80">
            <input
              type="checkbox"
              checked={filters.status === CLIENT_STATUS_FILTER_ALL}
              onChange={(event) =>
                onUpdateFilter(
                  "status",
                  event.target.checked ? CLIENT_STATUS_FILTER_ALL : ""
                )
              }
              className="rounded border-white/40 text-accent focus:ring-accent/20"
              onClick={(event) => event.stopPropagation()}
            />
            Completed
          </label>
        </div>
      );
    case "priority":
      return (
        <select
          value={filters.priority}
          onChange={(event) => onUpdateFilter("priority", event.target.value)}
          className={headerSelectClass}
          aria-label={fieldLabel("Priority")}
          onClick={(event) => event.stopPropagation()}
        >
          <option value="">All</option>
          {PRIORITY_FILTER_OPTIONS.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      );
    case "date_due":
      return (
        <select
          value={filters.due}
          onChange={(event) => onUpdateFilter("due", event.target.value)}
          className={headerSelectClass}
          aria-label="Due date"
          onClick={(event) => event.stopPropagation()}
        >
          <option value="">All</option>
          <option value="overdue">Overdue</option>
          <option value="has">Has date</option>
          <option value="none">No date</option>
        </select>
      );
    case "sb_status":
      return isInternal ? (
        <select
          value={filters.sbStatus}
          onChange={(event) => onUpdateFilter("sbStatus", event.target.value)}
          className={headerSelectClass}
          aria-label={fieldLabel("SB Status")}
          onClick={(event) => event.stopPropagation()}
        >
          <option value="">All</option>
          {SB_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      ) : null;
    case "sb_priority":
      return isInternal ? (
        <select
          value={filters.sbPriority}
          onChange={(event) =>
            onUpdateFilter("sbPriority", event.target.value)
          }
          className={headerSelectClass}
          aria-label={fieldLabel("SB Priority")}
          onClick={(event) => event.stopPropagation()}
        >
          <option value="">All</option>
          {SB_PRIORITY_OPTIONS.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      ) : null;
    case "visibility":
      return isInternal ? (
        <select
          value={filters.visibilityScope}
          onChange={(event) =>
            onUpdateFilter("visibilityScope", event.target.value)
          }
          className={headerSelectClass}
          aria-label={fieldLabel("Visibility")}
          onClick={(event) => event.stopPropagation()}
        >
          <option value="">All</option>
          {VISIBILITY_SCOPE_VALUES.map((scope) => (
            <option key={scope} value={scope}>
              {formatVisibilityScope(scope)}
            </option>
          ))}
        </select>
      ) : null;
    case "sb_owner":
      return isInternal ? (
        <select
          value={filters.sbOwners[0] ?? ""}
          onChange={(event) =>
            onUpdateFilter(
              "sbOwners",
              event.target.value ? [event.target.value] : []
            )
          }
          className={headerSelectClass}
          aria-label={fieldLabel("SB Owner")}
          onClick={(event) => event.stopPropagation()}
        >
          <option value="">All</option>
          {sbOwnerOptions.map((owner) => (
            <option key={owner} value={owner}>
              {owner}
            </option>
          ))}
        </select>
      ) : null;
    case "risk":
      return isInternal ? (
        <select
          value={filters.risk}
          onChange={(event) => onUpdateFilter("risk", event.target.value)}
          className={headerSelectClass}
          aria-label={fieldLabel("Risk")}
          onClick={(event) => event.stopPropagation()}
        >
          <option value="">All</option>
          {RISK_OPTIONS.map((risk) => (
            <option key={risk} value={risk}>
              {risk}
            </option>
          ))}
        </select>
      ) : null;
    default:
      if (
        NO_FILTER_COLUMN_IDS.has(columnId) ||
        STRUCTURED_FILTER_COLUMN_IDS.has(columnId)
      ) {
        return null;
      }
      return textFilter;
  }
}

export default function TaskTableHeader({
  tableColumns,
  isInternal,
  filters,
  columnFilterDrafts,
  areas,
  statusOptions,
  sbOwnerOptions,
  allVisibleSelected,
  selectAllRef,
  onToggleSelectAll,
  onColumnFilterDraftChange,
  onUpdateFilter,
  onToggleSort,
  tableColumnPaddingClass,
}: TaskTableHeaderProps) {
  return (
    <>
      <tr className="task-table-header-label-row">
        <th
          className={`${ui.tableHeadCell} task-table-header-select w-10 !px-2 !py-2 pl-3 pr-2 whitespace-nowrap print:hidden`}
          rowSpan={2}
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

          return (
            <th
              key={col.id}
              className={`${ui.tableHeadCell} !px-2 !py-1.5 text-[10px] font-semibold leading-tight whitespace-nowrap text-left align-top print:text-black ${tableColumnPaddingClass(
                col,
                columnIndex,
                tableColumns.length
              )} ${col.headerClass ?? ""}`}
            >
              {sortable ? (
                <button
                  type="button"
                  onClick={() => onToggleSort(col.id)}
                  className={`inline-flex items-center gap-0.5 text-left hover:text-white/90 ${
                    sortActive ? "text-white underline decoration-white/40" : ""
                  }`}
                  title={`Sort by ${col.label}`}
                >
                  {col.label}
                  {sortIndicatorForColumn(col.id, filters.sort)}
                </button>
              ) : (
                col.label
              )}
            </th>
          );
        })}
      </tr>
      <tr className="task-table-header-filter-row print:hidden">
        {tableColumns.map((col, columnIndex) => (
          <th
            key={`filter-${col.id}`}
            className={`${ui.tableHeadCell} !px-2 !pb-1.5 !pt-0 text-left align-top font-normal print:hidden ${tableColumnPaddingClass(
              col,
              columnIndex,
              tableColumns.length
            )} ${col.headerClass ?? ""}`}
          >
            <HeaderFilterCell
              columnId={col.id}
              columnLabel={col.label}
              isInternal={isInternal}
              filters={filters}
              columnFilterDrafts={columnFilterDrafts}
              areas={areas}
              statusOptions={statusOptions}
              sbOwnerOptions={sbOwnerOptions}
              onColumnFilterDraftChange={onColumnFilterDraftChange}
              onUpdateFilter={onUpdateFilter}
            />
          </th>
        ))}
      </tr>
    </>
  );
}

export { cycleColumnSort } from "@/lib/tasks/tableHeaderControls";
