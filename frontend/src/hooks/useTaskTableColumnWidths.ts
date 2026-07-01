"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TableColumnDef } from "@/lib/tasks/labels";
import {
  buildDefaultWidthMap,
  loadStoredColumnWidths,
  maxColumnWidthPx,
  minColumnWidthPx,
  saveStoredColumnWidths,
} from "@/lib/tasks/tableColumnWidths";

type UseTaskTableColumnWidthsOptions = {
  columns: TableColumnDef[];
  storageKey: string;
};

export function useTaskTableColumnWidths({
  columns,
  storageKey,
}: UseTaskTableColumnWidthsOptions) {
  const defaults = useMemo(() => buildDefaultWidthMap(columns), [columns]);
  const columnById = useMemo(
    () => new Map(columns.map((column) => [column.id, column])),
    [columns]
  );

  const [widths, setWidths] = useState<Record<string, number>>(() =>
    loadStoredColumnWidths(storageKey, defaults)
  );

  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  useEffect(() => {
    setWidths(loadStoredColumnWidths(storageKey, defaults));
  }, [storageKey, defaults]);

  const getWidth = useCallback(
    (columnId: string) => widths[columnId] ?? defaults[columnId] ?? 120,
    [defaults, widths]
  );

  const tableMinWidth = useMemo(() => {
    const selectColumnWidth = 40;
    return (
      selectColumnWidth +
      columns.reduce((sum, column) => sum + getWidth(column.id), 0)
    );
  }, [columns, getWidth]);

  const resetColumnWidth = useCallback(
    (columnId: string) => {
      const next = {
        ...widthsRef.current,
        [columnId]: defaults[columnId],
      };
      setWidths(next);
      saveStoredColumnWidths(storageKey, next);
    },
    [defaults, storageKey]
  );

  const startColumnResize = useCallback(
    (columnId: string, clientX: number) => {
      const column = columnById.get(columnId);
      if (!column) return;

      const startX = clientX;
      const startWidth = widthsRef.current[columnId] ?? defaults[columnId];
      const minWidth = minColumnWidthPx(column);
      const maxWidth = maxColumnWidthPx(column);

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      function handleMouseMove(event: MouseEvent) {
        const nextWidth = Math.min(
          maxWidth,
          Math.max(minWidth, startWidth + (event.clientX - startX))
        );
        setWidths((prev) => ({
          ...prev,
          [columnId]: nextWidth,
        }));
      }

      function handleMouseUp() {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        saveStoredColumnWidths(storageKey, widthsRef.current);
      }

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [columnById, defaults, storageKey]
  );

  return {
    getWidth,
    tableMinWidth,
    resetColumnWidth,
    startColumnResize,
  };
}
