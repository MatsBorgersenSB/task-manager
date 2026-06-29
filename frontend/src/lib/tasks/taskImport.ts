import * as XLSX from "xlsx";
import Papa from "papaparse";
import { createTask } from "@/lib/tasks/api";
import { taskDateValue } from "@/lib/tasks/taskDates";
import {
  createTaskLinkId,
  extractFileName,
  inferLinkType,
} from "@/lib/tasks/taskLinks";
import type { Task, TaskLink, TaskPayload } from "@/lib/tasks/types";

export type ParsedImportRow = Record<string, string>;

export type MappedImportTask = TaskPayload & {
  /** Source row number (1-based, excluding header). */
  _sourceRow: number;
  _warnings?: string[];
};

export type ImportInvalidEntry = {
  index: number;
  sourceRow: number;
  reason: string;
  task: MappedImportTask;
};

export type ImportColumnMapping = {
  field: string;
  label: string;
  matchedHeader: string | null;
};

export type ImportAnalysis = {
  mapped: MappedImportTask[];
  deduped: MappedImportTask[];
  valid: MappedImportTask[];
  invalid: ImportInvalidEntry[];
  duplicateCount: number;
  columnMappings: ImportColumnMapping[];
};

export type ImportRowError = {
  sourceRow: number;
  reason: string;
};

export type ImportSummary = {
  success: number;
  failed: number;
  skipped: number;
  created: Task[];
  rowErrors: ImportRowError[];
};

const PREVIEW_ROW_LIMIT = 15;
const IMPORT_CONCURRENCY = 5;

export const IMPORT_PREVIEW_LIMIT = PREVIEW_ROW_LIMIT;

const IMPORT_FIELD_ALIASES: Record<string, { label: string; keys: string[] }> = {
  Issue: {
    label: "Task",
    keys: ["title", "task", "name", "issue"],
  },
  Priority: {
    label: "Priority",
    keys: ["priority", "prio"],
  },
  status: {
    label: "Client Status",
    keys: ["client status", "status", "client_status"],
  },
  Responsible: {
    label: "Responsible",
    keys: ["responsible", "owner", "assigned"],
  },
  "SB Owner": {
    label: "SB Owners",
    keys: ["sb owners", "sb owner", "owners", "sb_owners"],
  },
  "Date Due": {
    label: "Due Date",
    keys: ["due date", "deadline", "date due", "due"],
  },
  links: {
    label: "Link / URL",
    keys: ["link", "url"],
  },
};

