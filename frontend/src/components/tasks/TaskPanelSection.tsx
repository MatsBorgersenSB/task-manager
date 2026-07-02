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
      className={`space-y-4 ${first ? "" : "border-t border-border/60 pt-6"}`}
    >
      <h3 className="text-sm font-semibold text-primary">{title}</h3>
      {children}
    </section>
  );
}
