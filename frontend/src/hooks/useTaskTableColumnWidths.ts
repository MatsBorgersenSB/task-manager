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
  const [manualWidths, setManualWidths] = useState<Record<string, number>>({});
  const [resizingColumnId, setResizingColumnId] = useState<string | null>(null);

  const columnById = useMemo(
    () => new Map(columns.map((column) => [column.id, column])),
    [columns]
  );

  const frozenBaseRef = useRef<Record<string, number> | null>(null);
  const resolvedWidthsRef = useRef<Record<string, number>>({});

  const autoWidths = useMemo(
    () =>
      computeColumnWidths({
        columns,
        tasks,
        containerWidth,
        userWidths: {},
      }),
    [columns, containerWidth, tasks]
  );

  const resolvedWidths = useMemo(() => {
    const hasManual = Object.keys(manualWidths).length > 0;
    const hasFrozen = frozenBaseRef.current != null;

    if (!hasManual && !hasFrozen) {
      return autoWidths;
    }

    const base = frozenBaseRef.current ?? autoWidths;
    if (!hasManual) {
      return base;
    }

    return {
      ...base,
      ...manualWidths,
    };
  }, [autoWidths, manualWidths]);

  resolvedWidthsRef.current = resolvedWidths;

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
    setManualWidths({});
    frozenBaseRef.current = null;
    setResizingColumnId(null);
  }, [columns]);

  const tableMinWidth = useMemo(
    () => getTableMinWidth(resolvedWidths),
    [resolvedWidths]
  );

  const getWidth = useCallback(
    (columnId: string) => resolvedWidths[columnId] ?? DEFAULT_MIN,
    [resolvedWidths]
  );

  const freezeCurrentLayout = useCallback(() => {
    frozenBaseRef.current ??= { ...resolvedWidthsRef.current };
  }, []);

  const fitColumnToContent = useCallback(
    (columnId: string) => {
      const column = columnById.get(columnId);
      if (!column) return;

      freezeCurrentLayout();
      const measured = measureColumnContentWidth(column, tasks);
      setManualWidths((prev) => ({
        ...prev,
        [columnId]: measured,
      }));
    },
    [columnById, freezeCurrentLayout, tasks]
  );

  const startColumnResize = useCallback(
    (
      columnId: string,
      clientX: number,
      pointerId: number,
      captureTarget: HTMLElement
    ) => {
      const column = columnById.get(columnId);
      if (!column) return;

      freezeCurrentLayout();

      const startX = clientX;
      const startWidth =
        resolvedWidthsRef.current[columnId] ?? minColumnWidthPx(column);
      const minWidth = minColumnWidthPx(column);
      const maxWidth = maxColumnWidthPx(column);

      captureTarget.setPointerCapture(pointerId);
      setResizingColumnId(columnId);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      function handlePointerMove(event: PointerEvent) {
        if (event.pointerId !== pointerId) return;
        event.preventDefault();

        const nextWidth = clamp(
          startWidth + (event.clientX - startX),
          minWidth,
          maxWidth
        );
        setManualWidths((prev) => ({
          ...prev,
          [columnId]: nextWidth,
        }));
      }

      function finishResize(event: PointerEvent) {
        if (event.pointerId !== pointerId) return;

        captureTarget.removeEventListener("pointermove", handlePointerMove);
        captureTarget.removeEventListener("pointerup", finishResize);
        captureTarget.removeEventListener("pointercancel", finishResize);

        if (captureTarget.hasPointerCapture(pointerId)) {
          captureTarget.releasePointerCapture(pointerId);
        }

        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setResizingColumnId(null);
      }

      captureTarget.addEventListener("pointermove", handlePointerMove);
      captureTarget.addEventListener("pointerup", finishResize);
      captureTarget.addEventListener("pointercancel", finishResize);
    },
    [columnById, freezeCurrentLayout]
  );

  return {
    getWidth,
    tableMinWidth,
    resizingColumnId,
    fitColumnToContent,
    startColumnResize,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

const DEFAULT_MIN = 56;
