"use client";

import Link from "next/link";
import {
  canAccessInternalView,
  viewModeLabel,
  viewPathForMode,
} from "@/lib/viewAccess";
import type { TaskViewMode } from "@/lib/tasks/types";
import { ui } from "@/lib/ui/classes";

type ViewModeSwitchProps = {
  currentMode: TaskViewMode;
  userRole?: string | null;
  projectId?: string | null;
};

function viewBadgeClass(mode: TaskViewMode): string {
  return mode === "internal"
    ? "border-amber-200 bg-amber-50 text-amber-900"
    : "border-sky-200 bg-sky-50 text-sky-900";
}

function ViewModeBadge({ mode }: { mode: TaskViewMode }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${viewBadgeClass(mode)}`}
      aria-current="page"
    >
      {viewModeLabel(mode)} view
    </span>
  );
}

const tabClass = (active: boolean) =>
  `${active ? ui.segmentBtnActive : ui.segmentBtn} !text-white/90 hover:!text-white ${
    active ? "!bg-white/15 !text-white !shadow-none !ring-white/20" : "hover:!bg-white/10"
  }`;

export default function ViewModeSwitch({
  currentMode,
  userRole,
  projectId,
}: ViewModeSwitchProps) {
  const canSwitch = canAccessInternalView(userRole);

  if (!canSwitch) {
    return <ViewModeBadge mode="client" />;
  }

  return (
    <nav
      className="inline-flex items-center gap-2"
      aria-label="Switch task view mode"
    >
      <ViewModeBadge mode={currentMode} />
      <div className={`${ui.segmentGroup} !border-white/20 !bg-white/5`}>
        <Link
          href={viewPathForMode("internal", projectId)}
          className={tabClass(currentMode === "internal")}
          aria-current={currentMode === "internal" ? "page" : undefined}
        >
          Internal
        </Link>
        <Link
          href={viewPathForMode("client", projectId)}
          className={tabClass(currentMode === "client")}
          aria-current={currentMode === "client" ? "page" : undefined}
        >
          Client
        </Link>
      </div>
    </nav>
  );
}
