"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadAttentionWorkspace,
  type AttentionWorkspaceSnapshot,
} from "@/lib/attention/attentionWorkspace";

const EMPTY_SNAPSHOT: Omit<AttentionWorkspaceSnapshot, "loading"> = {
  projects: [],
  tasks: [],
  waitingTaskIds: new Set(),
  notifications: [],
  unreadNotifications: 0,
  myTasksStats: {
    open: 0,
    dueToday: 0,
    overdue: 0,
    dueThisWeek: 0,
    completedThisWeek: 0,
  },
  attention: {
    overdue: 0,
    dueWithin24Hours: 0,
    unansweredComments: 0,
    blockedTasks: 0,
    projectsAtRisk: 0,
    totalCount: 0,
    weightedScore: 0,
  },
  projectsAtRisk: [],
  myTasks: [],
  priorityTasks: [],
  userActivity: [],
  userHandle: "",
  error: null,
};

export function useAttentionWorkspace(userEmail: string) {
  const [snapshot, setSnapshot] = useState<AttentionWorkspaceSnapshot>({
    ...EMPTY_SNAPSHOT,
    loading: true,
  });

  const refresh = useCallback(async () => {
    setSnapshot((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await loadAttentionWorkspace(userEmail);
      setSnapshot({ ...data, loading: false });
    } catch (error) {
      setSnapshot({
        ...EMPTY_SNAPSHOT,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load workspace.",
      });
    }
  }, [userEmail]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 120_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return { ...snapshot, refresh };
}
