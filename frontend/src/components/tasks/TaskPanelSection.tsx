"use client";

import type { ReactNode } from "react";

type TaskPanelSectionProps = {
  title: string;
  children: ReactNode;
  first?: boolean;
};

export default function TaskPanelSection({
  title,
  children,
  first = false,
}: TaskPanelSectionProps) {
  return (
    <section
      className={`space-y-4 ${first ? "" : "border-t border-border pt-6"}`}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}
