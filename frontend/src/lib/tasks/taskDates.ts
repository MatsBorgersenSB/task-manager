export function taskDateValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export type DueStatus = "none" | "overdue" | "soon" | "normal";

/** Labels for the due-date legend shown in table and calendar views. */
export const DUE_STATUS_LEGEND = [
  { icon: "🔴", label: "Overdue" },
  { icon: "🟡", label: "Due soon" },
  { icon: "🟢", label: "Planned" },
] as const;

/** Classify a due date relative to today (overdue / due within 3 days / future). */
export function getDueStatus(dueDate: string | null | undefined): DueStatus {
  if (!dueDate) return "none";

  const normalized = taskDateValue(dueDate);
  if (!normalized) return "none";

  const parts = normalized.split("-").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return "none";
  }

  const today = new Date();
  const due = new Date(parts[0], parts[1] - 1, parts[2]);

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffDays = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return "overdue";
  if (diffDays <= 3) return "soon";
  return "normal";
}

const DUE_STATUS_BADGE_BASE =
  "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap";

/** Tailwind classes for due-date status in table cells. */
export function dueStatusClassName(status: DueStatus): string {
  switch (status) {
    case "overdue":
      return `${DUE_STATUS_BADGE_BASE} border border-red-200 bg-red-100 text-red-950`;
    case "soon":
      return `${DUE_STATUS_BADGE_BASE} border border-amber-200 bg-amber-100 text-amber-950`;
    case "normal":
      return `${DUE_STATUS_BADGE_BASE} border border-green-200 bg-green-100 text-green-950`;
    default:
      return "";
  }
}

/** Emoji prefix for due-date status in table and calendar. */
export function dueStatusIcon(status: DueStatus): string {
  if (status === "overdue") return "🔴 ";
  if (status === "soon") return "🟡 ";
  if (status === "normal") return "🟢 ";
  return "";
}

/** CSS class names for react-big-calendar events (see globals.css). */
export function dueStatusCalendarClass(status: DueStatus): string {
  switch (status) {
    case "overdue":
      return "due-overdue";
    case "soon":
      return "due-soon";
    case "normal":
      return "due-planned";
    default:
      return "";
  }
}
