"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "project_summary_collapsed";

export function readProjectSummaryCollapsed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

export function writeProjectSummaryCollapsed(collapsed: boolean): void {
  window.localStorage.setItem(STORAGE_KEY, collapsed ? "true" : "false");
}

export function useProjectSummaryCollapsed() {
  const [collapsed, setCollapsedState] = useState(readProjectSummaryCollapsed);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    writeProjectSummaryCollapsed(value);
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      writeProjectSummaryCollapsed(next);
      return next;
    });
  }, []);

  return { collapsed, setCollapsed, toggle };
}
