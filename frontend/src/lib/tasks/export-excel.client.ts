"use client";

import * as XLSX from "xlsx";
import {
  exportFileName,
  tasksToRows,
  type ExportColumnDef,
} from "@/lib/tasks/export";
import type { Task } from "@/lib/tasks/types";

function triggerBlobDownload(data: Uint8Array, filename: string) {
  const blob = new Blob([Uint8Array.from(data)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Export visible tasks to .xlsx (client-only — uses static xlsx bundle). */
export function downloadExcel(tasks: Task[], columns: ExportColumnDef[]): void {
  if (columns.length === 0) {
    throw new Error("Select at least one column to export.");
  }

  const rows = tasksToRows(tasks, columns);
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Tasks");

  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  }) as Uint8Array;

  triggerBlobDownload(buffer, exportFileName("xlsx"));
}
