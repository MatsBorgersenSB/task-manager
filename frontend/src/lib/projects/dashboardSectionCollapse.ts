"use client";

import { useCallback, useState } from "react";

export type SectionCollapseId =
  | "attentionCenter"
  | "projectSummary"
  | "projectProgress"
  | "recentUpdates"
  | "projectLinks"
  | "clientActivity"
  | "projectFeed"
  | "sharingWorkflow";

export const SECTION_COLLAPSE_STORAGE_KEYS: Record<SectionCollapseId, string> = {
  attentionCenter: "attention_center_collapsed",
  projectSummary: "project_summary_collapsed",
  projectProgress: "project_progress_collapsed",
  recentUpdates: "recent_updates_collapsed",
  projectLinks: "project_links_collapsed",
  clientActivity: "client_activity_collapsed",
  projectFeed: "project_feed_collapsed",
  sharingWorkflow: "sharing_workflow_collapsed",
};

export const SECTION_COLLAPSE_LABELS: Record<SectionCollapseId, string> = {
  attentionCenter: "Attention Center",
  projectSummary: "Project Summary",
  projectProgress: "Project Progress",
  recentUpdates: "Activity",
  projectLinks: "Project Links",
  clientActivity: "Client Activity",
  projectFeed: "Project Feed",
  sharingWorkflow: "Sharing & Workflow",
};

/** Default collapsed state per sprint spec (true = collapsed). */
export const DEFAULT_SECTION_COLLAPSED: Record<SectionCollapseId, boolean> = {
  attentionCenter: false,
  projectSummary: false,
  projectProgress: true,
  recentUpdates: true,
  projectLinks: true,
  clientActivity: true,
  projectFeed: true,
  sharingWorkflow: true,
};

function readCollapsed(id: SectionCollapseId): boolean {
  if (typeof window === "undefined") {
    return DEFAULT_SECTION_COLLAPSED[id];
  }
  try {
    const raw = window.localStorage.getItem(SECTION_COLLAPSE_STORAGE_KEYS[id]);
    if (raw === null) return DEFAULT_SECTION_COLLAPSED[id];
    return raw === "true";
  } catch {
    return DEFAULT_SECTION_COLLAPSED[id];
  }
}

function writeCollapsed(id: SectionCollapseId, collapsed: boolean): void {
  window.localStorage.setItem(
    SECTION_COLLAPSE_STORAGE_KEYS[id],
    collapsed ? "true" : "false"
  );
}

export function useSectionCollapse(id: SectionCollapseId) {
  const [collapsed, setCollapsedState] = useState(() => readCollapsed(id));

  const setCollapsed = useCallback(
    (value: boolean) => {
      setCollapsedState(value);
      writeCollapsed(id, value);
    },
    [id]
  );

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      writeCollapsed(id, next);
      return next;
    });
  }, [id]);

  return { collapsed, setCollapsed, toggle, expanded: !collapsed };
}
