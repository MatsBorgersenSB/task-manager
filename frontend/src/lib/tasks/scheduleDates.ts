import { normalizeDateInput } from "@/lib/tasks/utils";

/** Inclusive calendar days between two YYYY-MM-DD dates (same day = 1). */
export function inclusiveScheduleDays(
  fromDate: string,
  toDate: string
): number | null {
  const from = normalizeDateInput(fromDate);
  const to = normalizeDateInput(toDate);
  if (!from || !to) return null;

  const start = parseLocalDate(from);
  const end = parseLocalDate(to);
  if (!start || !end) return null;

  const diffMs = end.getTime() - start.getTime();
  const days = Math.floor(diffMs / 86_400_000) + 1;
  return days >= 1 ? days : null;
}

/** To date = From + (days - 1), inclusive. */
export function toDateFromStartAndDays(
  fromDate: string,
  days: number
): string | null {
  const from = normalizeDateInput(fromDate);
  if (!from || !Number.isFinite(days) || days < 1) return null;
  const start = parseLocalDate(from);
  if (!start) return null;
  start.setDate(start.getDate() + Math.floor(days) - 1);
  return formatLocalDate(start);
}

/** From date = To - (days - 1), inclusive. */
export function fromDateFromEndAndDays(
  toDate: string,
  days: number
): string | null {
  const to = normalizeDateInput(toDate);
  if (!to || !Number.isFinite(days) || days < 1) return null;
  const end = parseLocalDate(to);
  if (!end) return null;
  end.setDate(end.getDate() - (Math.floor(days) - 1));
  return formatLocalDate(end);
}

export type ScheduleFields = {
  fromDate: string;
  toDate: string;
  days: number | null;
};

export type ScheduleFieldKey = "fromDate" | "toDate" | "days";

/**
 * Linked schedule: change one of From / To / Days and fill the third when possible.
 * Preference: keep From stable when Days changes; keep Days when From/To change if known.
 */
export function applyScheduleFieldChange(
  current: ScheduleFields,
  field: ScheduleFieldKey,
  rawValue: string
): ScheduleFields {
  if (field === "days") {
    const trimmed = rawValue.trim();
    const days =
      trimmed === ""
        ? null
        : Math.max(1, Math.floor(Number.parseInt(trimmed, 10) || 0));
    if (days == null) {
      return { ...current, days: null };
    }
    if (current.fromDate) {
      const toDate = toDateFromStartAndDays(current.fromDate, days) ?? current.toDate;
      return { fromDate: current.fromDate, toDate, days };
    }
    if (current.toDate) {
      const fromDate =
        fromDateFromEndAndDays(current.toDate, days) ?? current.fromDate;
      return { fromDate, toDate: current.toDate, days };
    }
    return { ...current, days };
  }

  const nextDate = normalizeDateInput(rawValue) ?? "";

  if (field === "fromDate") {
    const fromDate = nextDate;
    if (fromDate && current.days != null && current.days >= 1) {
      const toDate = toDateFromStartAndDays(fromDate, current.days) ?? "";
      return { fromDate, toDate, days: current.days };
    }
    if (fromDate && current.toDate) {
      const days = inclusiveScheduleDays(fromDate, current.toDate);
      if (days != null) {
        return { fromDate, toDate: current.toDate, days };
      }
      // From after To — snap To to From (1 day)
      return { fromDate, toDate: fromDate, days: 1 };
    }
    return { fromDate, toDate: current.toDate, days: current.days };
  }

  // toDate
  const toDate = nextDate;
  if (toDate && current.days != null && current.days >= 1) {
    const fromDate =
      fromDateFromEndAndDays(toDate, current.days) ?? current.fromDate;
    return { fromDate, toDate, days: current.days };
  }
  if (toDate && current.fromDate) {
    const days = inclusiveScheduleDays(current.fromDate, toDate);
    if (days != null) {
      return { fromDate: current.fromDate, toDate, days };
    }
    // To before From — snap From to To (1 day)
    return { fromDate: toDate, toDate, days: 1 };
  }
  return { fromDate: current.fromDate, toDate, days: current.days };
}

function parseLocalDate(value: string): Date | null {
  const parts = value.split("-").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }
  const [year, month, day] = parts;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
