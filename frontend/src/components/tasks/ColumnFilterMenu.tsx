"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type ColumnFilterMenuProps = {
  columnLabel: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
};

export default function ColumnFilterMenu({
  columnLabel,
  options,
  selected,
  onChange,
  disabled = false,
}: ColumnFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuStyle, setMenuStyle] = useState<{
    top: number;
    left: number;
    minWidth: number;
  } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const isActive = selected.length > 0;

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(search.trim().toLowerCase())
  );

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const minWidth = Math.max(200, rect.width + 48);
    const left = Math.min(rect.left, window.innerWidth - minWidth - 8);

    setMenuStyle({
      top: rect.bottom + 4,
      left: Math.max(8, left),
      minWidth,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  function toggleOption(option: string) {
    if (selected.includes(option)) {
      onChange(selected.filter((value) => value !== option));
      return;
    }
    onChange([...selected, option]);
  }

  function selectAllVisible() {
    const merged = new Set([...selected, ...filteredOptions]);
    onChange([...merged]);
  }

  function clearFilter() {
    onChange([]);
    setOpen(false);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        className={`inline-flex shrink-0 items-center gap-0.5 rounded px-0.5 text-[10px] leading-none text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-40 print:hidden ${
          isActive ? "text-white" : ""
        }`}
        aria-label={`Filter ${columnLabel}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        <span aria-hidden className="text-[9px]">
          ▼
        </span>
        {isActive ? (
          <span
            aria-hidden
            className="text-[8px] text-amber-300"
            title="Filter active"
          >
            ●
          </span>
        ) : null}
      </button>

      {open && menuStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              id={listId}
              role="listbox"
              aria-label={`${columnLabel} filter`}
              className="fixed z-[200] max-h-72 overflow-hidden rounded-md border border-slate-200 bg-white text-slate-900 shadow-lg"
              style={{
                top: menuStyle.top,
                left: menuStyle.left,
                minWidth: menuStyle.minWidth,
              }}
            >
              <div className="border-b border-slate-100 p-2">
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search…"
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-2 py-1.5 text-[10px]">
                <button
                  type="button"
                  className="font-medium text-accent hover:underline"
                  onClick={selectAllVisible}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="font-medium text-slate-500 hover:text-slate-800 hover:underline"
                  onClick={clearFilter}
                >
                  Clear filter
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto py-1">
                {filteredOptions.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-500">No values</p>
                ) : (
                  filteredOptions.map((option) => {
                    const checked = selected.includes(option);
                    return (
                      <label
                        key={option}
                        className="flex cursor-pointer items-start gap-2 px-3 py-1 text-xs hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOption(option)}
                          className="mt-0.5 rounded border-slate-300 text-accent focus:ring-accent/30"
                        />
                        <span className="min-w-0 break-words leading-snug">
                          {option}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
