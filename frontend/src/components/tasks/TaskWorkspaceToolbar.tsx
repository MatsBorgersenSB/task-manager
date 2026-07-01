"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import type { Task, TaskViewMode } from "@/lib/tasks/types";
import {
  columnsForMode,
  defaultColumnIds,
  downloadCsv,
  exportFileName,
  tasksToRows,
  type ExportColumnDef,
} from "@/lib/tasks/export";
import { ui } from "@/lib/ui/classes";

type TaskWorkspaceToolbarProps = {
  mode: TaskViewMode;
  visibleTasks: Task[];
  disabled?: boolean;
  focusMode?: boolean;
  isFullscreen?: boolean;
  onToggleFocus?: () => void;
  onToggleFullscreen?: () => void;
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
    ...rows.map((row) => columns.map((col) => row[col.label] ?? "")),
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

export default function TaskWorkspaceToolbar({
  mode,
  visibleTasks,
  disabled = false,
  focusMode = false,
  isFullscreen = false,
  onToggleFocus,
  onToggleFullscreen,
  onPrint,
  onClearFilters,
}: TaskWorkspaceToolbarProps) {
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
    <div className="no-print border-b border-border px-4 py-1.5 sm:px-5">
      <div className="flex flex-wrap items-center gap-1.5">
        {onToggleFocus ? (
          <button
            type="button"
            onClick={onToggleFocus}
            className={`${ui.btnSecondarySm}${
              focusMode ? " border-accent bg-accent/10 text-accent" : ""
            }`}
            aria-pressed={focusMode}
            title="Toggle focus mode (F)"
          >
            {focusMode ? "Exit Focus" : "Focus Tasks"}
          </button>
        ) : null}
        {onToggleFullscreen ? (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className={`${ui.btnSecondarySm}${
              isFullscreen ? " border-accent bg-accent/10 text-accent" : ""
            }`}
            aria-pressed={isFullscreen}
            title="Toggle fullscreen"
          >
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
        ) : null}
        {onClearFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className={ui.btnSecondarySm}
          >
            Clear Filters
          </button>
        ) : null}
        <span className="hidden h-4 w-px bg-border sm:inline" aria-hidden />
        <button
          type="button"
          disabled={busy || noRows || noColumns}
          onClick={() => void handleExcelExport()}
          className={ui.btnSecondarySm}
        >
          {exporting ? "Exporting…" : "Export Excel"}
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
          onClick={() => setShowColumns((value) => !value)}
          className={ui.btnGhost}
          aria-expanded={showColumns}
        >
          Columns
        </button>
      </div>

      {showColumns ? (
        <div className="mt-2 rounded-lg border border-border bg-background p-2.5">
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
