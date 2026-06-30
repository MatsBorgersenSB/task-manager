"use client";

import {
  SECTION_COLLAPSE_LABELS,
  type SectionCollapseId,
  useSectionCollapse,
} from "@/lib/projects/dashboardSectionCollapse";

type CollapsibleDashboardSectionProps = {
  sectionId: SectionCollapseId;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
};

export default function CollapsibleDashboardSection({
  sectionId,
  children,
  className = "",
  headerActions,
}: CollapsibleDashboardSectionProps) {
  const { collapsed, toggle } = useSectionCollapse(sectionId);
  const label = SECTION_COLLAPSE_LABELS[sectionId];

  return (
    <section className={`rounded-lg border border-border/80 bg-white ${className}`}>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-semibold uppercase tracking-wide text-muted transition hover:text-primary"
          aria-expanded={!collapsed}
        >
          <span aria-hidden>{collapsed ? "▼" : "▲"}</span>
          <span>{label}</span>
        </button>
        {headerActions}
      </div>
      {!collapsed ? (
        <div className="border-t border-border/70 px-3 pb-3 pt-2">{children}</div>
      ) : null}
    </section>
  );
}
