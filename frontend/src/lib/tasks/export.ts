import type { Task, TaskFilters, TaskViewMode } from "@/lib/tasks/types";
import { normalizeDateInput } from "@/lib/tasks/utils";

export type ExportColumnDef = {
  id: string;
  label: string;
  modes: TaskViewMode[];
  value: (task: Task) => string;
};

/** User-friendly export columns mapped from task fields. */
export const EXPORT_COLUMNS: ExportColumnDef[] = [
  {
    id: "id",
    label: "ID",
    modes: ["client", "internal"],
    value: (t) => String(t.id),
  },
  {
    id: "title",
    label: "Title",
    modes: ["client", "internal"],
    value: (t) => t.Issue ?? "",
  },
  {
    id: "description",
    label: "Description",
    modes: ["client", "internal"],
    value: (t) => t["CE Comments"] ?? "",
  },
  {
    id: "status",
    label: "Status",
    modes: ["client", "internal"],
    value: (t) => t.status ?? "",
  },
  {
    id: "priority",
    label: "Priority",
    modes: ["client", "internal"],
    value: (t) => t.Priority ?? "",
  },
  {
    id: "assigned",
    label: "Assigned To",
    modes: ["client", "internal"],
    value: (t) => t.Responsible ?? "",
  },
  {
    id: "created",
    label: "Created Date",
    modes: ["client", "internal"],
    value: (t) => formatExportDate(t["Registration Date"]),
  },
  {
    id: "due",
    label: "Due Date",
    modes: ["client", "internal"],
    value: (t) => formatExportDate(t["Date Due"]),
  },
  {
    id: "completed",
    label: "Completed Date",
    modes: ["client", "internal"],
    value: (t) => formatExportDate(t["Date Completed"]),
  },
  {
    id: "risk",
    label: "Risk",
    modes: ["client", "internal"],
    value: (t) => t.Risk ?? "",
  },
  {
    id: "risk_comment",
    label: "Risk Comment",
    modes: ["client", "internal"],
    value: (t) => t["Risk Comment"] ?? "",
  },
  {
    id: "response",
    label: "SB Response",
    modes: ["client", "internal"],
    value: (t) => t["Response or Action taken by SB"] ?? "",
  },
  {
    id: "sb_status",
    label: "SB Status",
    modes: ["internal"],
    value: (t) => t["SB Status"] ?? "",
  },
  {
    id: "sb_owner",
    label: "SB Owner",
    modes: ["internal"],
    value: (t) => t["SB Owner"] ?? "",
  },
  {
    id: "sb_note",
    label: "SB Note",
    modes: ["internal"],
    value: (t) => t["SB Note"] ?? "",
  },
];

export function columnsForMode(
  mode: TaskViewMode,
  selectedIds?: string[]
): ExportColumnDef[] {
  const available = EXPORT_COLUMNS.filter((c) => c.modes.includes(mode));
  if (!selectedIds?.length) return available;
  return available.filter((c) => selectedIds.includes(c.id));
}

export function defaultColumnIds(mode: TaskViewMode): string[] {
  const core = ["id", "title", "description", "status", "priority", "assigned", "created"];
  if (mode === "internal") {
    return [...core, "due", "sb_status", "sb_owner"];
  }
  return [...core, "due", "risk"];
}

export function formatExportDate(value: string | null | undefined): string {
  const normalized = normalizeDateInput(value);
  if (!normalized) return "";
  const [y, m, d] = normalized.split("-");
  if (!y || !m || !d) return normalized;
  return `${d}/${m}/${y}`;
}

export function exportFileName(extension: "xlsx" | "csv"): string {
  const date = new Date().toISOString().slice(0, 10);
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
    `Showing ${visibleCount} of ${totalCount} issue${totalCount === 1 ? "" : "s"}`,
  ];

  if (filters.priority) parts.push(`Priority: ${filters.priority}`);
  if (filters.status) parts.push(`Status: ${filters.status}`);
  if (mode === "internal" && filters.sbStatus) {
    parts.push(`SB Status: ${filters.sbStatus}`);
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
    parts.push(`Sort: ${filters.sort}`);
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
