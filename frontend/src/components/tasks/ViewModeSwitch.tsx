"use client";

import Link from "next/link";
import {
  canAccessInternalView,
  viewPathForMode,
} from "@/lib/viewAccess";
import type { TaskViewMode } from "@/lib/tasks/types";

type ViewModeSwitchProps = {
  currentMode: TaskViewMode;
  userRole?: string | null;
  projectId?: string | null;
};

const tabClass = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-xs font-semibold transition ${
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
    return (
      <span
        className="inline-flex items-center rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
        aria-current="page"
      >
        Client View
      </span>
    );
  }

  return (
    <nav
      className="inline-flex rounded-lg border border-white/25 bg-white/5 p-0.5"
      aria-label="Switch task view mode"
    >
      <Link
        href={viewPathForMode("internal", projectId)}
        className={tabClass(currentMode === "internal")}
        aria-current={currentMode === "internal" ? "page" : undefined}
      >
        Internal View
      </Link>
      <Link
        href={viewPathForMode("client", projectId)}
        className={tabClass(currentMode === "client")}
        aria-current={currentMode === "client" ? "page" : undefined}
      >
        Client View
      </Link>
    </nav>
  );
}
