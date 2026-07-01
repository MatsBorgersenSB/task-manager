"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { TableColumnDef } from "@/lib/tasks/labels";
import type { Task } from "@/lib/tasks/types";
import {
  computeColumnWidths,
  getTableMinWidth,
  maxColumnWidthPx,
  measureColumnContentWidth,
  minColumnWidthPx,
} from "@/lib/tasks/tableColumnWidths";

type UseTaskTableColumnWidthsOptions = {
  columns: TableColumnDef[];
  tasks: Task[];
  containerRef: RefObject<HTMLElement | null>;
};

export function useTaskTableColumnWidths({
  columns,
  tasks,
  containerRef,
}: UseTaskTableColumnWidthsOptions) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [userWidths, setUserWidths] = useState<Record<string, number | undefined>>(
    {}
  );

  const columnById = useMemo(
    () => new Map(columns.map((column) => [column.id, column])),
    [columns]
  );

  const userWidthsRef = useRef(userWidths);
  userWidthsRef.current = userWidths;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => {
      setContainerWidth(element.clientWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    window.addEventListener("resize", updateWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, [containerRef]);

  useEffect(() => {
    setUserWidths((prev) => {
      const next: Record<string, number | undefined> = {};
      for (const column of columns) {
        if (column.id in prev) {
          next[column.id] = prev[column.id];
        }
      }
      return next;
    });
  }, [columns]);

  const resolvedWidths = useMemo(
    () =>
      computeColumnWidths({
        columns,
        tasks,
        containerWidth,
        userWidths,
      }),
    [columns, containerWidth, tasks, userWidths]
  );

  const resolvedWidthsRef = useRef(resolvedWidths);
  resolvedWidthsRef.current = resolvedWidths;

  const tableMinWidth = useMemo(
    () => getTableMinWidth(resolvedWidths),
    [resolvedWidths]
  );

  const tableWidth = useMemo(
    () => Math.max(containerWidth, tableMinWidth),
    [containerWidth, tableMinWidth]
  );

  const getWidth = useCallback(
    (columnId: string) => resolvedWidths[columnId] ?? DEFAULT_MIN,
    [resolvedWidths]
  );

  const fitColumnToContent = useCallback(
    (columnId: string) => {
      const column = columnById.get(columnId);
      if (!column) return;

      const measured = measureColumnContentWidth(column, tasks);
      setUserWidths((prev) => ({
        ...prev,
        [columnId]: measured,
      }));
    },
    [columnById, tasks]
  );

  const startColumnResize = useCallback(
    (columnId: string, clientX: number) => {
      const column = columnById.get(columnId);
      if (!column) return;

      const startX = clientX;
      const startWidth =
        userWidthsRef.current[columnId] ??
        resolvedWidthsRef.current[columnId] ??
        minColumnWidthPx(column);
      const minWidth = minColumnWidthPx(column);
      const maxWidth = maxColumnWidthPx(column);

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      function handleMouseMove(event: MouseEvent) {
        const nextWidth = clamp(
          startWidth + (event.clientX - startX),
          minWidth,
          maxWidth
        );
        setUserWidths((prev) => ({
          ...prev,
          [columnId]: nextWidth,
        }));
      }

      function handleMouseUp() {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [columnById]
  );

  return {
    getWidth,
    tableMinWidth,
    tableWidth,
    fitColumnToContent,
    startColumnResize,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

const DEFAULT_MIN = 56;