function trimString(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

/** Normalize parsed row values — trim strings, drop empty cells. */
export function normalizeImportRow(
  row: Record<string, unknown>
): ParsedImportRow {
  const normalized: ParsedImportRow = {};
  for (const [key, value] of Object.entries(row)) {
    const trimmed = trimString(value);
    if (trimmed != null) {
      normalized[key] = trimmed;
    }
  }
  return normalized;
}

/** Case-insensitive column lookup with alias support. */
export function getImportValue(
  row: ParsedImportRow,
  keys: string[]
): string | null {
  const rowKeys = Object.keys(row);
  for (const alias of keys) {
    const target = alias.toLowerCase().trim();
    const found = rowKeys.find((key) => key.toLowerCase().trim() === target);
    if (found && row[found]) {
      return row[found].toString().trim();
    }
  }
  return null;
}

/** Parse spreadsheet dates to YYYY-MM-DD for task fields. */
export function parseImportDate(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const parsed = taskDateValue(value);
  if (parsed) return parsed;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
}

/** Normalize SB owner lists for consistent storage and filtering. */
export function normalizeImportOwners(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .split(",")
    .map((owner) => owner.trim().toLowerCase())
    .filter(Boolean)
    .join(", ");
}

/** Auto-detect a link column from import rows. */
export function detectImportLinks(row: ParsedImportRow): TaskLink[] {
  const url = getImportValue(row, ["link", "url"]);
  if (!url || !url.includes("http")) return [];

  return [
    {
      id: createTaskLinkId(),
      name: extractFileName(url),
      url,
      type: inferLinkType(url),
    },
  ];
}

export function detectColumnMappings(
  sampleRow: ParsedImportRow
): ImportColumnMapping[] {
  const rowKeys = Object.keys(sampleRow);

  return Object.entries(IMPORT_FIELD_ALIASES).map(([field, config]) => {
    let matchedHeader: string | null = null;
    for (const alias of config.keys) {
      const target = alias.toLowerCase().trim();
      const found = rowKeys.find((key) => key.toLowerCase().trim() === target);
      if (found) {
        matchedHeader = found;
        break;
      }
    }

    return {
      field,
      label: config.label,
      matchedHeader,
    };
  });
}

export function mapRowToTask(
  row: ParsedImportRow,
  sourceRow: number
): MappedImportTask {
  const dueRaw = getImportValue(row, [
    "due date",
    "deadline",
    "date due",
    "due",
  ]);
  const dueDate = parseImportDate(dueRaw);
  const warnings: string[] = [];

  if (dueRaw && !dueDate) {
    warnings.push("Invalid date");
  }

  return {
    Issue: getImportValue(row, ["title", "task", "name", "issue"]) ?? "",
    status:
      getImportValue(row, ["client status", "status", "client_status"]) ??
      "Pending",
    Priority: getImportValue(row, ["priority", "prio"]) ?? "Medium",
    Responsible:
      getImportValue(row, ["responsible", "owner", "assigned"]) ?? "",
    "SB Owner": normalizeImportOwners(
      getImportValue(row, ["sb owners", "sb owner", "owners", "sb_owners"])
    ),
    "Date Due": dueDate,
    links: detectImportLinks(row),
    _sourceRow: sourceRow,
    _warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function validateImportTasks(tasks: MappedImportTask[]): {
  valid: MappedImportTask[];
  invalid: ImportInvalidEntry[];
} {
  const valid: MappedImportTask[] = [];
  const invalid: ImportInvalidEntry[] = [];

  tasks.forEach((task, index) => {
    if (!(task.Issue ?? "").trim()) {
      invalid.push({
        index,
        sourceRow: task._sourceRow,
        reason: "Missing title",
        task,
      });
    } else {
      valid.push(task);
    }
  });

  return { valid, invalid };
}

export function removeDuplicateImportTasks(
  tasks: MappedImportTask[]
): MappedImportTask[] {
  const seen = new Set<string>();

  return tasks.filter((task) => {
    const key = `${(task.Issue ?? "").trim().toLowerCase()}|${task["Date Due"] ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mapRowsToImportTasks(
  rows: ParsedImportRow[]
): MappedImportTask[] {
  return rows.map((row, index) => mapRowToTask(row, index + 1));
}

export function analyzeImportRows(rows: ParsedImportRow[]): ImportAnalysis {
  const mapped = mapRowsToImportTasks(rows);
  const deduped = removeDuplicateImportTasks(mapped);
  const { valid, invalid } = validateImportTasks(deduped);

  return {
    mapped,
    deduped,
    valid,
    invalid,
    duplicateCount: mapped.length - deduped.length,
    columnMappings:
      rows.length > 0 ? detectColumnMappings(rows[0]) : [],
  };
}

export async function parseImportFile(file: File): Promise<ParsedImportRow[]> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv")) {
    return parseCsvFile(file);
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return parseExcelFile(file);
  }

  throw new Error("Unsupported file type. Upload a .csv or .xlsx file.");
}

function parseCsvFile(file: File): Promise<ParsedImportRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (result) => {
        if (result.errors.length > 0) {
          const message = result.errors[0]?.message ?? "Failed to parse CSV.";
          reject(new Error(message));
          return;
        }

        const rows = (result.data ?? [])
          .map(normalizeImportRow)
          .filter((row) => Object.keys(row).length > 0);

        if (rows.length === 0) {
          reject(new Error("The CSV file has no data rows."));
          return;
        }

        resolve(rows);
      },
      error: (error) => {
        reject(new Error(error.message || "Failed to read CSV file."));
      },
    });
  });
}

function parseExcelFile(file: File): Promise<ParsedImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const buffer = event.target?.result;
        if (!buffer) {
          reject(new Error("Failed to read Excel file."));
          return;
        }

        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          reject(new Error("The Excel file has no worksheets."));
          return;
        }

        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
        });

        const rows = json
          .map(normalizeImportRow)
          .filter((row) => Object.keys(row).length > 0);

        if (rows.length === 0) {
          reject(new Error("The Excel file has no data rows."));
          return;
        }

        resolve(rows);
      } catch {
        reject(new Error("Failed to parse Excel file."));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read Excel file."));
    };

    reader.readAsArrayBuffer(file);
  });
}

function toTaskPayload(task: MappedImportTask): TaskPayload {
  const { _sourceRow: _row, _warnings: _warnings, ...payload } = task;
  return payload;
}

function collectWarningErrors(tasks: MappedImportTask[]): ImportRowError[] {
  const errors: ImportRowError[] = [];

  for (const task of tasks) {
    for (const warning of task._warnings ?? []) {
      errors.push({
        sourceRow: task._sourceRow,
        reason: warning,
      });
    }
  }

  return errors;
}

export async function importValidTasks(
  tasks: MappedImportTask[],
  projectId: string,
  onProgress?: (completed: number, total: number) => void
): Promise<Pick<ImportSummary, "success" | "failed" | "created" | "rowErrors">> {
  let index = 0;
  let success = 0;
  let failed = 0;
  const created: Task[] = [];
  const rowErrors: ImportRowError[] = [];
  const total = tasks.length;

  async function worker() {
    while (true) {
      const current = index++;
      if (current >= total) break;

      const task = tasks[current];
      try {
        const createdTask = await createTask("internal", {
          ...toTaskPayload(task),
          project_id: projectId,
        });
        created.push(createdTask);
        success++;
      } catch {
        failed++;
        rowErrors.push({
          sourceRow: task._sourceRow,
          reason: "Import failed",
        });
      }

      onProgress?.(success + failed, total);
    }
  }

  await Promise.all(
    Array.from({ length: IMPORT_CONCURRENCY }, () => worker())
  );

  return { success, failed, created, rowErrors };
}

export async function importTasksFromRows(
  rows: ParsedImportRow[],
  projectId: string,
  onProgress?: (completed: number, total: number) => void
): Promise<ImportSummary> {
  const analysis = analyzeImportRows(rows);
  const importResult = await importValidTasks(analysis.valid, projectId, onProgress);

  const rowErrors: ImportRowError[] = [
    ...analysis.invalid.map((entry) => ({
      sourceRow: entry.sourceRow,
      reason: entry.reason,
    })),
    ...collectWarningErrors(analysis.valid),
    ...importResult.rowErrors,
  ].sort((left, right) => left.sourceRow - right.sourceRow);

  return {
    success: importResult.success,
    failed: importResult.failed,
    skipped: analysis.invalid.length,
    created: importResult.created,
    rowErrors,
  };
}

export function previewImportTasks(rows: ParsedImportRow[]): MappedImportTask[] {
  return mapRowsToImportTasks(rows).slice(0, PREVIEW_ROW_LIMIT);
}

export function isImportTaskValid(task: MappedImportTask): boolean {
  return Boolean((task.Issue ?? "").trim());
}

export function getImportTaskIssues(task: MappedImportTask): string[] {
  const issues: string[] = [];
  if (!(task.Issue ?? "").trim()) {
    issues.push("Missing title");
  }
  for (const warning of task._warnings ?? []) {
    issues.push(warning);
  }
  return issues;
}
