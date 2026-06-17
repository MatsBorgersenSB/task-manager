"use client";

import { useEffect, useRef, useState } from "react";
import { ui } from "@/lib/ui/classes";

type SbOwnerMultiFilterProps = {
  options: string[];
  selected: string[];
  onChange: (owners: string[]) => void;
  label?: string;
};

function filterButtonLabel(selected: string[]): string {
  if (selected.length === 0) return "All SB owners";
  if (selected.length <= 2) return selected.join(", ");
  return `${selected.length} selected`;
}

export default function SbOwnerMultiFilter({
  options,
  selected,
  onChange,
  label = "SB owners",
}: SbOwnerMultiFilterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [open]);

  function toggleOwner(owner: string) {
    onChange(
      selected.includes(owner)
        ? selected.filter((value) => value !== owner)
        : [...selected, owner]
    );
  }

  function selectAll() {
    onChange([...options]);
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={`${ui.filterToolbarSelect} min-w-[9rem] text-left`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
      >
        {filterButtonLabel(selected)}
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-50 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-border bg-surface p-2 shadow-lg"
          onClick={(event) => event.stopPropagation()}
          role="listbox"
          aria-label={label}
          aria-multiselectable
        >
          <div className="mb-2 flex items-center gap-2 border-b border-border pb-2 text-xs">
            <button
              type="button"
              onClick={selectAll}
              className="text-primary/80 transition hover:text-primary"
            >
              Select all
            </button>
            <span className="text-muted" aria-hidden>
              ·
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="text-primary/80 transition hover:text-primary"
            >
              Clear all
            </button>
          </div>

          {options.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted">No SB owners found</p>
          ) : (
            options.map((owner) => (
              <label
                key={owner}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-sm text-primary hover:bg-background"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(owner)}
                  onChange={() => toggleOwner(owner)}
                  className="rounded border-border text-accent focus:ring-accent/20"
                />
                <span className="truncate">{owner}</span>
              </label>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
