"use client";

import { useCallback, useState } from "react";

const STORAGE_KEY = "task_focus_mode";

function readTaskFocusMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeTaskFocusMode(enabled: boolean): void {
  window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
}

export function useTaskFocusMode() {
  const [focusMode, setFocusModeState] = useState(readTaskFocusMode);

  const setFocusMode = useCallback((enabled: boolean) => {
    setFocusModeState(enabled);
    writeTaskFocusMode(enabled);
  }, []);

  const toggleFocusMode = useCallback(() => {
    setFocusModeState((prev) => {
      const next = !prev;
      writeTaskFocusMode(next);
      return next;
    });
  }, []);

  return { focusMode, setFocusMode, toggleFocusMode };
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}
