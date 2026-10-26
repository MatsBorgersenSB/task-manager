import { AREA_FILTER_ALL, AREA_FILTER_NONE } from "@/lib/tasks/areas";
import { CLIENT_STATUS_FILTER_ALL } from "@/lib/tasks/constants";
import { fieldLabelForMode } from "@/lib/tasks/labels";
import type { Task, TaskFilters, TaskViewMode } from "@/lib/tasks/types";
import { visibilityBadgeLabel } from "@/lib/tasks/visibility";

export type ActiveFilterChip = {
  key: string;
  label: string;
  value: string;
};

const COLUMN_ID_LABELS: Record<string, string> = {
  issue: "Issue",
  area: "Area",
  status: "Client Status",
  priority: "Priority",
  responsible: "Responsible",
  ce_comments: "Client Comment",
  action_comment: "Action Comment",
  response_or_action_taken_by_sb: "Action Comment",
  date_due: "To Date",
  intervention_date: "From Date",
  intervention_duration: "Effort",
  date_completed: "Date Completed",
  sb_status: "SB Status",
  sb_priority: "SB Priority",
  sb_owner: "SB Owners",
  risk: "Risk",
  risk_comment: "Risk Comment",
  sb_note: "SB Note",
  visibility: "Visibility",
  links: "Links",
  subtasks: "Subtasks",
};

const DUE_LABELS: Record<string, string> = {
  overdue: "Overdue",
  "this-week": "Due in 7 days",
  none: "No due date",
  has: "Has due date",
};

export function matchesQuickSearch(task: Task, rawQuery?: string | null): boolean {
  const query = (rawQuery ?? "").trim().toLowerCase();
  if (!query) return true;

  const normalizedIdQuery = query.startsWith("#") ? query.slice(1) : query;
  if (normalizedIdQuery && String(task.id).includes(normalizedIdQuery)) {
    return true;
  }

  const haystacks = [
    task.Issue,
    task.areaCode,
    task.areaName,
    task.Responsible,
    task["SB Owner"],
    task["CE Comments"],
    task["Response or Action taken by SB"],
    task["SB Note"],
    task.status,
    task["SB Status"],
  ];

  for (const field of haystacks) {
    if (field && field.toLowerCase().includes(query)) {
      return true;
    }
  }

  return false;
}

export function buildActiveFilterChips(
  filters: TaskFilters,
  mode: TaskViewMode
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  const search = (filters.searchQuery ?? "").trim();
  if (search) {
    chips.push({
      key: "searchQuery",
      label: "Search",
      value: `"${search}"`,
    });
  }

  if (filters.area && filters.area !== AREA_FILTER_ALL) {
    chips.push({
      key: "area",
      label: "Area",
      value: filters.area === AREA_FILTER_NONE ? "No area" : filters.area,
    });
  }

  if (filters.status && filters.status !== CLIENT_STATUS_FILTER_ALL) {
    chips.push({
      key: "status",
      label: fieldLabelForMode("status", mode),
      value: filters.status,
    });
  }

  if (filters.sbStatus) {
    chips.push({
      key: "sbStatus",
      label: "SB Status",
      value: filters.sbStatus,
    });
  }

  if (filters.priority) {
    chips.push({
      key: "priority",
      label: "Priority",
      value: filters.priority,
    });
  }

  if (filters.sbPriority) {
    chips.push({
      key: "sbPriority",
      label: "SB Priority",
      value: filters.sbPriority,
    });
  }

  if (filters.due) {
    chips.push({
      key: "due",
      label: "Due",
      value: DUE_LABELS[filters.due] ?? filters.due,
    });
  }

  if (filters.risk) {
    chips.push({
      key: "risk",
      label: "Risk",
      value: filters.risk,
    });
  }

  if (filters.visibilityScope) {
    chips.push({
      key: "visibilityScope",
      label: "Visibility",
      value: visibilityBadgeLabel(filters.visibilityScope),
    });
  }

  for (const owner of filters.sbOwners ?? []) {
    if (!owner) continue;
    chips.push({
      key: `sbOwners:${owner}`,
      label: "SB Owner",
      value: owner,
    });
  }

  for (const [colId, text] of Object.entries(filters.columnFilters ?? {})) {
    const trimmed = (text ?? "").trim();
    if (!trimmed) continue;
    chips.push({
      key: `columnFilter:${colId}`,
      label: COLUMN_ID_LABELS[colId] ?? colId,
      value: `"${trimmed}"`,
    });
  }

  for (const [colId, values] of Object.entries(filters.columnMultiFilters ?? {})) {
    if (!values || values.length === 0) continue;
    chips.push({
      key: `columnMultiFilter:${colId}`,
      label: COLUMN_ID_LABELS[colId] ?? colId,
      value:
        values.length <= 2
          ? values.join(", ")
          : `${values[0]} +${values.length - 1}`,
    });
  }

  return chips;
}

export function removeFilterChip(
  filters: TaskFilters,
  chipKey: string
): TaskFilters {
  if (chipKey === "searchQuery") {
    return { ...filters, searchQuery: "" };
  }
  if (chipKey === "area") {
    return { ...filters, area: AREA_FILTER_ALL };
  }
  if (chipKey === "status") {
    return { ...filters, status: "" };
  }
  if (chipKey === "sbStatus") {
    return { ...filters, sbStatus: "" };
  }
  if (chipKey === "priority") {
    return { ...filters, priority: "" };
  }
  if (chipKey === "sbPriority") {
    return { ...filters, sbPriority: "" };
  }
  if (chipKey === "due") {
    return { ...filters, due: "" };
  }
  if (chipKey === "risk") {
    return { ...filters, risk: "" };
  }
  if (chipKey === "visibilityScope") {
    return { ...filters, visibilityScope: "" };
  }
  if (chipKey.startsWith("sbOwners:")) {
    const target = chipKey.slice("sbOwners:".length);
    return {
      ...filters,
      sbOwners: (filters.sbOwners ?? []).filter((o) => o !== target),
    };
  }
  if (chipKey.startsWith("columnFilter:")) {
    const colId = chipKey.slice("columnFilter:".length);
    const next = { ...filters.columnFilters };
    delete next[colId];
    return { ...filters, columnFilters: next };
  }
  if (chipKey.startsWith("columnMultiFilter:")) {
    const colId = chipKey.slice("columnMultiFilter:".length);
    return {
      ...filters,
      columnMultiFilters: {
        ...filters.columnMultiFilters,
        [colId]: [],
      },
    };
  }
  return filters;
}
