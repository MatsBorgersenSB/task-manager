"use client";

import { useState } from "react";
import { acknowledgeTask } from "@/lib/tasks/api";
import { isTaskAcknowledgementStale } from "@/lib/tasks/summaryFilters";
import { isTaskComplete } from "@/lib/tasks/taskDates";
import { formatPanelTimestamp } from "@/lib/tasks/taskPanel";
import type { Task, TaskViewMode } from "@/lib/tasks/types";
import { ui } from "@/lib/ui/classes";

type TaskAcknowledgeSectionProps = {
  task: Task;
  mode: TaskViewMode;
  projectId?: string | null;
  onAcknowledged?: (task: Task) => void;
};

export default function TaskAcknowledgeSection({
  task,
  mode,
  projectId,
  onAcknowledged,
}: TaskAcknowledgeSectionProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignOffEligible = Boolean(task.is_milestone) || isTaskComplete(task);
  const isStale = isTaskAcknowledgementStale(task);

  async function handleAcknowledge() {
    setBusy(true);
    setError(null);
    try {
      const updated = await acknowledgeTask(mode, task._uuid, projectId);
      onAcknowledged?.(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not acknowledge.");
    } finally {
      setBusy(false);
    }
  }

  if (mode !== "client") {
    if (!task.acknowledged_at) {
      if (!isSignOffEligible) return null;
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
          <p className="font-semibold">Awaiting Client Sign-Off</p>
          <p className="mt-0.5 text-amber-800">
            {task.is_milestone
              ? "Milestone requires formal client sign-off in Project Portal."
              : "Completed item has not been signed off by the client yet."}
          </p>
        </div>
      );
    }

    if (isStale) {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <p className="font-medium">
            ⚠ Client Acknowledgement Stale (Task Updated)
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            Previously acknowledged {formatPanelTimestamp(task.acknowledged_at)} — modified{" "}
            {formatPanelTimestamp(task._updatedAt ?? undefined)}
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-900">
        <p className="font-medium">
          {isSignOffEligible
            ? "✓ Formally Signed Off by Client"
            : "✓ Acknowledged by Client"}
        </p>
        <p className="mt-0.5 text-xs text-green-800">
          {formatPanelTimestamp(task.acknowledged_at)}
        </p>
      </div>
    );
  }

  if (task.acknowledged_at && !isStale) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-900">
        <p className="font-medium">
          {isSignOffEligible
            ? "✓ Signed Off & Accepted"
            : "✓ Acknowledged"}
        </p>
        <p className="mt-0.5 text-xs text-green-800">
          {formatPanelTimestamp(task.acknowledged_at)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {isStale && task.acknowledged_at ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
          This task was updated since your last acknowledgement (
          {formatPanelTimestamp(task.acknowledged_at)}). Please review and confirm.
        </div>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleAcknowledge()}
        className={`${ui.btnPrimarySm} disabled:opacity-50`}
      >
        {busy
          ? "Saving…"
          : isSignOffEligible
            ? "✓ Sign Off & Accept Work"
            : isStale
              ? "✓ Re-Acknowledge Update"
              : "✓ Acknowledge"}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
