"use client";

import { useEffect, useRef, useState } from "react";
import { ui } from "@/lib/ui/classes";

type ColumnVisibilityMenuProps = {
  showClientColumns: boolean;
  showOptionalColumns: boolean;
  onToggleClientColumns: (next: boolean) => void;
  onToggleOptionalColumns: (next: boolean) => void;
};

/** Dropdown to show/hide client and extra columns in the internal task table. */
export default function ColumnVisibilityMenu({
  showClientColumns,
  showOptionalColumns,
  onToggleClientColumns,
  onToggleOptionalColumns,
}: ColumnVisibilityMenuProps) {
  const [open, setOpen] = useState(false);
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

  const activeCount =
    (showClientColumns ? 1 : 0) + (showOptionalColumns ? 1 : 0);

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
        title="Show or hide table columns"
      >
        Columns{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-surface p-2 shadow-lg"
          role="menu"
          aria-label="Column visibility"
          onClick={(event) => event.stopPropagation()}
        >
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Show in table
          </p>
          <label className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm text-primary hover:bg-background">
            <input
              type="checkbox"
              checked={showClientColumns}
              onChange={(event) => onToggleClientColumns(event.target.checked)}
              className="mt-0.5 rounded border-border text-accent focus:ring-accent/20"
            />
            <span>
              <span className="font-medium">Client columns</span>
              <span className="mt-0.5 block text-xs text-muted">
                Client Status, Client Comment — for shared / client projects
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm text-primary hover:bg-background">
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
              <span className="mt-0.5 block text-xs text-muted">
                Priority, Intervention, Date Completed, Admin Comment
              </span>
            </span>
          </label>
        </div>
      ) : null}
    </div>
  );
}
