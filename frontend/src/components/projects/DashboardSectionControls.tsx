"use client";

import {
  DASHBOARD_SECTION_LABELS,
  type DashboardSectionId,
  type DashboardSectionVisibility,
} from "@/lib/projects/dashboardSections";

type DashboardSectionControlsProps = {
  sections: DashboardSectionVisibility;
  hiddenSections: DashboardSectionId[];
  onSetVisible: (id: DashboardSectionId, visible: boolean) => void;
  onShowAll: () => void;
};

export function DashboardSectionHideButton({
  label,
  onHide,
}: {
  label: string;
  onHide: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onHide}
      className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted transition hover:text-primary"
      aria-label={`Hide ${label}`}
    >
      Hide
    </button>
  );
}

export function HiddenSectionPlaceholder({
  label,
  onShow,
}: {
  label: string;
  onShow: () => void;
}) {
  return (
    <div className="no-print flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2">
      <span className="text-xs text-muted">{label} hidden</span>
      <button
        type="button"
        onClick={onShow}
        className="text-xs font-semibold text-accent hover:underline"
      >
        Show
      </button>
    </div>
  );
}

export default function DashboardSectionControls({
  sections,
  hiddenSections,
  onSetVisible,
  onShowAll,
}: DashboardSectionControlsProps) {
  return (
    <div className="no-print flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">
        Dashboard sections
      </span>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(sections) as DashboardSectionId[]).map((id) => {
          const visible = sections[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSetVisible(id, !visible)}
              aria-pressed={visible}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                visible
                  ? "bg-white text-primary ring-1 ring-slate-200"
                  : "bg-slate-200/80 text-muted line-through"
              }`}
            >
              {DASHBOARD_SECTION_LABELS[id]}
            </button>
          );
        })}
      </div>
      {hiddenSections.length > 0 ? (
        <button
          type="button"
          onClick={onShowAll}
          className="ml-auto text-xs font-semibold text-accent hover:underline"
        >
          Show all
        </button>
      ) : null}
    </div>
  );
}
