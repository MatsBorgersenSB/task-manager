import type { TableColumnDef } from "@/lib/tasks/labels";
import type { TaskViewMode } from "@/lib/tasks/types";

export type ColumnGroupDef = {
  id: string;
  label: string;
  /** Column IDs assigned to this group. */
  columnIds: string[];
  /** When true, only the first visible column in the group stays expanded in the table. */
  collapsed: boolean;
};

export type TableColumnLayoutState = {
  /** Custom ordered column IDs. Columns not listed here are placed in their default relative position. */
  columnOrder: string[];
  /** User-configured or default column groups. */
  groups: ColumnGroupDef[];
};

export type TableColumnPresetId =
  | "compact_execution"
  | "schedule_triage"
  | "client_review"
  | "all_columns";

export type TableColumnPresetDef = {
  id: TableColumnPresetId;
  label: string;
  description: string;
};

export const TABLE_COLUMN_PRESETS: readonly TableColumnPresetDef[] = [
  {
    id: "compact_execution",
    label: "Field Execution",
    description: "Core task info, due dates, and SB execution fields",
  },
  {
    id: "schedule_triage",
    label: "Schedule & Dates",
    description: "Focus on Due, Intervention, Duration, and Completion dates",
  },
  {
    id: "client_review",
    label: "Client Review",
    description: "Show client status & comments alongside core task columns",
  },
  {
    id: "all_columns",
    label: "All Columns",
    description: "Enable all optional & client columns and expand every group",
  },
] as const;

export function applyColumnPreset(
  mode: TaskViewMode,
  currentLayout: TableColumnLayoutState,
  presetId: TableColumnPresetId
): {
  layout: TableColumnLayoutState;
  showClientColumns: boolean;
  showOptionalColumns: boolean;
} {
  const baseGroups =
    currentLayout.groups.length > 0
      ? currentLayout.groups
      : defaultColumnGroups(mode);

  switch (presetId) {
    case "compact_execution":
      return {
        showClientColumns: false,
        showOptionalColumns: false,
        layout: {
          ...currentLayout,
          groups: baseGroups.map((g) => ({
            ...g,
            collapsed: g.id === "client",
          })),
        },
      };
    case "schedule_triage":
      return {
        showClientColumns: false,
        showOptionalColumns: true,
        layout: {
          ...currentLayout,
          groups: baseGroups.map((g) => ({
            ...g,
            collapsed: g.id === "sb" || g.id === "client",
          })),
        },
      };
    case "client_review":
      return {
        showClientColumns: true,
        showOptionalColumns: false,
        layout: {
          ...currentLayout,
          groups: baseGroups.map((g) => ({
            ...g,
            collapsed: g.id === "sb",
          })),
        },
      };
    case "all_columns":
      return {
        showClientColumns: true,
        showOptionalColumns: true,
        layout: {
          ...currentLayout,
          groups: baseGroups.map((g) => ({
            ...g,
            collapsed: false,
          })),
        },
      };
  }
}

const STORAGE_PREFIX = "task-table-column-layout-v2";

export function columnLayoutStorageKey(mode: TaskViewMode): string {
  return `${STORAGE_PREFIX}:${mode}`;
}

