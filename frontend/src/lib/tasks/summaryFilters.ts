import type { Task, TaskFilters } from "@/lib/tasks/types";
import { CLIENT_STATUS_FILTER_ALL } from "@/lib/tasks/constants";
import { RECENT_WINDOW_MINUTES } from "@/lib/tasks/recentTasks";
import { isTaskComplete } from "@/lib/tasks/taskDates";

export type SummaryFilterKey =
  | "open"
  | "completed"
  | "overdue"
  | "dueThisWeek"
  | "waiting"
  | "recentUpdates"
  | "clientActivity"
  | "attentionRequired"
  | "unacknowledged"
  | "myTasks";

export const SUMMARY_FILTER_TOOLTIPS: Record<SummaryFilterKey, string> = {
  open: "Tasks not marked completed",
  completed: "Tasks marked complete",
  overdue: "Tasks with due date before today",
  dueThisWeek: "Tasks due within the next 7 days",
  waiting: "Open tasks with client comments awaiting an internal response",
  recentUpdates: "Tasks updated within the last 60 minutes",
  clientActivity:
    "Client comments, acknowledgements, and updates in the last 7 days",
  attentionRequired:
    "Overdue tasks, tasks due within 24 hours, and unanswered client comments",
  unacknowledged:
    "Open client-visible tasks not yet acknowledged or updated since last acknowledgement",
  myTasks: "Tasks assigned to your name or account handle",
};

export const PROJECT_PROGRESS_TOOLTIP =
  "Completed main tasks and subtasks divided by total work items. Subtasks count toward overall progress.";

/** Banner title when a summary card filter is active. */
export const SUMMARY_FILTER_BANNER_LABELS: Record<SummaryFilterKey, string> = {
  open: "Open Tasks",
  completed: "Completed Tasks",
  overdue: "Overdue Tasks",
  dueThisWeek: "Due This Week",
  waiting: "Waiting For Response",
  recentUpdates: "Recent Updates",
  clientActivity: "Client Activity",
  attentionRequired: "Attention Required",
  unacknowledged: "Needs Acknowledgement",
  myTasks: "Assigned To Me",
};

export const SUMMARY_FILTER_LABELS = SUMMARY_FILTER_BANNER_LABELS;

/** Returns true if a task was modified significantly after it was acknowledged. */
export function isTaskAcknowledgementStale(task: Task): boolean {
  if (!task.acknowledged_at || !task._updatedAt) return false;
  const ackMs = Date.parse(task.acknowledged_at);
  const updMs = Date.parse(task._updatedAt);
  if (Number.isNaN(ackMs) || Number.isNaN(updMs)) return false;
  return updMs - ackMs > 5_000;
}

/** Returns true when an open task requires client acknowledgement (unacknowledged or stale after update). */
export function isUnacknowledgedClientTask(task: Task): boolean {
  if (isTaskComplete(task)) return false;
  if (!task.acknowledged_at) return true;
  return isTaskAcknowledgementStale(task);
}

/** Filter patch applied when a summary KPI chip is clicked. */
export function summaryFilterPatch(
  key: SummaryFilterKey
): {
  filters: Partial<TaskFilters>;
  showRecentOnly: boolean;
  clientActivityOnly?: boolean;
  attentionOnly?: boolean;
  waitingOnly?: boolean;
  myTasksOnly?: boolean;
  unacknowledgedOnly?: boolean;
} {
  switch (key) {
    case "open":
      return { filters: { status: "", due: "" }, showRecentOnly: false };
    case "completed":
      return { filters: { status: "Complete", due: "" }, showRecentOnly: false };
    case "overdue":
      return { filters: { status: "", due: "overdue" }, showRecentOnly: false };
    case "dueThisWeek":
      return { filters: { status: "", due: "this-week" }, showRecentOnly: false };
    case "waiting":
      return {
        filters: { status: "", due: "" },
        showRecentOnly: false,
        waitingOnly: true,
      };
    case "recentUpdates":
      return {
        filters: { status: CLIENT_STATUS_FILTER_ALL, due: "" },
        showRecentOnly: true,
      };
    case "clientActivity":
      return {
        filters: { status: CLIENT_STATUS_FILTER_ALL, due: "" },
        showRecentOnly: false,
        clientActivityOnly: true,
      };
    case "attentionRequired":
      return {
        filters: { status: "", due: "" },
        showRecentOnly: false,
        attentionOnly: true,
      };
    case "unacknowledged":
      return {
        filters: { status: "", due: "" },
        showRecentOnly: false,
        unacknowledgedOnly: true,
      };
    case "myTasks":
      return {
        filters: { status: "", due: "" },
        showRecentOnly: false,
        myTasksOnly: true,
      };
  }
}

export { RECENT_WINDOW_MINUTES };
