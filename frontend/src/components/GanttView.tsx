"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from "react";
import { Gantt, type Task as GanttTask } from "gantt-task-react";
import GanttTimelineScaleSelector from "@/components/tasks/GanttTimelineScaleSelector";
import {
  buildGanttTasks,
  formatGanttTooltipDate,
} from "@/lib/tasks/ganttTasks";
import {
  GANTT_TIMELINE_SCALE_CONFIG,
  ganttViewDateForScale,
  persistGanttTimelineScale,
  readGanttTimelineScale,
  type GanttTimelineScale,
} from "@/lib/tasks/ganttTimelineScale";
import { DUE_STATUS_LEGEND } from "@/lib/tasks/taskDates";
import { formatAreaCodeOnly } from "@/lib/tasks/areas";
import type { Task } from "@/lib/tasks/types";
import "gantt-task-react/dist/index.css";

type GanttViewProps = {
  tasks: Task[];
  onSelectTask?: (task: Task) => void;
};

const GANTT_LEGEND = [
  ...DUE_STATUS_LEGEND,
  { icon: "◆", label: "Milestone" },
  { icon: "🟣", label: "Critical" },
] as const;

const GANTT_TODAY_COLOR = "rgba(16, 185, 129, 0.16)";
const GANTT_MILESTONE_COLOR = "#d97706";
const GANTT_MILESTONE_SELECTED_COLOR = "#b45309";

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
    <div className="max-w-xs rounded-lg border border-gray-300 bg-white px-4 py-3 text-xs text-gray-900 shadow-[0_8px_20px_rgba(0,0,0,0.12)]">
      <p className="font-semibold text-primary">{issue}</p>
      {source.is_milestone ? (
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
          Milestone
        </p>
      ) : null}
      {source.is_critical ? (
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
          Critical
        </p>
      ) : null}
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
  const [timelineScale, setTimelineScale] = useState<GanttTimelineScale>(() =>
    readGanttTimelineScale()
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollRatioRef = useRef<number | null>(null);

  const scaleConfig = GANTT_TIMELINE_SCALE_CONFIG[timelineScale];
  const viewDate = useMemo(
    () => ganttViewDateForScale(timelineScale),
    [timelineScale]
  );

  const { ganttTasks, taskById } = useMemo(
    () => buildGanttTasks(tasks),
    [tasks]
  );

  const TooltipContent = useMemo<
    FC<{
      task: GanttTask;
      fontSize: string;
      fontFamily: string;
    }> | undefined
  >(() => {
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
    Math.max(280, ganttTasks.length * 48 + 88)
  );

  const handleScaleChange = useCallback((next: GanttTimelineScale) => {
    const container = scrollRef.current;
    if (container) {
      const maxScroll = container.scrollWidth - container.clientWidth;
      if (maxScroll > 0) {
        scrollRatioRef.current = container.scrollLeft / maxScroll;
      }
    }

    setTimelineScale(next);
    persistGanttTimelineScale(next);
  }, []);

  useLayoutEffect(() => {
    const ratio = scrollRatioRef.current;
    if (ratio == null) return;

    const container = scrollRef.current;
    scrollRatioRef.current = null;
    if (!container) return;

    requestAnimationFrame(() => {
      const maxScroll = container.scrollWidth - container.clientWidth;
      if (maxScroll > 0) {
        container.scrollLeft = ratio * maxScroll;
      }
    });
  }, [timelineScale, ganttTasks.length]);

  if (tasks.length === 0) {
    return (
      <p className="px-6 py-12 text-center text-sm text-muted print:hidden">
        No tasks available for current filters.
      </p>
    );
  }

  return (
    <div className="task-gantt px-4 pb-6 pt-2 print:hidden">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3 gap-y-2">
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted"
          aria-label="Gantt legend"
        >
          <span className="font-semibold text-primary/80">Legend</span>
          {GANTT_LEGEND.map(({ icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1">
              <span aria-hidden>{icon}</span>
              {label}
            </span>
          ))}
        </div>

        <GanttTimelineScaleSelector
          value={timelineScale}
          onChange={handleScaleChange}
        />
      </div>

      <div
        ref={scrollRef}
        className="overflow-x-auto scroll-smooth rounded-lg border border-border bg-white shadow-sm"
      >
        <div className="min-w-[960px]">
          <Gantt
            key={timelineScale}
            tasks={ganttTasks}
            viewMode={scaleConfig.viewMode}
            viewDate={viewDate}
            locale="en-GB"
            listCellWidth="240px"
            columnWidth={scaleConfig.columnWidth}
            headerHeight={scaleConfig.headerHeight}
            rowHeight={48}
            ganttHeight={ganttHeight}
            barCornerRadius={4}
            barFill={68}
            todayColor={GANTT_TODAY_COLOR}
            milestoneBackgroundColor={GANTT_MILESTONE_COLOR}
            milestoneBackgroundSelectedColor={GANTT_MILESTONE_SELECTED_COLOR}
            TooltipContent={TooltipContent}
            onClick={(ganttTask) => {
              if (ganttTask.type === "project") return;
              const source = taskById.get(ganttTask.id);
              if (source) onSelectTask?.(source);
            }}
            onSelect={(ganttTask, isSelected) => {
              if (!isSelected || ganttTask.type === "project") return;
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
