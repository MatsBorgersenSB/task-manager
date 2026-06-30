"use client";

import { useLayoutEffect, type RefObject } from "react";

/**
 * Measures the label row height and sets --task-table-header-row-1-height on the
 * scroll container so the filter row sticks directly beneath it (one header block).
 */
export function useTaskTableHeaderHeight(
  scrollRef: RefObject<HTMLElement | null>,
  labelRowRef: RefObject<HTMLTableRowElement | null>,
  enabled = true
) {
  useLayoutEffect(() => {
    if (!enabled) return;

    const scrollEl = scrollRef.current;
    const labelRow = labelRowRef.current;
    if (!scrollEl || !labelRow) return;

    const update = () => {
      const height = labelRow.getBoundingClientRect().height;
      scrollEl.style.setProperty(
        "--task-table-header-row-1-height",
        `${Math.ceil(height)}px`
      );
      scrollEl.dataset.headerMeasured = "true";
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(labelRow);

    const table = labelRow.closest("table");
    if (table) observer.observe(table);

    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      delete scrollEl.dataset.headerMeasured;
    };
  }, [scrollRef, labelRowRef, enabled]);
}
