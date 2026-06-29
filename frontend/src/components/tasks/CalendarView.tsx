"use client";

import { useMemo } from "react";
import { Calendar, dateFnsLocalizer, type Event } from "react-big-calendar";
import { format, getDay, parse, startOfWeek } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import type { Task } from "@/lib/tasks/types";
import {
  dueStatusCalendarClass,
  getDueStatus,
} from "@/lib/tasks/taskDates";
import { normalizeDateInput } from "@/lib/tasks/utils";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export type CalendarDateMode = "due" | "intervention" | "completed";

export const CALENDAR_DATE_MODE_LABELS: Record<CalendarDateMode, string> = {
  due: "Due Date",
  intervention: "Intervention Date",
  completed: "Completed Date",
};

export type TaskCalendarEvent = Event & {
  task: Task;
};

function taskCalendarDateForMode(
  task: Task,
  dateMode: CalendarDateMode
): string | null {
  switch (dateMode) {
    case "due":
      return normalizeDateInput(task["Date Due"]);
    case "intervention":
      return normalizeDateInput(
        task["Intervention Date"] ?? task.intervention_date
      );
    case "completed":
      return normalizeDateInput(task["Date Completed"]);
    default:
      return null;
  }
}

function parseCalendarDate(value: string): Date | null {
  const parts = value.split("-").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }
  const [year, month, day] = parts;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

type CalendarViewProps = {
  tasks: Task[];
  dateMode: CalendarDateMode;
  onSelectTask?: (task: Task) => void;
};

export default function CalendarView({
  tasks,
  dateMode,
  onSelectTask,
}: CalendarViewProps) {
  const events = useMemo(() => {
    const next: TaskCalendarEvent[] = [];

    for (const task of tasks) {
      const dateValue = taskCalendarDateForMode(task, dateMode);
      if (!dateValue) continue;

      const start = parseCalendarDate(dateValue);
      if (!start) continue;

      const issue = (task.Issue ?? "").trim() || `Task #${task.id}`;
      const areaCode = (task.areaCode ?? "").trim() || "—";

      next.push({
        title: `${issue} (${areaCode})`,
        start,
        end: start,
        allDay: true,
        task,
      });
    }

    return next;
  }, [tasks, dateMode]);

  const modeLabel = CALENDAR_DATE_MODE_LABELS[dateMode];

  function eventPropGetter(event: TaskCalendarEvent) {
    if (dateMode !== "due") return {};

    const status = getDueStatus(event.task["Date Due"]);
    const statusClass = dueStatusCalendarClass(status);
    if (!statusClass) return {};

    return { className: statusClass };
  }

  return (
    <div className="task-calendar px-4 pb-6 pt-2 print:hidden">
      {events.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          No tasks with a {modeLabel.toLowerCase()} match the current filters.
        </p>
      ) : (
        <div className="h-[min(70vh,720px)] min-h-[520px]">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            views={["month", "week", "day", "agenda"]}
            defaultView="month"
            popup
            eventPropGetter={eventPropGetter}
            onSelectEvent={(event: TaskCalendarEvent) =>
              onSelectTask?.(event.task)
            }
          />
        </div>
      )}
    </div>
  );
}
