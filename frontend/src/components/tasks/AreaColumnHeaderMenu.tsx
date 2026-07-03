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
import { usePortalRoot } from "@/contexts/FullscreenOverlayContext";

type AreaColumnHeaderMenuProps = {
  sort: string;
  groupByArea: boolean;
  filterOptions: string[];
  selectedFilters: string[];
  onSortAscending: () => void;
  onSortDescending: () => void;
  onToggleGroupByArea: () => void;
  onFilterChange: (selected: string[]) => void;
  disabled?: boolean;
};

export default function AreaColumnHeaderMenu({
  sort,
  groupByArea,
  filterOptions,
  selectedFilters,
  onSortAscending,
  onSortDescending,
  onToggleGroupByArea,
  onFilterChange,
  disabled = false,
}: AreaColumnHeaderMenuProps) {
  const portalRoot = usePortalRoot();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuStyle, setMenuStyle] = useState<{
    top: number;
    left: number;
    minWidth: number;
  } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const isFilterActive = selectedFilters.length > 0;
  const isMenuActive =
    groupByArea || isFilterActive || sort === "area-asc" || sort === "area-desc";

  const filteredOptions = filterOptions.filter((option) =>
    option.toLowerCase().includes(search.trim().toLowerCase())
  );

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const minWidth = 220;
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

  function toggleFilterOption(option: string) {
    if (selectedFilters.includes(option)) {
      onFilterChange(selectedFilters.filter((value) => value !== option));
      return;
    }
    onFilterChange([...selectedFilters, option]);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        className={`inline-flex shrink-0 items-center gap-0.5 rounded px-0.5 text-[10px] leading-none text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-40 print:hidden ${
          isMenuActive ? "text-white" : ""
        }`}
        aria-label="Area column options"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        <span aria-hidden className="text-[9px]">
          ▼
        </span>
        {isMenuActive ? (
          <span
            aria-hidden
            className="text-[8px] text-amber-300"
            title="Area options active"
          >
            ●
          </span>
        ) : null}
      </button>

      {open && menuStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label="Area column options"
              className="fixed z-[200] max-h-80 overflow-hidden rounded-md border border-slate-200 bg-white text-slate-900 shadow-lg"
              style={{
                top: menuStyle.top,
                left: menuStyle.left,
                minWidth: menuStyle.minWidth,
              }}
            >
              <div className="py-1">
                <button
                  type="button"
                  role="menuitem"
                  className={`flex w-full items-center px-3 py-1.5 text-left text-xs hover:bg-slate-50 ${
                    sort === "area-asc" ? "font-semibold text-accent" : ""
                  }`}
                  onClick={() => {
                    onSortAscending();
                    setOpen(false);
                  }}
                >
                  Sort Ascending
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={`flex w-full items-center px-3 py-1.5 text-left text-xs hover:bg-slate-50 ${
                    sort === "area-desc" ? "font-semibold text-accent" : ""
                  }`}
                  onClick={() => {
                    onSortDescending();
                    setOpen(false);
                  }}
                >
                  Sort Descending
                </button>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={groupByArea}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-50 ${
                    groupByArea ? "font-semibold text-accent" : ""
                  }`}
                  onClick={() => {
                    onToggleGroupByArea();
                  }}
                >
                  <span aria-hidden>{groupByArea ? "☑" : "☐"}</span>
                  Group By Area
                </button>
              </div>

              <div className="border-t border-slate-100 p-2">
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Filter areas…"
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                />
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-2 py-1.5 text-[10px]">
                <button
                  type="button"
                  className="font-medium text-accent hover:underline"
                  onClick={() =>
                    onFilterChange([
                      ...new Set([...selectedFilters, ...filteredOptions]),
                    ])
                  }
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="font-medium text-slate-500 hover:text-slate-800 hover:underline"
                  onClick={() => {
                    onFilterChange([]);
                    setOpen(false);
                  }}
                >
                  Clear filter
                </button>
              </div>

              <div className="max-h-40 overflow-y-auto border-t border-slate-100 py-1">
                {filteredOptions.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-500">No values</p>
                ) : (
                  filteredOptions.map((option) => {
                    const checked = selectedFilters.includes(option);
                    return (
                      <label
                        key={option}
                        className="flex cursor-pointer items-start gap-2 px-3 py-1 text-xs hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFilterOption(option)}
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
            portalRoot
          )
        : null}
    </>
  );
}
