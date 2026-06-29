"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type DashboardSectionId =
  | "attention"
  | "stats"
  | "progress"
  | "links"
  | "clientActivity"
  | "projectFeed"
  | "workflowBanner";

export const DASHBOARD_SECTION_LABELS: Record<DashboardSectionId, string> = {
  attention: "Attention Required",
  stats: "Summary Cards",
  progress: "Project Progress",
  links: "Project Links",
  clientActivity: "Client Activity",
  projectFeed: "Project Feed",
  workflowBanner: "Sharing & Workflow",
};

const STORAGE_KEY = "project-dashboard-sections-v1";

export const DEFAULT_DASHBOARD_SECTIONS: Record<DashboardSectionId, boolean> = {
  attention: true,
  stats: true,
  progress: true,
  links: true,
  clientActivity: true,
  projectFeed: true,
  workflowBanner: true,
};

const SECTION_IDS = Object.keys(
  DEFAULT_DASHBOARD_SECTIONS
) as DashboardSectionId[];

export type DashboardSectionVisibility = Record<DashboardSectionId, boolean>;

export function readDashboardSectionVisibility(): DashboardSectionVisibility {
  if (typeof window === "undefined") {
    return { ...DEFAULT_DASHBOARD_SECTIONS };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DASHBOARD_SECTIONS };
    const parsed = JSON.parse(raw) as Partial<DashboardSectionVisibility>;
    return { ...DEFAULT_DASHBOARD_SECTIONS, ...parsed };
  } catch {
    return { ...DEFAULT_DASHBOARD_SECTIONS };
  }
}

export function writeDashboardSectionVisibility(
  visibility: DashboardSectionVisibility
): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
}

export function useDashboardSections() {
  const [sections, setSections] = useState<DashboardSectionVisibility>(
    DEFAULT_DASHBOARD_SECTIONS
  );

  useEffect(() => {
    setSections(readDashboardSectionVisibility());
  }, []);

  useEffect(() => {
    writeDashboardSectionVisibility(sections);
  }, [sections]);

  const isVisible = useCallback(
    (id: DashboardSectionId) => sections[id],
    [sections]
  );

  const setVisible = useCallback((id: DashboardSectionId, visible: boolean) => {
    setSections((prev) => ({ ...prev, [id]: visible }));
  }, []);

  const toggle = useCallback((id: DashboardSectionId) => {
    setSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const showAll = useCallback(() => {
    setSections({ ...DEFAULT_DASHBOARD_SECTIONS });
  }, []);

  const hiddenSections = useMemo(
    () => SECTION_IDS.filter((id) => !sections[id]),
    [sections]
  );

  return {
    sections,
    isVisible,
    setVisible,
    toggle,
    showAll,
    hiddenSections,
  };
}
