"use client";

import type { ReactNode } from "react";

type TaskPanelSectionProps = {
  title: string;
  children: ReactNode;
  variant?: "default" | "danger";
  first?: boolean;
};

export default function TaskPanelSection({
  title,
  children,
  variant = "default",
  first = false,
}: TaskPanelSectionProps) {
  const borderClass =
    variant === "danger" ? "border-red-200" : "border-border";
  const titleClass =
    variant === "danger"
      ? "text-sm font-semibold text-red-700"
      : "text-xs font-semibold uppercase tracking-wide text-muted";

  return (
    <section
      className={`space-y-4 ${first ? "" : `border-t ${borderClass} pt-6`}`}
    >
      <h3 className={titleClass}>{title}</h3>
      {children}
    </section>
  );
}
