"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import AttentionCenterCards from "@/components/attention/AttentionCenterCards";
import AttentionSidebar from "@/components/attention/AttentionSidebar";
import MyTasksWorkspace from "@/components/attention/MyTasksWorkspace";
import PriorityTasksPanel from "@/components/attention/PriorityTasksPanel";
import UserActivityFeed from "@/components/attention/UserActivityFeed";
import { useAttentionWorkspace } from "@/hooks/useAttentionWorkspace";
import type { AttentionFilterKey } from "@/lib/attention/attentionWorkspace";
import { notificationIcon } from "@/lib/tasks/notificationTypes";
import { formatPanelTimestamp } from "@/lib/tasks/taskPanel";
import { ui } from "@/lib/ui/classes";

type TodayViewProps = {
  userEmail: string;
};

function notificationHref(projectId: string | null, taskId: string | null): string | null {
  if (!projectId) return null;
  const params = new URLSearchParams({ project: projectId });
  if (taskId) params.set("task", taskId);
  return `/internal?${params.toString()}`;
}

export default function TodayView({ userEmail }: TodayViewProps) {
  const workspace = useAttentionWorkspace(userEmail);
  const [activeFilter, setActiveFilter] = useState<AttentionFilterKey | null>(null);
  const myTasksRef = useRef<HTMLDivElement>(null);
  const attentionRef = useRef<HTMLDivElement>(null);
  const waitingRef = useRef<HTMLDivElement>(null);
  const riskRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const waitingCount = workspace.attention.unansweredComments;

  const filteredNotifications = useMemo(() => {
    if (activeFilter !== "notifications") return workspace.notifications.slice(0, 8);
    return workspace.notifications;
  }, [activeFilter, workspace.notifications]);

  function handleFilterClick(filter: AttentionFilterKey) {
    setActiveFilter((prev) => (prev === filter ? null : filter));
    const target =
      filter === "myTasks"
        ? myTasksRef
        : filter === "attention"
          ? attentionRef
          : filter === "waiting"
            ? waitingRef
            : filter === "projectsAtRisk"
              ? riskRef
              : filter === "notifications"
                ? notificationsRef
                : null;
    target?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (workspace.loading) {
    return (
      <div className="rounded-lg border border-border bg-white px-4 py-8 text-sm text-muted">
        Loading your workspace…
      </div>
    );
  }

  if (workspace.error) {
    return (
      <div className={`${ui.alertError}`}>
        Could not load Attention Center: {workspace.error}
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <div className="min-w-0 flex-1 space-y-4">
        <section className={`${ui.card} px-4 py-3 sm:px-5`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-primary">Today</h1>
              <p className="mt-0.5 text-sm text-muted">
                Your proactive work dashboard — know what needs action now.
              </p>
            </div>
            <Link href="/internal" className={ui.btnSecondarySm}>
              Open projects
            </Link>
          </div>
          <div className="mt-3">
            <AttentionCenterCards
              myTasksStats={workspace.myTasksStats}
              attention={workspace.attention}
              unreadNotifications={workspace.unreadNotifications}
              projectsAtRiskCount={workspace.projectsAtRisk.length}
              waitingCount={waitingCount}
              activeFilter={activeFilter}
              onFilterClick={handleFilterClick}
            />
          </div>
        </section>

        <div ref={attentionRef} className={`${ui.card} px-4 py-3 sm:px-5`}>
          <PriorityTasksPanel
            tasks={workspace.priorityTasks}
            projects={workspace.projects}
            waitingTaskIds={workspace.waitingTaskIds}
            onUpdated={() => void workspace.refresh()}
          />
        </div>

        <div ref={myTasksRef} className={`${ui.card} px-4 py-3 sm:px-5`}>
          <MyTasksWorkspace
            stats={workspace.myTasksStats}
            tasks={workspace.myTasks}
            projects={workspace.projects}
            waitingTaskIds={workspace.waitingTaskIds}
            onUpdated={() => void workspace.refresh()}
          />
        </div>

        <div ref={waitingRef} className={`${ui.card} px-4 py-3 sm:px-5`}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Waiting For Response
          </h3>
          <p className="mt-1 text-xs text-muted">
            Client comments with no newer internal reply.
          </p>
          {waitingCount === 0 ? (
            <p className="mt-3 text-sm text-muted">No threads waiting for response.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {workspace.tasks
                .filter(
                  (task) =>
                    !task.parent_task_id &&
                    workspace.waitingTaskIds.has(task._uuid)
                )
                .slice(0, 10)
                .map((task) => (
                  <li
                    key={task._uuid}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-primary">
                        💬 #{task.id} {task.Issue}
                      </p>
                      <p className="text-xs text-muted">
                        {
                          workspace.projects.find(
                            (project) => project.id === task.project_id
                          )?.name
                        }
                      </p>
                    </div>
                    <Link
                      href={`/internal?project=${task.project_id ?? ""}&task=${task._uuid}&reply=1`}
                      className={ui.btnSecondarySm}
                    >
                      Reply
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div ref={riskRef} className={`${ui.card} px-4 py-3 sm:px-5`}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Projects At Risk
          </h3>
          {workspace.projectsAtRisk.length === 0 ? (
            <p className="mt-3 text-sm text-muted">All projects look healthy.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {workspace.projectsAtRisk.map((project) => (
                <li
                  key={project.projectId}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-primary">
                        {project.projectName}
                      </p>
                      <p className="text-xs text-muted">
                        {project.reasons.join(" · ")}
                      </p>
                    </div>
                    <Link
                      href={`/internal?project=${project.projectId}`}
                      className={ui.btnSecondarySm}
                    >
                      Open
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div ref={notificationsRef} className={`${ui.card} px-4 py-3 sm:px-5`}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Recent Notifications
          </h3>
          {filteredNotifications.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No notifications yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
              {filteredNotifications.map((notification) => {
                const href = notificationHref(
                  notification.project_id,
                  notification.task_id
                );
                return (
                  <li
                    key={notification.id}
                    className={`px-3 py-2 ${notification.read_at ? "bg-white" : "bg-blue-50/40"}`}
                  >
                    <p className="text-sm font-medium text-primary">
                      {notificationIcon(notification.title)} {notification.title}
                    </p>
                    {notification.body ? (
                      <p className="text-xs text-muted">{notification.body}</p>
                    ) : null}
                    <p className="text-[10px] text-muted">
                      {formatPanelTimestamp(notification.created_at)}
                    </p>
                    {href ? (
                      <Link
                        href={href}
                        className="text-xs font-semibold text-accent hover:underline"
                      >
                        Open task
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <section className={`${ui.card} px-4 py-3 sm:px-5`}>
          <UserActivityFeed entries={workspace.userActivity} />
        </section>
      </div>

      <AttentionSidebar
        attentionCount={workspace.attention.totalCount}
        waitingCount={waitingCount}
        unreadNotifications={workspace.unreadNotifications}
        myTasksCount={workspace.myTasksStats.open}
        activeFilter={activeFilter}
        onFilterClick={handleFilterClick}
      />
    </div>
  );
}
