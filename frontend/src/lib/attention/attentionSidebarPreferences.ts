"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "attention-sidebar-collapsed";

export function readAttentionSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeAttentionSidebarCollapsed(collapsed: boolean): void {
  window.localStorage.setItem(STORAGE_KEY, collapsed ? "true" : "false");
}

export function useAttentionSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(readAttentionSidebarCollapsed);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    writeAttentionSidebarCollapsed(value);
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      writeAttentionSidebarCollapsed(next);
      return next;
    });
  }, []);

  return { collapsed, setCollapsed, toggle };
}
