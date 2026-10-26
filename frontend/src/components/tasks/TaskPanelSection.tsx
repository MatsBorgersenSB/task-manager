"use client";

import type { ReactNode } from "react";
import { ui } from "@/lib/ui/classes";

type TaskPanelSectionProps = {
  title: string;
  children: ReactNode;
  first?: boolean;
  action?: ReactNode;
};

export default function TaskPanelSection({
  title,
  children,
  first = false,
  action,
}: TaskPanelSectionProps) {
  return (
    <section
      className={`space-y-3 ${first ? "" : "border-t border-border/50 pt-4"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className={ui.panelSectionTitle}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
