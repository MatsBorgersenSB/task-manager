"use client";

import { useState } from "react";
import { acknowledgeTask } from "@/lib/tasks/api";
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

  if (mode !== "client") {
    if (!task.acknowledged_at) return null;
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-900">
        <p className="font-medium">Acknowledged by Client</p>
        <p className="mt-0.5 text-xs text-green-800">
          {formatPanelTimestamp(task.acknowledged_at)}
        </p>
      </div>
    );
  }

  if (task.acknowledged_at) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-900">
        <p className="font-medium">✓ Acknowledged</p>
        <p className="mt-0.5 text-xs text-green-800">
          {formatPanelTimestamp(task.acknowledged_at)}
        </p>
      </div>
    );
  }

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

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleAcknowledge()}
        className={`${ui.btnPrimarySm} disabled:opacity-50`}
      >
        {busy ? "Saving…" : "✓ Acknowledge"}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
