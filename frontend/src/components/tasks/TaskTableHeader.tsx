"use client";

import type { Area } from "@/lib/tasks/areas";
import { AREA_FILTER_ALL, AREA_FILTER_NONE, areaOptionLabel } from "@/lib/tasks/areas";
import {
  CLIENT_STATUS_FILTER_ALL,
  CLIENT_STATUS_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
  SB_PRIORITY_OPTIONS,
  SB_STATUS_OPTIONS,
  VISIBILITY_SCOPE_VALUES,
} from "@/lib/tasks/constants";
import {
  fieldLabel,
  filterStatusLabel,
  type TableColumnDef,
} from "@/lib/tasks/labels";
import {
  columnSupportsSort,
  cycleColumnSort,
  isColumnSortActive,
  sortIndicatorForColumn,
} from "@/lib/tasks/tableHeaderControls";
import type { TaskFilters } from "@/lib/tasks/types";
import { formatVisibilityScope } from "@/lib/tasks/visibility";
import { ui } from "@/lib/ui/classes";

const headerSelectClass =
  "mt-1 w-full min-w-0 rounded border border-white/25 bg-white/10 px-1 py-0.5 text-[11px] font-normal text-white focus:border-white/50 focus:outline-none focus:ring-1 focus:ring-white/30 print:hidden";

const headerInputClass =
  "mt-1 w-full min-w-0 rounded border border-white/25 bg-white/10 px-1.5 py-0.5 text-[11px] font-normal text-white placeholder:text-white/50 focus:border-white/50 focus:outline-none focus:ring-1 focus:ring-white/30 print:hidden";

type TaskTableHeaderProps = {
  tableColumns: TableColumnDef[];
  isInternal: boolean;
  filters: TaskFilters;
  searchDraft: string;
  areas: Area[];
  statusOptions: string[];
  sbOwnerOptions: string[];
  allVisibleSelected: boolean;
  selectAllRef: React.RefObject<HTMLInputElement | null>;
  onToggleSelectAll: () => void;
  onSearchDraftChange: (value: string) => void;
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

function HeaderFilterCell({
  columnId,
  isInternal,
  filters,
  searchDraft,
  areas,
  statusOptions,
  sbOwnerOptions,
  onSearchDraftChange,
  onUpdateFilter,
}: Pick<
  TaskTableHeaderProps,
  | "isInternal"
  | "filters"
  | "searchDraft"
  | "areas"
  | "statusOptions"
  | "sbOwnerOptions"
  | "onSearchDraftChange"
  | "onUpdateFilter"
> & { columnId: string }) {
  switch (columnId) {
    case "issue":
      return (
        <input
          type="search"
          value={searchDraft}
          onChange={(event) => onSearchDraftChange(event.target.value)}
          placeholder="Filter…"
          className={headerInputClass}
          aria-label="Filter by issue"
          onClick={(event) => event.stopPropagation()}
        />
      );
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
            aria-label={filterStatusLabel()}
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
      return isInternal ? (
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
      ) : null;
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
    default:
      return null;
  }
}

export default function TaskTableHeader({
  tableColumns,
  isInternal,
  filters,
  searchDraft,
  areas,
  statusOptions,
  sbOwnerOptions,
  allVisibleSelected,
  selectAllRef,
  onToggleSelectAll,
  onSearchDraftChange,
  onUpdateFilter,
  onToggleSort,
  tableColumnPaddingClass,
}: TaskTableHeaderProps) {
  return (
    <>
      <tr>
        <th
          className={`${ui.tableHeadCell} w-10 !bg-primary !px-2 !py-2 pl-3 pr-2 whitespace-nowrap print:hidden`}
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
              className={`${ui.tableHeadCell} !bg-primary !px-2 !py-2 text-xs font-semibold whitespace-nowrap text-left align-top print:text-black ${tableColumnPaddingClass(
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
      <tr className="bg-primary print:hidden">
        {tableColumns.map((col, columnIndex) => (
          <th
            key={`filter-${col.id}`}
            className={`${ui.tableHeadCell} !bg-primary !px-2 !pb-2 !pt-0 text-left align-top font-normal print:hidden ${tableColumnPaddingClass(
              col,
              columnIndex,
              tableColumns.length
            )} ${col.headerClass ?? ""}`}
          >
            <HeaderFilterCell
              columnId={col.id}
              isInternal={isInternal}
              filters={filters}
              searchDraft={searchDraft}
              areas={areas}
              statusOptions={statusOptions}
              sbOwnerOptions={sbOwnerOptions}
              onSearchDraftChange={onSearchDraftChange}
              onUpdateFilter={onUpdateFilter}
            />
          </th>
        ))}
      </tr>
    </>
  );
}

export { cycleColumnSort };
