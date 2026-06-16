import type { Task, TaskFilters, TaskViewMode } from "@/lib/tasks/types";
import { CLIENT_STATUS_FILTER_ALL } from "@/lib/tasks/constants";
import { normalizeDateInput, visibilityBadgeLabel } from "@/lib/tasks/utils";
import {
  defaultExportColumnIds,
  exportColumnIdsForMode,
  fieldLabel,
  filterStatusLabel,
  sortOptionLabel,
} from "@/lib/tasks/labels";

export type ExportColumnDef = {
  id: string;
  label: string;
  modes: TaskViewMode[];
  value: (task: Task) => string;
};

const EXPORT_COLUMN_DEFS: ExportColumnDef[] = [
  {
    id: "id",
    label: "ID",
    modes: ["client", "internal"],
    value: (t) => String(t.id),
  },
  {
    id: "title",
    label: fieldLabel("Issue"),
    modes: ["client", "internal"],
    value: (t) => t.Issue ?? "",
  },
  {
    id: "status",
    label: fieldLabel("status"),
    modes: ["client", "internal"],
    value: (t) => t.status ?? "",
  },
  {
    id: "priority",
    label: fieldLabel("Priority"),
    modes: ["client", "internal"],
    value: (t) => t.Priority ?? "",
  },
  {
    id: "assigned",
    label: fieldLabel("Responsible"),
    modes: ["client", "internal"],
    value: (t) => t.Responsible ?? "",
  },
  {
    id: "description",
    label: fieldLabel("CE Comments"),
    modes: ["client", "internal"],
    value: (t) => t["CE Comments"] ?? "",
  },
  {
    id: "response",
    label: fieldLabel("Response or Action taken by SB"),
    modes: ["client", "internal"],
    value: (t) => t["Response or Action taken by SB"] ?? "",
  },
  {
    id: "due",
    label: fieldLabel("Date Due"),
    modes: ["client", "internal"],
    value: (t) => formatExportDate(t["Date Due"]),
  },
  {
    id: "completed",
    label: fieldLabel("Date Completed"),
    modes: ["client", "internal"],
    value: (t) => formatExportDate(t["Date Completed"]),
  },
  {
    id: "sb_status",
    label: fieldLabel("SB Status"),
    modes: ["internal"],
    value: (t) => t["SB Status"] ?? "",
  },
  {
    id: "sb_priority",
    label: fieldLabel("SB Priority"),
    modes: ["internal"],
    value: (t) => t["SB Priority"] ?? "",
  },
  {
    id: "visibility_scope",
    label: fieldLabel("Visibility"),
    modes: ["internal"],
    value: (t) => visibilityBadgeLabel(t.visibility_scope),
  },
  {
    id: "sb_owner",
    label: fieldLabel("SB Owner"),
    modes: ["internal"],
    value: (t) => t["SB Owner"] ?? "",
  },
  {
    id: "risk",
    label: fieldLabel("Risk"),
    modes: ["internal"],
    value: (t) => t.Risk ?? "",
  },
  {
    id: "risk_comment",
    label: fieldLabel("Risk Comment"),
    modes: ["internal"],
    value: (t) => t["Risk Comment"] ?? "",
  },
  {
    id: "sb_note",
    label: fieldLabel("SB Note"),
    modes: ["internal"],
    value: (t) => t["SB Note"] ?? "",
  },
];

export const EXPORT_COLUMNS: ExportColumnDef[] = EXPORT_COLUMN_DEFS;

export function columnsForMode(
  mode: TaskViewMode,
  selectedIds?: string[]
): ExportColumnDef[] {
  const order = exportColumnIdsForMode(mode);
  const available = order.flatMap((id) => {
    const col = EXPORT_COLUMN_DEFS.find((c) => c.id === id);
    return col && col.modes.includes(mode) ? [col] : [];
  });
  if (!selectedIds?.length) return available;
  return available.filter((c) => selectedIds.includes(c.id));
}

export function defaultColumnIds(mode: TaskViewMode): string[] {
  return defaultExportColumnIds(mode);
}

export function formatExportDate(value: string | null | undefined): string {
  const normalized = normalizeDateInput(value);
  if (!normalized) return "";
  const [y, m, d] = normalized.split("-");
  if (!y || !m || !d) return normalized;
  return `${d}/${m}/${y}`;
}

export function exportFileName(extension: "xlsx" | "csv"): string {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  return `tasks_export_${date}.${extension}`;
}

export function tasksToRows(
  tasks: Task[],
  columns: ExportColumnDef[]
): Record<string, string>[] {
  return tasks.map((task) => {
    const row: Record<string, string> = {};
    for (const col of columns) {
      row[col.label] = col.value(task);
    }
    return row;
  });
}

export function buildFilterSummary(
  filters: TaskFilters,
  visibleCount: number,
  totalCount: number,
  mode: TaskViewMode
): string {
  const parts: string[] = [
    `Showing ${visibleCount} of ${totalCount} task${totalCount === 1 ? "" : "s"}`,
  ];

  if (filters.searchText) {
    parts.push(`Search: "${filters.searchText}"`);
  }
  if (mode === "internal" && filters.priority) {
    parts.push(`Priority: ${filters.priority}`);
  }
  if (filters.status === CLIENT_STATUS_FILTER_ALL) {
    parts.push(`${filterStatusLabel()}: All`);
  } else if (filters.status) {
    parts.push(`${filterStatusLabel()}: ${filters.status}`);
  } else {
    parts.push(`${filterStatusLabel()}: Active tasks`);
  }
  if (mode === "internal" && filters.sbStatus) {
    parts.push(`${fieldLabel("SB Status")}: ${filters.sbStatus}`);
  }
  if (mode === "internal" && filters.sbPriority) {
    parts.push(`${fieldLabel("SB Priority")}: ${filters.sbPriority}`);
  }
  if (mode === "internal" && filters.visibilityScope) {
    parts.push(
      `${fieldLabel("Visibility")}: ${visibilityBadgeLabel(filters.visibilityScope)}`
    );
  }
  if (filters.due) {
    const dueLabels: Record<string, string> = {
      overdue: "Overdue",
      has: "Has due date",
      none: "No due date",
    };
    parts.push(`Due: ${dueLabels[filters.due] ?? filters.due}`);
  }
  if (filters.sort && filters.sort !== "id") {
    parts.push(`Sort: ${sortOptionLabel(filters.sort)}`);
  }

  return parts.join(" · ");
}

export function downloadCsv(tasks: Task[], columns: ExportColumnDef[]): void {
  const rows = tasksToRows(tasks, columns);
  if (rows.length === 0) {
    const header = columns.map((c) => c.label).join(",");
    triggerDownload(header + "\n", exportFileName("csv"));
    return;
  }

  const header = columns.map((c) => c.label);
  const lines = [
    header.map(escapeCsvCell).join(","),
    ...rows.map((row) =>
      header.map((label) => escapeCsvCell(row[label] ?? "")).join(",")
    ),
  ];
  triggerDownload(lines.join("\n"), exportFileName("csv"));
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
