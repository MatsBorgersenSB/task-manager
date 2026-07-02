"use client";

import type { ReactNode } from "react";
import { ui } from "@/lib/ui/classes";

type WorkspaceZoneProps = {
  label?: string;
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
};

/**
 * Groups related workspace controls into a labelled surface area
 * (Project, Statistics, Actions, Views, Data).
 */
export default function WorkspaceZone({
  label,
  title,
  actions,
  children,
  className = "",
  noPadding = false,
}: WorkspaceZoneProps) {
  const hasHeader = label || title || actions;

  return (
    <section className={`${ui.zone} ${className}`}>
      {hasHeader ? (
        <div className={ui.zoneHeader}>
          <div className="min-w-0">
            {label ? (
              <p className={ui.zoneLabel}>{label}</p>
            ) : null}
            {title ? (
              <h2 className={title ? ui.textSubtitle : undefined}>{title}</h2>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={noPadding ? "" : ui.zoneBody}>{children}</div>
    </section>
  );
}
