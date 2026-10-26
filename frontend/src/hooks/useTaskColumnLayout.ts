"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyColumnPreset,
  defaultColumnLayout,
  moveColumnInOrder,
  orderTableColumns,
  persistColumnLayout,
  readColumnLayout,
  resolveVisibleColumnsAndGroupSegments,
  type TableColumnLayoutState,
  type TableColumnPresetId,
} from "@/lib/tasks/columnLayout";
import { getTableColumns } from "@/lib/tasks/labels";
import {
  persistShowClientColumns,
  persistShowOptionalColumns,
  readShowClientColumns,
  readShowOptionalColumns,
} from "@/lib/tasks/tableColumnOptions";
import type { TaskViewMode } from "@/lib/tasks/types";

export function useTaskColumnLayout(mode: TaskViewMode) {
  const [showOptionalColumns, setShowOptionalColumns] = useState(false);
  const [showClientColumns, setShowClientColumns] = useState(false);
  const [columnLayout, setColumnLayout] = useState<TableColumnLayoutState>(() =>
    defaultColumnLayout(mode)
  );

  useEffect(() => {
    setShowOptionalColumns(readShowOptionalColumns());
    setShowClientColumns(readShowClientColumns());
    setColumnLayout(readColumnLayout(mode));
  }, [mode]);

  const availableTableColumns = useMemo(
    () => getTableColumns(mode, { showOptionalColumns, showClientColumns }),
    [mode, showOptionalColumns, showClientColumns]
  );

  const orderedTableColumns = useMemo(
    () => orderTableColumns(availableTableColumns, columnLayout.columnOrder),
    [availableTableColumns, columnLayout.columnOrder]
  );

  const {
    visibleColumns: tableColumns,
    segments: columnGroupSegments,
  } = useMemo(
    () =>
      resolveVisibleColumnsAndGroupSegments(
        orderedTableColumns,
        columnLayout.groups
      ),
    [orderedTableColumns, columnLayout.groups]
  );

  const handleMoveColumn = useCallback(
    (
      sourceColumnId: string,
      targetColumnId: string,
      position: "before" | "after"
    ) => {
      setColumnLayout((prev) => {
        const nextOrder = moveColumnInOrder(
          orderedTableColumns,
          sourceColumnId,
          targetColumnId,
          position
        );
        const next: TableColumnLayoutState = {
          ...prev,
          columnOrder: nextOrder,
        };
        persistColumnLayout(mode, next);
        return next;
      });
    },
    [mode, orderedTableColumns]
  );

  const handleToggleColumnGroup = useCallback(
    (groupId: string) => {
      setColumnLayout((prev) => {
        const next: TableColumnLayoutState = {
          ...prev,
          groups: prev.groups.map((g) =>
            g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
          ),
        };
        persistColumnLayout(mode, next);
        return next;
      });
    },
    [mode]
  );

  const handleAssignColumnGroup = useCallback(
    (columnId: string, groupId: string | null) => {
      setColumnLayout((prev) => {
        const nextGroups = prev.groups.map((g) => {
          const without = g.columnIds.filter((cid) => cid !== columnId);
          if (g.id === groupId) {
            return { ...g, columnIds: [...without, columnId] };
          }
          return { ...g, columnIds: without };
        });
        const next: TableColumnLayoutState = {
          ...prev,
          groups: nextGroups,
        };
        persistColumnLayout(mode, next);
        return next;
      });
    },
    [mode]
  );

  const handleAddColumnGroup = useCallback(
    (label: string) => {
      const trimmed = label.trim();
      if (!trimmed) return;
      setColumnLayout((prev) => {
        const id = `group_${Date.now().toString(36)}`;
        const next: TableColumnLayoutState = {
          ...prev,
          groups: [
            ...prev.groups,
            { id, label: trimmed, columnIds: [], collapsed: false },
          ],
        };
        persistColumnLayout(mode, next);
        return next;
      });
    },
    [mode]
  );

  const handleRemoveColumnGroup = useCallback(
    (groupId: string) => {
      setColumnLayout((prev) => {
        const next: TableColumnLayoutState = {
          ...prev,
          groups: prev.groups.filter((g) => g.id !== groupId),
        };
        persistColumnLayout(mode, next);
        return next;
      });
    },
    [mode]
  );

  const handleResetColumnLayout = useCallback(() => {
    const fresh = defaultColumnLayout(mode);
    setColumnLayout(fresh);
    persistColumnLayout(mode, fresh);
  }, [mode]);

  const handleApplyColumnPreset = useCallback(
    (presetId: TableColumnPresetId) => {
      setColumnLayout((prev) => {
        const applied = applyColumnPreset(mode, prev, presetId);
        setShowClientColumns(applied.showClientColumns);
        persistShowClientColumns(applied.showClientColumns);
        setShowOptionalColumns(applied.showOptionalColumns);
        persistShowOptionalColumns(applied.showOptionalColumns);
        persistColumnLayout(mode, applied.layout);
        return applied.layout;
      });
    },
    [mode]
  );

  return {
    showOptionalColumns,
    setShowOptionalColumns,
    showClientColumns,
    setShowClientColumns,
    columnLayout,
    orderedTableColumns,
    tableColumns,
    columnGroupSegments,
    handleMoveColumn,
    handleToggleColumnGroup,
    handleAssignColumnGroup,
    handleAddColumnGroup,
    handleRemoveColumnGroup,
    handleResetColumnLayout,
    handleApplyColumnPreset,
  };
}
