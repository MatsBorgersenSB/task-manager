"use client";

import {
  GANTT_TIMELINE_SCALES,
  GANTT_TIMELINE_SCALE_CONFIG,
  type GanttTimelineScale,
} from "@/lib/tasks/ganttTimelineScale";
import { ui } from "@/lib/ui/classes";

type GanttTimelineScaleSelectorProps = {
  value: GanttTimelineScale;
  onChange: (scale: GanttTimelineScale) => void;
  disabled?: boolean;
};

export default function GanttTimelineScaleSelector({
  value,
  onChange,
  disabled = false,
}: GanttTimelineScaleSelectorProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Gantt timeline scale"
    >
      <span className={ui.toolbarGroupLabel}>Timeline</span>
      <div className={ui.segmentGroup}>
        {GANTT_TIMELINE_SCALES.map((scale) => {
          const config = GANTT_TIMELINE_SCALE_CONFIG[scale];
          const active = value === scale;
          return (
            <button
              key={scale}
              type="button"
              disabled={disabled}
              title={config.description}
              aria-pressed={active}
              onClick={() => onChange(scale)}
              className={active ? ui.segmentBtnActive : ui.segmentBtn}
            >
              {config.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
