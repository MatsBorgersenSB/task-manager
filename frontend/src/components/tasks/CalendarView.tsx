"use client";

import { useMemo } from "react";
import { Calendar, dateFnsLocalizer, type Event } from "react-big-calendar";
import { format, getDay, parse, startOfWeek } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import type { Task } from "@/lib/tasks/types";
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

export type TaskCalendarEvent = Event & {
  task: Task;
};

function taskCalendarDate(task: Task): string | null {
  return (
    normalizeDateInput(task["Intervention Date"] ?? task.intervention_date) ??
    normalizeDateInput(task["Date Due"]) ??
    null
  );
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
  onSelectTask?: (task: Task) => void;
};

export default function CalendarView({ tasks, onSelectTask }: CalendarViewProps) {
  const events = useMemo(() => {
    const next: TaskCalendarEvent[] = [];

    for (const task of tasks) {
      const dateValue = taskCalendarDate(task);
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
  }, [tasks]);

  return (
    <div className="task-calendar px-4 pb-6 pt-2 print:hidden">
      {events.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          No tasks with an intervention or due date match the current filters.
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
            onSelectEvent={(event: TaskCalendarEvent) =>
              onSelectTask?.(event.task)
            }
          />
        </div>
      )}
    </div>
  );
}