export function defaultColumnGroups(
  mode: TaskViewMode,
  options?: { isProjectShared?: boolean }
): ColumnGroupDef[] {
  const isProjectShared = options?.isProjectShared ?? true;

  if (mode === "client") {
    return [
      {
        id: "core",
        label: "Task",
        columnIds: ["id", "area", "issue", "subtasks"],
        collapsed: false,
      },
      {
        id: "schedule",
        label: "Schedule & Ownership",
        columnIds: [
          "status",
          "date_due",
          "intervention_date",
          "date_completed",
          "responsible",
        ],
        collapsed: false,
      },
      {
        id: "notes",
        label: "Notes & Links",
        columnIds: ["ce_comments", "links"],
        collapsed: false,
      },
    ];
  }

  const groups: ColumnGroupDef[] = [
    {
      id: "core",
      label: "Task",
      columnIds: ["id", "area", "issue", "subtasks"],
      collapsed: false,
    },
    {
      id: "schedule",
      label: "Schedule & Execution",
      columnIds: [
        "date_due",
        ...(isProjectShared ? ["responsible", "priority"] : []),
        "response_or_action_taken_by_sb",
        "intervention_date",
        "intervention_duration",
        "date_completed",
      ],
      collapsed: false,
    },
    ...(isProjectShared
      ? [
          {
            id: "client",
            label: "Client",
            columnIds: ["status", "ce_comments"],
            collapsed: false,
          },
        ]
      : []),
    {
      id: "sb",
      label: "Standard Bio",
      columnIds: [
        "sb_status",
        "sb_priority",
        ...(isProjectShared ? ["visibility"] : []),
        "sb_owner",
        "risk",
        "risk_comment",
        "sb_note",
        "links",
      ],
      collapsed: false,
    },
  ];

  return groups;
}

export function defaultColumnLayout(
  mode: TaskViewMode,
  options?: { isProjectShared?: boolean }
): TableColumnLayoutState {
  return {
    columnOrder: [],
    groups: defaultColumnGroups(mode, options),
  };
}

function sanitizeInternalGroups(groups: ColumnGroupDef[]): ColumnGroupDef[] {
  return groups.map((group) => {
    if (group.id === "client") {
      return {
        ...group,
        columnIds: group.columnIds.filter(
          (id) => id !== "response_or_action_taken_by_sb"
        ),
      };
    }
    if (
      group.id === "schedule" &&
      !group.columnIds.includes("response_or_action_taken_by_sb")
    ) {
      return {
        ...group,
        columnIds: [...group.columnIds, "response_or_action_taken_by_sb"],
      };
    }
    return group;
  });
}

export function readColumnLayout(mode: TaskViewMode): TableColumnLayoutState {
  if (typeof window === "undefined") {
    return defaultColumnLayout(mode);
  }

  try {
    const raw = window.localStorage.getItem(columnLayoutStorageKey(mode));
    if (!raw) return defaultColumnLayout(mode);
    const parsed = JSON.parse(raw) as Partial<TableColumnLayoutState>;
    const columnOrder = Array.isArray(parsed.columnOrder)
      ? parsed.columnOrder.filter((id): id is string => typeof id === "string")
      : [];
    const rawGroups = Array.isArray(parsed.groups)
      ? parsed.groups
          .filter(
            (g): g is ColumnGroupDef =>
              Boolean(g) &&
              typeof g.id === "string" &&
              typeof g.label === "string" &&
              Array.isArray(g.columnIds)
          )
          .map((g) => ({
            id: g.id,
            label: g.label.trim() || "Group",
            columnIds: g.columnIds.filter(
              (cid): cid is string => typeof cid === "string"
            ),
            collapsed: Boolean(g.collapsed),
          }))
      : defaultColumnGroups(mode);

    const groups =
      mode === "internal" ? sanitizeInternalGroups(rawGroups) : rawGroups;

    return { columnOrder, groups };
  } catch {
    return defaultColumnLayout(mode);
  }
}

export function persistColumnLayout(
  mode: TaskViewMode,
  state: TableColumnLayoutState
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      columnLayoutStorageKey(mode),
      JSON.stringify(state)
    );
  } catch {
    // Ignore storage errors
  }
}

/**
 * Apply custom column ordering to available columns while keeping any newly
 * enabled columns in a sensible position.
 */
export function orderTableColumns(
  availableColumns: TableColumnDef[],
  columnOrder: string[]
): TableColumnDef[] {
  if (columnOrder.length === 0) return availableColumns;

  const byId = new Map(availableColumns.map((col) => [col.id, col]));
  const seen = new Set<string>();
  const ordered: TableColumnDef[] = [];

  for (const id of columnOrder) {
    const col = byId.get(id);
    if (col && !seen.has(id)) {
      ordered.push(col);
      seen.add(id);
    }
  }

  for (const col of availableColumns) {
    if (!seen.has(col.id)) {
      ordered.push(col);
      seen.add(col.id);
    }
  }

  return ordered;
}

