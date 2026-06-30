"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HierarchyUndoEntry } from "@/lib/tasks/hierarchyUndoMessages";

export type HierarchyUndoAction = {
  id: string;
  message: string;
  entries: HierarchyUndoEntry[];
  expiresAt: number;
};

const UNDO_DURATION_MS = 10_000;

export function useHierarchyUndo() {
  const [action, setAction] = useState<HierarchyUndoAction | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setAction(null);
  }, [clearTimer]);

  const pushUndo = useCallback(
    (payload: Pick<HierarchyUndoAction, "message" | "entries">) => {
      clearTimer();
      const next: HierarchyUndoAction = {
        ...payload,
        id: `undo-${Date.now()}`,
        expiresAt: Date.now() + UNDO_DURATION_MS,
      };
      setAction(next);
      timerRef.current = setTimeout(() => {
        setAction((current) => (current?.id === next.id ? null : current));
        timerRef.current = null;
      }, UNDO_DURATION_MS);
    },
    [clearTimer]
  );

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { action, pushUndo, dismiss };
}
