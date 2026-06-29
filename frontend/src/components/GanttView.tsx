"use client";

import { useMemo, type FC } from "react";
import { Gantt, ViewMode, type Task as GanttTask } from "gantt-task-react";
import {
  buildGanttTasks,
  formatGanttTooltipDate,
} from "@/lib/tasks/ganttTasks";
import { DUE_STATUS_LEGEND } from "@/lib/tasks/taskDates";
import { formatAreaCodeOnly } from "@/lib/tasks/areas";
import type { Task } from "@/lib/tasks/types";
import "gantt-task-react/dist/index.css";

type GanttViewProps = {
  tasks: Task[];
  onSelectTask?: (task: Task) => void;
};

function GanttTooltipContent({
  task,
  taskById,
}: {
  task: GanttTask;
  taskById: Map<string, Task>;
}) {
  if (task.type === "project") return null;

  const source = taskById.get(task.id);
  if (!source) return null;

  const issue = (source.Issue ?? "").trim() || `Task #${source.id}`;
  const area = formatAreaCodeOnly(source.areaCode) || "—";
  const status = (source.status ?? "").trim() || "—";
  const responsible = (source.Responsible ?? "").trim() || "—";

  return (
    <div className="max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-primary shadow-lg">
      <p className="font-semibold">{issue}</p>
      <dl className="mt-2 space-y-1 text-muted">
        <div className="flex justify-between gap-4">
          <dt>Area</dt>
          <dd className="font-medium text-primary">{area}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Status</dt>
          <dd className="font-medium text-primary">{status}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Responsible</dt>
          <dd className="font-medium text-primary">{responsible}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Due Date</dt>
          <dd className="font-medium text-primary">
            {formatGanttTooltipDate(source["Date Due"])}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Intervention Date</dt>
          <dd className="font-medium text-primary">
            {formatGanttTooltipDate(
              source["Intervention Date"] ?? source.intervention_date
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Completed Date</dt>
          <dd className="font-medium text-primary">
            {formatGanttTooltipDate(source["Date Completed"])}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default function GanttView({ tasks, onSelectTask }: GanttViewProps) {
  const { ganttTasks, taskById } = useMemo(
    () => buildGanttTasks(tasks),
    [tasks]
  );

  const TooltipContent = useMemo<FC<{
    task: GanttTask;
    fontSize: string;
    fontFamily: string;
  }> | undefined>(() => {
    function Tooltip(props: {
      task: GanttTask;
      fontSize: string;
      fontFamily: string;
    }) {
      return <GanttTooltipContent task={props.task} taskById={taskById} />;
    }
    return Tooltip;
  }, [taskById]);

  const ganttHeight = Math.min(
    720,
    Math.max(280, ganttTasks.length * 50 + 80)
  );

  if (tasks.length === 0) {
    return (
      <p className="px-6 py-12 text-center text-sm text-muted print:hidden">
        No tasks available for current filters.
      </p>
    );
  }

  return (
    <div className="task-gantt px-4 pb-6 pt-2 print:hidden">
      <div
        className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted"
        aria-label="Gantt legend"
      >
        <span className="font-semibold uppercase tracking-wide text-primary/70">
          Legend
        </span>
        {DUE_STATUS_LEGEND.map(({ icon, label }) => (
          <span key={label} className="inline-flex items-center gap-1">
            <span aria-hidden>{icon}</span>
            {label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <div className="min-w-[960px]">
          <Gantt
            tasks={ganttTasks}
            viewMode={ViewMode.Day}
            locale="en-GB"
            listCellWidth="220px"
            columnWidth={56}
            rowHeight={44}
            ganttHeight={ganttHeight}
            barCornerRadius={4}
            TooltipContent={TooltipContent}
            onClick={(ganttTask) => {
              if (ganttTask.type === "project") return;
              const source = taskById.get(ganttTask.id);
              if (source) onSelectTask?.(source);
            }}
            onDateChange={() => false}
            onProgressChange={() => false}
            onDelete={() => false}
          />
        </div>
      </div>
    </div>
  );
}
