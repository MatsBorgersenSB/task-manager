"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { TableColumnDef } from "@/lib/tasks/labels";
import {
  addressesEqual,
  isTableCellEditable,
  moveTableCellSelection,
  type TableCellAddress,
} from "@/lib/tasks/tableCellNavigation";
import type { Task } from "@/lib/tasks/types";
import { isEditableTarget } from "@/lib/tasks/taskFocusMode";

type UseTableCellNavigationOptions = {
  tasks: Task[];
  columns: TableColumnDef[];
  enabled: boolean;
  canEditTasks: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onOpenTask?: (task: Task) => void;
};

export function useTableCellNavigation({
  tasks,
  columns,
  enabled,
  canEditTasks,
  containerRef,
  onOpenTask,
}: UseTableCellNavigationOptions) {
  const [activeCell, setActiveCell] = useState<TableCellAddress | null>(null);
  const [editingCell, setEditingCell] = useState<TableCellAddress | null>(null);
  const activeCellRef = useRef<TableCellAddress | null>(null);
  const editingCellRef = useRef<TableCellAddress | null>(null);

  activeCellRef.current = activeCell;
  editingCellRef.current = editingCell;

  const clearSelection = useCallback(() => {
    setActiveCell(null);
    setEditingCell(null);
  }, []);

  const focusContainer = useCallback(() => {
    containerRef.current?.focus({ preventScroll: true });
  }, [containerRef]);

  const scrollCellIntoView = useCallback(
    (address: TableCellAddress) => {
      const container = containerRef.current;
      if (!container) return;

      const selector = `[data-cell-task="${address.taskUuid}"][data-cell-column="${address.columnId}"]`;
      const cell = container.querySelector<HTMLElement>(selector);
      cell?.scrollIntoView({ block: "nearest", inline: "nearest" });
    },
    [containerRef]
  );

  const selectCell = useCallback(
    (address: TableCellAddress, options?: { focus?: boolean; scroll?: boolean }) => {
      setActiveCell(address);
      setEditingCell(null);
      if (options?.scroll !== false) {
        scrollCellIntoView(address);
      }
      if (options?.focus !== false) {
        focusContainer();
      }
    },
    [focusContainer, scrollCellIntoView]
  );

  const startEditing = useCallback(
    (address: TableCellAddress) => {
      if (!isTableCellEditable(address.columnId, canEditTasks)) return;
      setActiveCell(address);
      setEditingCell(address);
      focusContainer();
    },
    [canEditTasks, focusContainer]
  );

  const stopEditing = useCallback(() => {
    setEditingCell(null);
    focusContainer();
  }, [focusContainer]);

  const moveSelection = useCallback(
    (direction: Parameters<typeof moveTableCellSelection>[3]) => {
      const current = activeCellRef.current;
      if (!current) return;

      const next = moveTableCellSelection(current, tasks, columns, direction);
      if (!next || addressesEqual(current, next)) return;

      selectCell(next);
    },
    [columns, selectCell, tasks]
  );

  const handleCellClick = useCallback(
    (address: TableCellAddress, task: Task, event: React.MouseEvent) => {
      event.stopPropagation();
      selectCell(address, { scroll: false, focus: false });
      onOpenTask?.(task);
    },
    [onOpenTask, selectCell]
  );

  const handleCellDoubleClick = useCallback(
    (address: TableCellAddress, task: Task, event: React.MouseEvent) => {
      event.stopPropagation();
      selectCell(address, { scroll: false });
      if (isTableCellEditable(address.columnId, canEditTasks)) {
        startEditing(address);
        return;
      }
      onOpenTask?.(task);
    },
    [canEditTasks, onOpenTask, selectCell, startEditing]
  );

  const isCellSelected = useCallback(
    (taskUuid: string, columnId: string) =>
      activeCell?.taskUuid === taskUuid && activeCell.columnId === columnId,
    [activeCell]
  );

  const isCellEditing = useCallback(
    (taskUuid: string, columnId: string) =>
      editingCell?.taskUuid === taskUuid && editingCell.columnId === columnId,
    [editingCell]
  );

  const handleCommitNavigate = useCallback(
    (shiftKey: boolean) => {
      stopEditing();
      moveSelection(shiftKey ? "shift-tab" : "tab");
    },
    [moveSelection, stopEditing]
  );

  useEffect(() => {
    if (!enabled) {
      clearSelection();
    }
  }, [clearSelection, enabled]);

  useEffect(() => {
    const current = activeCellRef.current;
    if (!current) return;

    const rowExists = tasks.some((task) => task._uuid === current.taskUuid);
    const colExists = columns.some((column) => column.id === current.columnId);
    if (!rowExists || !colExists) {
      clearSelection();
    }
  }, [clearSelection, columns, tasks]);

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;

      const container = containerRef.current;
      if (!container || !container.contains(document.activeElement)) return;

      const current = activeCellRef.current;
      if (!current) return;

      if (editingCellRef.current) return;

      switch (event.key) {
        case "Enter": {
          if (isTableCellEditable(current.columnId, canEditTasks)) {
            event.preventDefault();
            startEditing(current);
          }
          break;
        }
        case "Tab": {
          event.preventDefault();
          moveSelection(event.shiftKey ? "shift-tab" : "tab");
          break;
        }
        case "ArrowUp": {
          event.preventDefault();
          moveSelection("up");
          break;
        }
        case "ArrowDown": {
          event.preventDefault();
          moveSelection("down");
          break;
        }
        case "ArrowLeft": {
          event.preventDefault();
          moveSelection("left");
          break;
        }
        case "ArrowRight": {
          event.preventDefault();
          moveSelection("right");
          break;
        }
        case "Escape": {
          event.preventDefault();
          clearSelection();
          break;
        }
        default:
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    canEditTasks,
    clearSelection,
    containerRef,
    enabled,
    moveSelection,
    startEditing,
  ]);

  return {
    activeCell,
    clearSelection,
    handleCellClick,
    handleCellDoubleClick,
    handleCommitNavigate,
    isCellEditing,
    isCellSelected,
    startEditing,
    stopEditing,
  };
}
