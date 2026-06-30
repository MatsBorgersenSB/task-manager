"use client";

import Link from "next/link";
import { useState } from "react";
import { updateTask } from "@/lib/tasks/api";
import type { Task } from "@/lib/tasks/types";
import { ui } from "@/lib/ui/classes";

type QuickTaskActionsProps = {
  task: Task;
  projectId: string | null | undefined;
  waiting?: boolean;
  compact?: boolean;
  onUpdated?: () => void;
};

function taskHref(task: Task, projectId: string | null | undefined): string {
  const params = new URLSearchParams();
  if (projectId) params.set("project", projectId);
  params.set("task", task._uuid);
  return `/internal?${params.toString()}`;
}

export default function QuickTaskActions({
  task,
  projectId,
  waiting = false,
  compact = false,
  onUpdated,
}: QuickTaskActionsProps) {
  const [saving, setSaving] = useState(false);

  async function markComplete() {
    setSaving(true);
    try {
      await updateTask("internal", task._uuid, {
        status: "Complete",
        "Date Completed": new Date().toISOString().slice(0, 10),
      });
      onUpdated?.();
    } finally {
      setSaving(false);
    }
  }

  const btnClass = compact ? "text-[11px] font-semibold text-accent hover:underline" : ui.btnSecondarySm;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {waiting ? (
        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-900">
          💬 Waiting
        </span>
      ) : null}
      <Link href={taskHref(task, projectId)} className={btnClass}>
        Open
      </Link>
      <Link
        href={`${taskHref(task, projectId)}&reply=1`}
        className={btnClass}
      >
        Reply
      </Link>
      <button
        type="button"
        disabled={saving || task.status === "Complete"}
        onClick={() => void markComplete()}
        className={btnClass}
      >
        {saving ? "Saving…" : "Complete"}
      </button>
    </div>
  );
}
