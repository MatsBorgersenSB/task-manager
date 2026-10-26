"use client";

import { useMemo } from "react";
import {
  boardLabelBarClass,
  boardLabelChipClass,
  type ProjectBoardLabel,
  type ProjectBucket,
} from "@/lib/tasks/boardMeta";
import {
  computeAreaReadiness,
  computeOwnerWorkload,
} from "@/lib/tasks/pmAnalytics";
import { getTaskDueStatus, isTaskComplete } from "@/lib/tasks/taskDates";
import type { Task } from "@/lib/tasks/types";
import { ui } from "@/lib/ui/classes";

type ChartsViewProps = {
  tasks: Task[];
  buckets: ProjectBucket[];
  labels: ProjectBoardLabel[];
};

function BarRow({
  label,
  count,
  total,
  barClass,
}: {
  label: string;
  count: number;
  total: number;
  barClass: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium text-primary">{label}</span>
        <span className="text-muted">
          {count} · {pct}%
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function ChartsView({ tasks, buckets, labels }: ChartsViewProps) {
  const mainTasks = useMemo(
    () => tasks.filter((task) => !task.parent_task_id),
    [tasks]
  );
  const total = mainTasks.length;

  const statusCounts = useMemo(() => {
    const completed = mainTasks.filter(isTaskComplete).length;
    const overdue = mainTasks.filter(
      (task) => getTaskDueStatus(task) === "overdue"
    ).length;
    const soon = mainTasks.filter(
      (task) => getTaskDueStatus(task) === "soon"
    ).length;
    const open = Math.max(0, total - completed);
    return { completed, overdue, soon, open };
  }, [mainTasks, total]);

  const bucketCounts = useMemo(() => {
    return buckets.map((bucket) => ({
      label: bucket.name,
      count: mainTasks.filter((task) => task.bucket_id === bucket.id).length,
    }));
  }, [buckets, mainTasks]);

  const labelCounts = useMemo(() => {
    return labels.map((label) => ({
      label: label.name,
      color: label.color,
      count: mainTasks.filter((task) =>
        (task.board_label_ids ?? []).includes(label.id)
      ).length,
    }));
  }, [labels, mainTasks]);

  const areaReadiness = useMemo(() => computeAreaReadiness(tasks), [tasks]);
  const ownerWorkload = useMemo(() => computeOwnerWorkload(tasks), [tasks]);

  if (total === 0) {
    return (
      <p className="px-6 py-12 text-center text-sm text-muted print:hidden">
        No tasks to chart yet.
      </p>
    );
  }

  return (
    <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5 print:hidden">
      <section className={`p-5 ${ui.card}`}>
        <h3 className="text-sm font-semibold text-primary">Progress</h3>
        <p className="mt-1 text-xs text-muted">{total} main tasks</p>
        <div className="mt-4 space-y-3">
          <BarRow
            label="Open"
            count={statusCounts.open}
            total={total}
            barClass="bg-sky-500"
          />
          <BarRow
            label="Completed"
            count={statusCounts.completed}
            total={total}
            barClass="bg-emerald-500"
          />
          <BarRow
            label="Overdue"
            count={statusCounts.overdue}
            total={total}
            barClass="bg-red-500"
          />
          <BarRow
            label="Due soon"
            count={statusCounts.soon}
            total={total}
            barClass="bg-amber-500"
          />
        </div>
      </section>

      <section className={`p-5 ${ui.card}`}>
        <h3 className="text-sm font-semibold text-primary">By bucket</h3>
        <div className="mt-4 space-y-3">
          {bucketCounts.length === 0 ? (
            <p className="text-sm text-muted">
              No custom buckets yet. Apply migration 057 and open Board to create
              them.
            </p>
          ) : (
            bucketCounts.map((row) => (
              <BarRow
                key={row.label}
                label={row.label}
                count={row.count}
                total={total}
                barClass="bg-accent"
              />
            ))
          )}
        </div>
      </section>

      <section className={`p-5 ${ui.card}`}>
        <h3 className="text-sm font-semibold text-primary">
          Area Readiness (All Work Items)
        </h3>
        <p className="mt-1 text-xs text-muted">
          Includes both main tasks and subtasks ({tasks.length} items)
        </p>
        <div className="mt-4 space-y-3">
          {areaReadiness.map((row) => (
            <BarRow
              key={row.area}
              label={row.area}
              count={row.completed}
              total={row.total}
              barClass="bg-emerald-500"
            />
          ))}
        </div>
      </section>

      <section className={`p-5 ${ui.card}`}>
        <h3 className="text-sm font-semibold text-primary">
          Owner Workload &amp; Intervention Hours
        </h3>
        <p className="mt-1 text-xs text-muted">
          Open assignments and planned field intervention hours
        </p>
        <div className="mt-4 space-y-2.5">
          {ownerWorkload.map((row) => (
            <div
              key={row.owner}
              className="flex items-center justify-between rounded-md border border-border/70 bg-background/50 px-3 py-2 text-sm"
            >
              <span className="font-medium text-primary">{row.owner}</span>
              <span className="text-xs text-muted">
                <strong className="text-primary">{row.openTasks}</strong> open
                {row.interventionHours > 0
                  ? ` · ${row.interventionHours}h planned`
                  : ""}
                {row.completedTasks > 0
                  ? ` · ${row.completedTasks} done`
                  : ""}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className={`p-5 sm:col-span-2 ${ui.card}`}>
        <h3 className="text-sm font-semibold text-primary">By label</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {labelCounts.length === 0 ? (
            <p className="text-sm text-muted">No labels configured yet.</p>
          ) : (
            labelCounts.map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${boardLabelChipClass(row.color)}`}
                  >
                    {row.label}
                  </span>
                  <span className="text-muted">{row.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${boardLabelBarClass(row.color)}`}
                    style={{
                      width: `${total > 0 ? Math.round((row.count / total) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
