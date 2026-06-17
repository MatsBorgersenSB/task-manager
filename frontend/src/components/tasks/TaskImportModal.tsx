"use client";

import { useCallback, useRef, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  analyzeImportRows,
  getImportTaskIssues,
  importTasksFromRows,
  isImportTaskValid,
  parseImportFile,
  previewImportTasks,
  type ImportAnalysis,
  type ImportColumnMapping,
  type ImportInvalidEntry,
  type ImportSummary,
  type MappedImportTask,
  type ParsedImportRow,
} from "@/lib/tasks/taskImport";
import type { Task } from "@/lib/tasks/types";
import { ui } from "@/lib/ui/classes";

type TaskImportModalProps = {
  open: boolean;
  onClose: () => void;
  onImported: (created: Task[]) => void;
};

type ModalPhase = "upload" | "preview" | "summary";

const ACCEPTED_TYPES = ".csv,.xlsx,.xls";

export default function TaskImportModal({
  open,
  onClose,
  onImported,
}: TaskImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<ModalPhase>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [previewTasks, setPreviewTasks] = useState<MappedImportTask[]>([]);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [columnMappings, setColumnMappings] = useState<ImportColumnMapping[]>(
    []
  );
  const [invalidEntries, setInvalidEntries] = useState<ImportInvalidEntry[]>(
    []
  );
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const validCount = analysis?.valid.length ?? 0;
  const invalidCount = analysis?.invalid.length ?? 0;
  const duplicateCount = analysis?.duplicateCount ?? 0;

  const resetState = useCallback(() => {
    setPhase("upload");
    setFileName(null);
    setRows([]);
    setPreviewTasks([]);
    setAnalysis(null);
    setColumnMappings([]);
    setInvalidEntries([]);
    setParsing(false);
    setImporting(false);
    setImportProgress({ done: 0, total: 0 });
    setConfirmOpen(false);
    setError(null);
    setSummary(null);
    setDragActive(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleClose = useCallback(() => {
    if (importing) return;
    resetState();
    onClose();
  }, [importing, onClose, resetState]);

  const analyzeRows = useCallback(
    (parsedRows: ParsedImportRow[], name: string) => {
      const result = analyzeImportRows(parsedRows);

      setFileName(name);
      setRows(parsedRows);
      setPreviewTasks(previewImportTasks(parsedRows));
      setAnalysis(result);
      setColumnMappings(result.columnMappings);
      setInvalidEntries(result.invalid);
      setPhase("preview");
      setError(null);
    },
    []
  );

  const processFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;

      setParsing(true);
      setError(null);
      setSummary(null);

      try {
        const parsedRows = await parseImportFile(file);
        analyzeRows(parsedRows, file.name);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse file.");
        setPhase("upload");
      } finally {
        setParsing(false);
      }
    },
    [analyzeRows]
  );

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      void processFile(file);
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      const file = event.dataTransfer.files?.[0];
      void processFile(file);
    },
    [processFile]
  );

  const runImport = useCallback(async () => {
    if (rows.length === 0 || validCount === 0) return;

    setConfirmOpen(false);
    setImporting(true);
    setImportProgress({ done: 0, total: validCount });
    setError(null);

    try {
      const result = await importTasksFromRows(rows, (completed, total) => {
        setImportProgress({ done: completed, total });
      });
      setSummary(result);
      setPhase("summary");
      if (result.created.length > 0) {
        onImported(result.created);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }, [onImported, rows, validCount]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-import-modal-title"
      >
        <button
          type="button"
          className="absolute inset-0 bg-primary/60 backdrop-blur-sm transition-opacity"
          aria-label="Close dialog"
          onClick={handleClose}
          disabled={importing}
        />
        <div
          className={`relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden transition-all ${ui.card}`}
        >
          <div className="border-b border-border px-6 py-4">
            <h3 id="task-import-modal-title" className={ui.sectionTitle}>
              Import CSV / Excel
            </h3>
            <p className="mt-1 text-sm text-muted">
              Upload a spreadsheet to create tasks in Internal View. Columns are
              matched flexibly and data is normalized before import.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {phase === "upload" ? (
              <div className="space-y-4">
                <div
                  onDrop={handleDrop}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  className={`rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors duration-150 ${
                    dragActive
                      ? "border-accent bg-accent/5"
                      : "border-border bg-background/60"
                  }`}
                >
                  <p className="text-sm font-medium text-primary">
                    Drop a .csv or .xlsx file here
                  </p>
                  <p className="mt-1 text-sm text-muted">or choose a file below</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES}
                    onChange={handleFileUpload}
                    className="mt-4 block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-accent-dark"
                  />
                </div>

                <div className="rounded-lg border border-border bg-background/60 p-4 text-sm text-muted">
                  <p className="font-medium text-primary">Supported columns</p>
                  <p className="mt-2">
                    Task / Title / Name, Priority, Client Status / Status,
                    Responsible, SB Owners, Due Date / Deadline, Link / URL
                  </p>
                </div>

                {parsing ? <LoadingSpinner label="Parsing file…" /> : null}
              </div>
            ) : null}

            {phase === "preview" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium text-primary">{fileName}</span>
                  <span className="text-muted">{rows.length} rows total</span>
                  <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {validCount} valid
                  </span>
                  {invalidCount > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                      {invalidCount} invalid
                    </span>
                  ) : null}
                  {duplicateCount > 0 ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      {duplicateCount} duplicates removed
                    </span>
                  ) : null}
                </div>

                {columnMappings.length > 0 ? (
                  <div className="rounded-lg border border-border bg-background/60 p-4">
                    <p className="text-sm font-medium text-primary">
                      Detected column mappings
                    </p>
                    <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                      {columnMappings.map((mapping) => (
                        <li
                          key={mapping.field}
                          className={
                            mapping.matchedHeader
                              ? "text-primary"
                              : "text-muted"
                          }
                        >
                          <span className="font-medium">{mapping.label}:</span>{" "}
                          {mapping.matchedHeader ?? "not found"}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[48rem] text-sm">
                    <thead className="bg-primary text-primary-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase">
                          Row
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase">
                          Task
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase">
                          Priority
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase">
                          Status
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase">
                          Responsible
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase">
                          SB Owners
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase">
                          Due Date
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase">
                          Links
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewTasks.map((task) => {
                        const issues = getImportTaskIssues(task);
                        const valid = isImportTaskValid(task);
                        return (
                          <tr
                            key={task._sourceRow}
                            className={`border-b border-slate-200 transition-colors duration-150 last:border-b-0 ${
                              valid
                                ? issues.length > 0
                                  ? "bg-amber-50/70"
                                  : ""
                                : "bg-amber-50"
                            }`}
                          >
                            <td className="px-3 py-2 text-muted">
                              {task._sourceRow}
                            </td>
                            <td
                              className={`px-3 py-2 ${
                                valid
                                  ? "text-primary"
                                  : "font-medium text-amber-800"
                              }`}
                            >
                              {(task.Issue ?? "").trim() || "— missing —"}
                            </td>
                            <td className="px-3 py-2">{task.Priority ?? "—"}</td>
                            <td className="px-3 py-2">{task.status ?? "—"}</td>
                            <td className="px-3 py-2">
                              {task.Responsible || "—"}
                            </td>
                            <td className="px-3 py-2">
                              {task["SB Owner"] || "—"}
                            </td>
                            <td className="px-3 py-2">
                              {task["Date Due"] || "—"}
                            </td>
                            <td className="px-3 py-2">
                              {task.links?.length ? task.links.length : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {rows.length > previewTasks.length ? (
                  <p className="text-xs text-muted">
                    Showing first {previewTasks.length} of {rows.length} rows.
                  </p>
                ) : null}

                {invalidEntries.length > 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-medium">Rows with issues</p>
                    <ul className="mt-2 space-y-1">
                      {invalidEntries.slice(0, 8).map((entry) => (
                        <li key={entry.sourceRow}>
                          Row {entry.sourceRow} → {entry.reason}
                        </li>
                      ))}
                      {invalidEntries.length > 8 ? (
                        <li>…and {invalidEntries.length - 8} more</li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}

                {importing ? (
                  <div className="space-y-2">
                    <LoadingSpinner label="Importing tasks…" />
                    {importProgress.total > 0 ? (
                      <p className="text-center text-sm text-muted">
                        {importProgress.done} of {importProgress.total} processed
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {phase === "summary" && summary ? (
              <div className="space-y-4">
                <div className={`${ui.alertSuccess} space-y-2`}>
                  <p>✅ {summary.success} tasks imported</p>
                  <p>⚠️ {summary.skipped} skipped (missing title)</p>
                  <p>❌ {summary.failed} failed</p>
                </div>

                {summary.rowErrors.length > 0 ? (
                  <div className="rounded-lg border border-border bg-background/60 p-4">
                    <p className="text-sm font-medium text-primary">
                      Row-level details
                    </p>
                    <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm text-muted">
                      {summary.rowErrors.map((entry) => (
                        <li key={`${entry.sourceRow}-${entry.reason}`}>
                          Row {entry.sourceRow} → {entry.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {summary.success > 0 ? (
                  <p className="text-sm text-muted">
                    Imported tasks are now visible in the table.
                  </p>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <p className="mt-4 text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-border px-6 py-4">
            {phase === "preview" ? (
              <button
                type="button"
                disabled={importing}
                onClick={resetState}
                className={ui.btnSecondary}
              >
                Re-upload
              </button>
            ) : null}

            {phase === "summary" ? (
              <button
                type="button"
                onClick={resetState}
                className={ui.btnSecondary}
              >
                Upload another file
              </button>
            ) : null}

            <button
              type="button"
              disabled={importing}
              onClick={handleClose}
              className={ui.btnSecondary}
            >
              {phase === "summary" ? "Close" : "Cancel"}
            </button>

            {phase === "preview" ? (
              <button
                type="button"
                disabled={importing || validCount === 0}
                onClick={() => setConfirmOpen(true)}
                className={ui.btnPrimary}
              >
                Import {validCount} task{validCount === 1 ? "" : "s"}
              </button>
            ) : null}

            {phase === "summary" && summary && summary.success > 0 ? (
              <button
                type="button"
                onClick={handleClose}
                className={ui.btnPrimary}
              >
                Done
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm import"
        description={`Import ${validCount} task${validCount === 1 ? "" : "s"}? Rows missing a title will be skipped.`}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        loading={importing}
        layerClassName="z-[60]"
        onConfirm={() => void runImport()}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