/**
 * Reorder a column before/after another column and return the full column ID list.
 */
export function moveColumnInOrder(
  currentColumns: TableColumnDef[],
  sourceColumnId: string,
  targetColumnId: string,
  position: "before" | "after" = "before"
): string[] {
  const ids = currentColumns.map((col) => col.id);
  if (sourceColumnId === targetColumnId) return ids;
  const fromIndex = ids.indexOf(sourceColumnId);
  const toIndex = ids.indexOf(targetColumnId);
  if (fromIndex === -1 || toIndex === -1) return ids;

  const next = ids.filter((id) => id !== sourceColumnId);
  const insertAt = next.indexOf(targetColumnId);
  if (insertAt === -1) return ids;

  next.splice(position === "after" ? insertAt + 1 : insertAt, 0, sourceColumnId);
  return next;
}

export type HeaderGroupSegment = {
  key: string;
  group: ColumnGroupDef | null;
  /** Visible columns rendered under this header segment. */
  visibleColumns: TableColumnDef[];
  /** All available (currently enabled) columns belonging to this group. */
  allGroupColumns: TableColumnDef[];
  /** Number of columns hidden because this group is collapsed. */
  hiddenCount: number;
};

/**
 * Computes both the visible columns (after collapsing groups) and the top header
 * group banner segments. When a group is collapsed, its first available column
 * stays visible as the anchor column and the remaining columns in that group are hidden.
 */
export function resolveVisibleColumnsAndGroupSegments(
  orderedColumns: TableColumnDef[],
  groups: ColumnGroupDef[]
): {
  visibleColumns: TableColumnDef[];
  segments: HeaderGroupSegment[];
  groupByColumnId: Map<string, ColumnGroupDef>;
} {
  const groupByColumnId = new Map<string, ColumnGroupDef>();
  for (const group of groups) {
    for (const colId of group.columnIds) {
      if (!groupByColumnId.has(colId)) {
        groupByColumnId.set(colId, group);
      }
    }
  }

  // Count all available columns per group and track first column per group
  const availableByGroupId = new Map<string, TableColumnDef[]>();
  for (const col of orderedColumns) {
    const group = groupByColumnId.get(col.id);
    if (!group) continue;
    const list = availableByGroupId.get(group.id) ?? [];
    list.push(col);
    availableByGroupId.set(group.id, list);
  }

  const visibleColumns: TableColumnDef[] = [];
  for (const col of orderedColumns) {
    const group = groupByColumnId.get(col.id);
    if (!group || !group.collapsed) {
      visibleColumns.push(col);
      continue;
    }
    const groupCols = availableByGroupId.get(group.id) ?? [];
    if (groupCols[0]?.id === col.id) {
      visibleColumns.push(col);
    }
  }

  // Build contiguous segments across visibleColumns
  const segments: HeaderGroupSegment[] = [];
  for (const col of visibleColumns) {
    const group = groupByColumnId.get(col.id) ?? null;
    const prev = segments[segments.length - 1];
    if (prev && prev.group?.id === (group?.id ?? null) && group !== null) {
      prev.visibleColumns.push(col);
      continue;
    }
    if (prev && prev.group === null && group === null) {
      prev.visibleColumns.push(col);
      continue;
    }
    const allGroupColumns = group
      ? (availableByGroupId.get(group.id) ?? [col])
      : [col];
    const hiddenCount =
      group && group.collapsed
        ? Math.max(0, allGroupColumns.length - 1)
        : 0;

    segments.push({
      key: `${group?.id ?? "ungrouped"}-${col.id}-${segments.length}`,
      group,
      visibleColumns: [col],
      allGroupColumns,
      hiddenCount,
    });
  }

  return {
    visibleColumns,
    segments,
    groupByColumnId,
  };
}
