"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import type { Task, TaskFilters, TaskViewMode } from "@/lib/tasks/types";
import {
  buildFilterSummary,
  columnsForMode,
  defaultColumnIds,
  downloadCsv,
  exportFileName,
  tasksToRows,
  type ExportColumnDef,
} from "@/lib/tasks/export";
import { ui } from "@/lib/ui/classes";

type TaskExportToolbarProps = {
  mode: TaskViewMode;
  title: string;
  visibleTasks: Task[];
  totalCount: number;
  filters: TaskFilters;
  disabled?: boolean;
  onPrint: () => void;
  onClearFilters?: () => void;
};

function s2ab(s: string) {
  const buf = new ArrayBuffer(s.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < s.length; i++) {
    view[i] = s.charCodeAt(i) & 0xff;
  }
  return buf;
}

function exportToExcel(tasks: Task[], columns: ExportColumnDef[]): void {
  if (columns.length === 0) {
    throw new Error("Select at least one column to export.");
  }

  const headers = columns.map((col) => col.label);
  const rows = tasksToRows(tasks, columns);

  const data = [
    headers,
    ...rows.map((row) =>
      columns.map((col) => row[col.label] ?? "")
    ),
  ];

  const sheet = XLSX.utils.aoa_to_sheet(data);

  sheet["!cols"] = columns.map((col) => ({
    wch: Math.min(Math.max(col.label.length + 2, 12), 48),
  }));

  if (sheet["!ref"]) {
    sheet["!autofilter"] = { ref: sheet["!ref"] };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Tasks");

  const wbout = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "binary",
  });

  const blob = new Blob([s2ab(wbout)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = exportFileName("xlsx");
  a.click();

  URL.revokeObjectURL(url);
}

export default function TaskExportToolbar({
  mode,
  title,
  visibleTasks,
  totalCount,
  filters,
  disabled = false,
  onPrint,
  onClearFilters,
}: TaskExportToolbarProps) {
  const [exporting, setExporting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>(() =>
    defaultColumnIds(mode)
  );

  const availableColumns = useMemo(() => columnsForMode(mode), [mode]);

  const activeColumns = useMemo(
    () => columnsForMode(mode, selectedColumnIds),
    [mode, selectedColumnIds]
  );

  const filterSummary = buildFilterSummary(
    filters,
    visibleTasks.length,
    totalCount,
    mode
  );

  const busy = exporting || exportingCsv || disabled;
  const noRows = visibleTasks.length === 0;
  const noColumns = activeColumns.length === 0;

  async function handleExcelExport() {
    setExporting(true);
    try {
      exportToExcel(visibleTasks, activeColumns);
    } catch (err) {
      console.error("Excel export failed:", err);
      window.alert(
        err instanceof Error ? err.message : "Excel export failed. Try again."
      );
    } finally {
      setExporting(false);
    }
  }

  function handleCsvExport() {
    setExportingCsv(true);
    try {
      downloadCsv(visibleTasks, activeColumns);
    } finally {
      setExportingCsv(false);
    }
  }

  function toggleColumn(id: string) {
    setSelectedColumnIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="no-print border-b border-border px-4 py-3 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">{title}</p>
          <p className="text-xs text-muted">{filterSummary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onClearFilters ? (
            <button
              type="button"
              onClick={onClearFilters}
              className={ui.btnSecondarySm}
            >
              Clear filters
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy || noRows || noColumns}
            onClick={() => void handleExcelExport()}
            className={ui.btnPrimarySm}
          >
            {exporting ? "Exporting…" : "Export to Excel"}
          </button>
          <button
            type="button"
            disabled={busy || noRows || noColumns}
            onClick={handleCsvExport}
            className={ui.btnSecondarySm}
          >
            {exportingCsv ? "Exporting…" : "Export CSV"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onPrint}
            className={ui.btnSecondarySm}
          >
            Print
          </button>
          <button
            type="button"
            onClick={() => setShowColumns((v) => !v)}
            className={ui.btnGhost}
          >
            Columns
          </button>
        </div>
      </div>

      {showColumns ? (
        <div className="mt-3 rounded-lg border border-border bg-background p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Export columns
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {availableColumns.map((col) => (
              <label
                key={col.id}
                className="flex items-center gap-2 text-sm text-primary/80"
              >
                <input
                  type="checkbox"
                  checked={selectedColumnIds.includes(col.id)}
                  onChange={() => toggleColumn(col.id)}
                  className="rounded border-border text-accent focus:ring-accent/20"
                />
                {col.label}
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
