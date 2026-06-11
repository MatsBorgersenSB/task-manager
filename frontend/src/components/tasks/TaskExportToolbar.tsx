"use client";

import { useMemo, useState } from "react";
import type { Task, TaskFilters, TaskViewMode } from "@/lib/tasks/types";
import {
  buildFilterSummary,
  columnsForMode,
  defaultColumnIds,
  downloadCsv,
  EXPORT_COLUMNS,
} from "@/lib/tasks/export";
import { downloadExcel } from "@/lib/tasks/export-excel.client";
import { ui } from "@/lib/ui/classes";

type TaskExportToolbarProps = {
  mode: TaskViewMode;
  title: string;
  visibleTasks: Task[];
  totalCount: number;
  filters: TaskFilters;
  disabled?: boolean;
  onPrint: () => void;
};

export default function TaskExportToolbar({
  mode,
  title,
  visibleTasks,
  totalCount,
  filters,
  disabled = false,
  onPrint,
}: TaskExportToolbarProps) {
  const [exporting, setExporting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>(() =>
    defaultColumnIds(mode)
  );

  const availableColumns = useMemo(
    () => EXPORT_COLUMNS.filter((c) => c.modes.includes(mode)),
    [mode]
  );

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
      downloadExcel(visibleTasks, activeColumns);
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
