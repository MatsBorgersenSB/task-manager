import type { TaskFilters } from "@/lib/tasks/types";
import { CLIENT_STATUS_FILTER_ALL } from "@/lib/tasks/constants";
import { RECENT_WINDOW_MINUTES } from "@/lib/tasks/recentTasks";

export type SummaryFilterKey =
  | "open"
  | "completed"
  | "overdue"
  | "dueThisWeek"
  | "recentUpdates";

export const SUMMARY_FILTER_TOOLTIPS: Record<SummaryFilterKey, string> = {
  open: "Tasks not marked completed",
  completed: "Tasks marked complete",
  overdue: "Tasks with due date before today",
  dueThisWeek: "Tasks due within the next 7 days",
  recentUpdates: "Tasks updated within the last 60 minutes",
};

export const PROJECT_PROGRESS_TOOLTIP =
  "Completed main tasks and subtasks divided by total work items. Subtasks count toward overall progress.";

/** Banner title when a summary card filter is active. */
export const SUMMARY_FILTER_BANNER_LABELS: Record<SummaryFilterKey, string> = {
  open: "Open Tasks",
  completed: "Completed Tasks",
  overdue: "Overdue Tasks",
  dueThisWeek: "Due This Week",
  recentUpdates: "Recent Updates",
};

export const SUMMARY_FILTER_LABELS = SUMMARY_FILTER_BANNER_LABELS;

/** Filter patch applied when a summary card is clicked. */
export function summaryFilterPatch(
  key: SummaryFilterKey
): { filters: Partial<TaskFilters>; showRecentOnly: boolean } {
  switch (key) {
    case "open":
      return { filters: { status: "", due: "" }, showRecentOnly: false };
    case "completed":
      return { filters: { status: "Complete", due: "" }, showRecentOnly: false };
    case "overdue":
      return { filters: { status: "", due: "overdue" }, showRecentOnly: false };
    case "dueThisWeek":
      return { filters: { status: "", due: "this-week" }, showRecentOnly: false };
    case "recentUpdates":
      return {
        filters: { status: CLIENT_STATUS_FILTER_ALL, due: "" },
        showRecentOnly: true,
      };
  }
}
