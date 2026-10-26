"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  TABLE_COLUMN_PRESETS,
  type ColumnGroupDef,
  type TableColumnPresetId,
} from "@/lib/tasks/columnLayout";
import type { TableColumnDef } from "@/lib/tasks/labels";
import { ui } from "@/lib/ui/classes";

type ColumnVisibilityMenuProps = {
  isInternal: boolean;
  showClientColumns: boolean;
  showOptionalColumns: boolean;
  onToggleClientColumns: (next: boolean) => void;
  onToggleOptionalColumns: (next: boolean) => void;
  orderedColumns: TableColumnDef[];
  groups: ColumnGroupDef[];
  onMoveColumn: (
    sourceColumnId: string,
    targetColumnId: string,
    position: "before" | "after"
  ) => void;
  onAssignColumnGroup: (columnId: string, groupId: string | null) => void;
  onToggleGroupCollapsed: (groupId: string) => void;
  onAddGroup: (label: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onResetLayout: () => void;
  onApplyPreset?: (presetId: TableColumnPresetId) => void;
};

/** Dropdown to show/hide, reorder, and group columns in the task table. */
export default function ColumnVisibilityMenu({
  isInternal,
  showClientColumns,
  showOptionalColumns,
  onToggleClientColumns,
  onToggleOptionalColumns,
  orderedColumns,
  groups,
  onMoveColumn,
  onAssignColumnGroup,
  onToggleGroupCollapsed,
  onAddGroup,
  onRemoveGroup,
  onResetLayout,
  onApplyPreset,
}: ColumnVisibilityMenuProps) {
  const [open, setOpen] = useState(false);
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const groupByColumnId = useMemo(() => {
    const map = new Map<string, ColumnGroupDef>();
    for (const g of groups) {
      for (const cid of g.columnIds) {
        if (!map.has(cid)) map.set(cid, g);
      }
    }
    return map;
  }, [groups]);

  const collapsedGroupCount = groups.filter((g) => g.collapsed).length;
  const activeCount =
    (isInternal && showClientColumns ? 1 : 0) +
    (isInternal && showOptionalColumns ? 1 : 0) +
    collapsedGroupCount;

  function handleCreateGroup(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = newGroupLabel.trim();
    if (!trimmed) return;
    onAddGroup(trimmed);
    setNewGroupLabel("");
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={`${ui.btnUtilitySm}${
          activeCount > 0 ? " bg-accent/10 text-accent" : ""
        }`}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Configure, move, and group table columns"
      >
        Columns{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-1 max-h-[80vh] w-[26rem] overflow-y-auto rounded-md border border-border bg-surface p-3 shadow-lg"
          role="menu"
          aria-label="Column layout and grouping"
          onClick={(event) => event.stopPropagation()}
        >
          {isInternal && onApplyPreset ? (
            <div className="mb-3 border-b border-border pb-3">
              <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Quick view presets
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {TABLE_COLUMN_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onApplyPreset(preset.id)}
                    title={preset.description}
                    className="rounded border border-border bg-background/70 px-2 py-1.5 text-left text-xs transition hover:border-accent hover:bg-accent/5"
                  >
                    <span className="block font-medium text-primary">
                      {preset.label}
                    </span>
                    <span className="mt-0.5 line-clamp-1 block text-[10px] text-muted">
                      {preset.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {isInternal ? (
            <div className="mb-3 border-b border-border pb-3">
              <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Show in table
              </p>
              <label className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-xs text-primary hover:bg-background">
                <input
                  type="checkbox"
                  checked={showClientColumns}
                  onChange={(event) =>
                    onToggleClientColumns(event.target.checked)
                  }
                  className="mt-0.5 rounded border-border text-accent focus:ring-accent/20"
                />
                <span>
                  <span className="font-medium">Client columns</span>
                  <span className="mt-0.5 block text-[11px] text-muted">
                    Client Status, Client Comment — for shared / client projects
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-xs text-primary hover:bg-background">
                <input
                  type="checkbox"
                  checked={showOptionalColumns}
                  onChange={(event) =>
                    onToggleOptionalColumns(event.target.checked)
                  }
                  className="mt-0.5 rounded border-border text-accent focus:ring-accent/20"
                />
                <span>
                  <span className="font-medium">More columns</span>
                  <span className="mt-0.5 block text-[11px] text-muted">
                    Priority, Intervention, Date Completed
                  </span>
                </span>
              </label>
            </div>
          ) : null}

          <div className="mb-3 border-b border-border pb-3">
            <div className="flex items-center justify-between px-1 pb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Column groups (collapse / expand)
              </p>
            </div>

            <div className="space-y-1">
              {groups.map((group) => {
                const countInTable = orderedColumns.filter((col) =>
                  group.columnIds.includes(col.id)
                ).length;

                return (
                  <div
                    key={group.id}
                    className="flex items-center justify-between gap-2 rounded border border-border/70 bg-background/60 px-2 py-1 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-primary">
                        {group.label}
                      </span>
                      <span className="ml-1.5 text-[11px] text-muted">
                        ({countInTable} col{countInTable === 1 ? "" : "s"})
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        disabled={countInTable <= 1}
                        onClick={() => onToggleGroupCollapsed(group.id)}
                        className="rounded border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-background disabled:opacity-40"
                        title={
                          countInTable <= 1
                            ? "Assign at least 2 visible columns to collapse this group"
                            : group.collapsed
                              ? `Expand ${group.label}`
                              : `Collapse ${group.label}`
                        }
                      >
                        {group.collapsed ? "Expand" : "Collapse"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveGroup(group.id)}
                        className="rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-red-50 hover:text-red-700"
                        title={`Remove group ${group.label}`}
                        aria-label={`Remove group ${group.label}`}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={handleCreateGroup}
              className="mt-2 flex items-center gap-1.5"
            >
              <input
                type="text"
                value={newGroupLabel}
                onChange={(event) => setNewGroupLabel(event.target.value)}
                placeholder="New group name…"
                className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-xs text-primary placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newGroupLabel.trim()}
                className="rounded border border-border bg-surface px-2 py-1 text-xs font-medium text-primary hover:bg-background disabled:opacity-40"
              >
                + Add group
              </button>
            </form>
          </div>

          <div>
            <div className="flex items-center justify-between px-1 pb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Column order & group assignment
              </p>
              <button
                type="button"
                onClick={onResetLayout}
                className="text-[11px] font-medium text-accent hover:underline"
              >
                Reset default
              </button>
            </div>
            <p className="px-1 pb-2 text-[11px] text-muted">
              Tip: You can also drag column headers directly in the table.
            </p>

            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {orderedColumns.map((col, idx) => {
                const assignedGroup = groupByColumnId.get(col.id);
                const canMoveLeft = idx > 0;
                const canMoveRight = idx < orderedColumns.length - 1;

                return (
                  <div
                    key={col.id}
                    className="flex items-center justify-between gap-1.5 rounded border border-border/60 bg-surface px-2 py-1 text-xs hover:bg-background/50"
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="w-4 shrink-0 text-right text-[10px] tabular-nums text-muted">
                        {idx + 1}.
                      </span>
                      <span className="truncate font-medium text-primary">
                        {col.label}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <select
                        value={assignedGroup?.id ?? ""}
                        onChange={(event) =>
                          onAssignColumnGroup(
                            col.id,
                            event.target.value || null
                          )
                        }
                        aria-label={`Group for ${col.label}`}
                        className="max-w-[7.75rem] rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-primary focus:border-accent focus:outline-none"
                      >
                        <option value="">No group</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        disabled={!canMoveLeft}
                        onClick={() =>
                          onMoveColumn(
                            col.id,
                            orderedColumns[idx - 1].id,
                            "before"
                          )
                        }
                        className="rounded border border-border px-1.5 py-0.5 text-[11px] leading-none text-primary hover:bg-background disabled:opacity-35"
                        title={`Move ${col.label} left`}
                        aria-label={`Move ${col.label} left`}
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        disabled={!canMoveRight}
                        onClick={() =>
                          onMoveColumn(
                            col.id,
                            orderedColumns[idx + 1].id,
                            "after"
                          )
                        }
                        className="rounded border border-border px-1.5 py-0.5 text-[11px] leading-none text-primary hover:bg-background disabled:opacity-35"
                        title={`Move ${col.label} right`}
                        aria-label={`Move ${col.label} right`}
                      >
                        →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
