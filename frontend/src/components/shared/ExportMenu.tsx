"use client";

import { useEffect, useRef, useState } from "react";
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
import * as XLSX from "xlsx";

type ExportMenuProps = {
  mode: TaskViewMode;
  tasks: Task[];
  disabled?: boolean;
  onPrint?: () => void;
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
  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "binary" });
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

export default function ExportMenu({
  mode,
  tasks,
  disabled = false,
  onPrint,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>(() =>
    defaultColumnIds(mode)
  );
  const rootRef = useRef<HTMLDivElement>(null);

  const availableColumns = columnsForMode(mode);
  const activeColumns = columnsForMode(mode, selectedColumnIds);
  const noRows = tasks.length === 0;
  const noColumns = activeColumns.length === 0;
  const busy = exporting || disabled;

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setShowColumns(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleExcel() {
    setExporting(true);
    try {
      exportToExcel(tasks, activeColumns);
      setOpen(false);
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Excel export failed. Try again."
      );
    } finally {
      setExporting(false);
    }
  }

  function handleCsv() {
    setExporting(true);
    try {
      downloadCsv(tasks, activeColumns);
      setOpen(false);
    } finally {
      setExporting(false);
    }
  }

  function toggleColumn(id: string) {
    setSelectedColumnIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className={ui.btnSecondarySm}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Export
        <span aria-hidden className="text-muted">
          ▾
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-52 rounded-lg border border-border bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            disabled={busy || noRows || noColumns}
            onClick={() => void handleExcel()}
            className="flex w-full px-3 py-2 text-left text-sm text-primary hover:bg-slate-50 disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "Export Excel"}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy || noRows || noColumns}
            onClick={handleCsv}
            className="flex w-full px-3 py-2 text-left text-sm text-primary hover:bg-slate-50 disabled:opacity-50"
          >
            Export CSV
          </button>
          {onPrint ? (
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => {
                onPrint();
                setOpen(false);
              }}
              className="flex w-full px-3 py-2 text-left text-sm text-primary hover:bg-slate-50 disabled:opacity-50"
            >
              Print / PDF
            </button>
          ) : null}
          <div className="my-1 border-t border-border/60" />
          <button
            type="button"
            role="menuitem"
            onClick={() => setShowColumns((v) => !v)}
            className="flex w-full px-3 py-2 text-left text-sm text-muted hover:bg-slate-50"
          >
            Choose columns…
          </button>
        </div>
      ) : null}

      {showColumns && open ? (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-lg border border-border bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-medium text-muted">Export columns</p>
          <div className="max-h-48 space-y-1.5 overflow-y-auto">
            {availableColumns.map((col) => (
              <label
                key={col.id}
                className="flex items-center gap-2 text-sm text-primary/85"
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
