"use client";

import Link from "next/link";
import {
  canAccessInternalView,
  viewModeLabel,
  viewPathForMode,
} from "@/lib/viewAccess";
import type { TaskViewMode } from "@/lib/tasks/types";

type ViewModeSwitchProps = {
  currentMode: TaskViewMode;
  userRole?: string | null;
  projectId?: string | null;
};

function viewBadgeClass(mode: TaskViewMode): string {
  return mode === "internal"
    ? "border-amber-300/60 bg-amber-400 text-amber-950"
    : "border-sky-300/60 bg-sky-400 text-sky-950";
}

function ViewModeBadge({ mode }: { mode: TaskViewMode }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider shadow-sm ${viewBadgeClass(mode)}`}
      aria-current="page"
    >
      {viewModeLabel(mode)}
    </span>
  );
}

const tabClass = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
    active
      ? "bg-white text-[#0B2A2F] shadow-sm"
      : "text-white/85 hover:bg-white/10 hover:text-white"
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
      <div className="inline-flex rounded-lg border border-white/25 bg-white/5 p-0.5">
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
