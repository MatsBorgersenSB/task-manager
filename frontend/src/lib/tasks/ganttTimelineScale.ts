import { ViewMode } from "gantt-task-react";

/** User-facing Gantt timeline zoom levels. */
export const GANTT_TIMELINE_SCALES = ["week", "month", "year"] as const;
export type GanttTimelineScale = (typeof GANTT_TIMELINE_SCALES)[number];

/** Reserved for future zoom levels (day, quarter, custom range, slider). */
export type GanttTimelineScaleId = GanttTimelineScale | "day" | "quarter" | "custom";

export const DEFAULT_GANTT_TIMELINE_SCALE: GanttTimelineScale = "month";

const STORAGE_KEY = "task-gantt-timeline-scale";

export type GanttTimelineScaleConfig = {
  id: GanttTimelineScale;
  label: string;
  description: string;
  viewMode: ViewMode;
  columnWidth: number;
  headerHeight: number;
};

/**
 * Maps product zoom levels to gantt-task-react view modes.
 * Week → daily columns (Mon–Sun); Month → week bands; Year → month columns.
 */
export const GANTT_TIMELINE_SCALE_CONFIG: Record<
  GanttTimelineScale,
  GanttTimelineScaleConfig
> = {
  week: {
    id: "week",
    label: "Week",
    description: "Daily columns for short-term execution",
    viewMode: ViewMode.Day,
    columnWidth: 54,
    headerHeight: 56,
  },
  month: {
    id: "month",
    label: "Month",
    description: "Weeks within the month for standard planning",
    viewMode: ViewMode.Month,
    columnWidth: 240,
    headerHeight: 56,
  },
  year: {
    id: "year",
    label: "Year",
    description: "Month columns for long-term portfolio overview",
    viewMode: ViewMode.Year,
    columnWidth: 128,
    headerHeight: 52,
  },
};

export function isGanttTimelineScale(value: string): value is GanttTimelineScale {
  return (GANTT_TIMELINE_SCALES as readonly string[]).includes(value);
}

export function readGanttTimelineScale(): GanttTimelineScale {
  if (typeof window === "undefined") return DEFAULT_GANTT_TIMELINE_SCALE;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && isGanttTimelineScale(raw)) return raw;
  } catch {
    // Ignore private mode / quota errors.
  }

  return DEFAULT_GANTT_TIMELINE_SCALE;
}

export function persistGanttTimelineScale(scale: GanttTimelineScale): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, scale);
  } catch {
    // Ignore private mode / quota errors.
  }
}

export function ganttViewDateForScale(scale: GanttTimelineScale): Date {
  const now = new Date();
  now.setHours(12, 0, 0, 0);

  if (scale === "year") {
    return new Date(now.getFullYear(), 0, 1, 12, 0, 0, 0);
  }

  if (scale === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0);
  }

  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  weekStart.setHours(12, 0, 0, 0);
  return weekStart;
}
