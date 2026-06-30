import {
  computeProjectsAtRisk,
  computeWeightedAttention,
  type ProjectRiskSummary,
  type WeightedAttentionBreakdown,
} from "@/lib/attention/attentionEngine";
import {
  computeMyTasksWorkspaceStats,
  filterPriorityTasks,
  resolveUserHandle,
  sortMyTasksByPriority,
  type MyTasksWorkspaceStats,
} from "@/lib/attention/myTasksWorkspace";
import { fetchProjects } from "@/lib/projects/api";
import type { Project } from "@/lib/projects/types";
import { waitingTaskIdsFromSnapshots } from "@/lib/tasks/commentAttention";
import { fetchTasks } from "@/lib/tasks/api";
import {
  fetchUserNotifications,
  unreadNotificationCount,
  type EnrichedUserNotification,
} from "@/lib/tasks/notifications";
import { filterTasksForUser } from "@/lib/tasks/myTasks";
import type { Task } from "@/lib/tasks/types";
import { createClient } from "@/lib/supabase/client";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import { fetchUserActivityFeed, type UserActivityEntry } from "@/lib/attention/userActivityFeed";

export type AttentionFilterKey =
  | "myTasks"
  | "attention"
  | "notifications"
  | "projectsAtRisk"
  | "waiting";

export type AttentionWorkspaceSnapshot = {
  projects: Project[];
  tasks: Task[];
  waitingTaskIds: Set<string>;
  notifications: EnrichedUserNotification[];
  unreadNotifications: number;
  myTasksStats: MyTasksWorkspaceStats;
  attention: WeightedAttentionBreakdown;
  projectsAtRisk: ProjectRiskSummary[];
  myTasks: Task[];
  priorityTasks: Task[];
  userActivity: UserActivityEntry[];
  userHandle: string;
  loading: boolean;
  error: string | null;
};

function groupTasksByProject(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const task of tasks) {
    const projectId = task.project_id;
    if (!projectId) continue;
    const list = map.get(projectId) ?? [];
    list.push(task);
    map.set(projectId, list);
  }
  return map;
}

async function fetchAllWaitingTaskIds(taskIds: string[]): Promise<Set<string>> {
  if (taskIds.length === 0) return new Set();

  const supabase = createClient();
  const { data, error } = await supabase
    .from("comments")
    .select("task_id, type, created_at")
    .in("task_id", taskIds)
    .order("created_at", { ascending: true });

  if (error) {
    return new Set();
  }

  return waitingTaskIdsFromSnapshots(
    (data ?? []) as { task_id: string; type: "client" | "internal"; created_at: string }[]
  );
}

export async function loadAttentionWorkspace(
  userEmail: string
): Promise<Omit<AttentionWorkspaceSnapshot, "loading">> {
  const [projects, tasks, notificationResult, userActivity] = await Promise.all([
    fetchProjects(true),
    fetchTasks("internal"),
    fetchUserNotifications(50),
    fetchUserActivityFeed(30),
  ]);

  const mainTaskIds = tasks
    .filter((task) => !task.parent_task_id)
    .map((task) => task._uuid);
  const waitingTaskIds = await fetchAllWaitingTaskIds(mainTaskIds);

  const userHandle = resolveUserHandle(userEmail);
  const tasksByProject = groupTasksByProject(tasks);
  const projectsAtRisk = computeProjectsAtRisk({
    projects,
    tasksByProject,
    waitingTaskIds,
  });

  const attention = computeWeightedAttention({
    tasks,
    waitingTaskIds,
    projectsAtRisk: projectsAtRisk.length,
  });

  const myTasks = sortMyTasksByPriority(
    filterTasksForUser(
      tasks.filter((task) => !task.parent_task_id),
      userHandle
    ).filter((task) => task.status !== "Complete" && !task["Date Completed"]),
    waitingTaskIds
  );

  const priorityTasks = sortMyTasksByPriority(
    filterPriorityTasks(tasks, userHandle, waitingTaskIds),
    waitingTaskIds
  );

  const myTasksStats = computeMyTasksWorkspaceStats(tasks, userHandle);

  return {
    projects,
    tasks,
    waitingTaskIds,
    notifications: notificationResult.notifications,
    unreadNotifications: unreadNotificationCount(notificationResult.notifications),
    myTasksStats,
    attention,
    projectsAtRisk,
    myTasks,
    priorityTasks,
    userActivity,
    userHandle,
    error: notificationResult.error,
  };
}

export function attentionWorkspaceErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return supabaseErrorMessage(error as { message: string });
  }
  return "Failed to load workspace.";
}
