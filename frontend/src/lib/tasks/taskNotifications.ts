import {
  notifyDueDateChanged,
  notifyFeedEntry,
  notifyProjectAcknowledged,
  notifyTaskAssigned,
  notifyTaskCompleted,
} from "@/lib/tasks/notifications";
import { logProjectActivity, type ProjectActivityEventType } from "@/lib/tasks/projectActivity";
import { parseSbOwners, formatSbOwners } from "@/lib/tasks/sbOwners";
import {
  getPanelDraftValue,
  type TaskPanelDraft,
} from "@/lib/tasks/taskPanel";
import type { AppUser, Task } from "@/lib/tasks/types";
import { isTaskComplete } from "@/lib/tasks/taskDates";

function addedSbOwners(previous: string | null | undefined, next: string | null | undefined): string[] {
  const prev = new Set(parseSbOwners(previous).map((owner) => owner.toLowerCase()));
  return parseSbOwners(next).filter((owner) => !prev.has(owner.toLowerCase()));
}

export async function notifyTaskFieldChange(input: {
  previous: Task;
  updated: Task;
  fieldName: keyof Task;
  projectId: string;
  users: AppUser[];
}): Promise<void> {
  const { previous, updated, fieldName, projectId, users } = input;

  if (fieldName === "Date Due") {
    const oldDue = (previous["Date Due"] ?? "").trim();
    const newDue = (updated["Date Due"] ?? "").trim();
    if (oldDue !== newDue) {
      void notifyDueDateChanged({
        projectId,
        task: updated,
        users,
        newDueDate: newDue || null,
      });
      void logProjectActivity({
        projectId,
        taskId: updated._uuid,
        eventType: "due_date_changed",
        summary: "Due date changed",
        detail: newDue || "No due date",
        clientVisible: true,
      });
    }
    return;
  }

  if (fieldName === "SB Owner") {
    const newOwners = addedSbOwners(previous["SB Owner"], updated["SB Owner"]);
    if (newOwners.length > 0) {
      void notifyTaskAssigned({
        projectId,
        task: updated,
        users,
        newOwners,
      });
    }
    return;
  }

  if (fieldName === "status" || fieldName === "Date Completed") {
    if (!isTaskComplete(previous) && isTaskComplete(updated)) {
      void notifyTaskCompleted({ projectId, task: updated, users });
      void logProjectActivity({
        projectId,
        taskId: updated._uuid,
        eventType: "task_completed",
        summary: "Task completed",
        detail: (updated.Issue ?? "").trim() || undefined,
        clientVisible: true,
      });
    }
  }
}

function draftString(
  draft: TaskPanelDraft,
  fieldName: string
): string | null {
  const value = getPanelDraftValue(draft, fieldName);
  if (Array.isArray(value)) {
    return formatSbOwners(value) || null;
  }
  const trimmed = (value ?? "").trim();
  return trimmed || null;
}

export async function notifyPanelSaveChanges(input: {
  previousDraft: TaskPanelDraft;
  nextDraft: TaskPanelDraft;
  task: Task;
  projectId: string;
  users: AppUser[];
}): Promise<void> {
  const previousOwners = formatSbOwners(input.previousDraft.sbOwners);
  const nextOwners = formatSbOwners(input.nextDraft.sbOwners);
  const previousTask: Task = {
    ...input.task,
    "Date Due": draftString(input.previousDraft, "Date Due"),
    "SB Owner": previousOwners || null,
    status: draftString(input.previousDraft, "status"),
    "Date Completed": draftString(input.previousDraft, "Date Completed"),
  };
  const updatedTask: Task = {
    ...input.task,
    "Date Due": draftString(input.nextDraft, "Date Due"),
    "SB Owner": nextOwners || null,
    status: draftString(input.nextDraft, "status"),
    "Date Completed": draftString(input.nextDraft, "Date Completed"),
  };

  await notifyTaskFieldChange({
    previous: previousTask,
    updated: updatedTask,
    fieldName: "Date Due",
    projectId: input.projectId,
    users: input.users,
  });
  await notifyTaskFieldChange({
    previous: previousTask,
    updated: updatedTask,
    fieldName: "SB Owner",
    projectId: input.projectId,
    users: input.users,
  });
  await notifyTaskFieldChange({
    previous: previousTask,
    updated: updatedTask,
    fieldName: "status",
    projectId: input.projectId,
    users: input.users,
  });
}

export async function notifyAcknowledgement(input: {
  task: Task;
  projectId: string;
}): Promise<void> {
  void notifyProjectAcknowledged({
    projectId: input.projectId,
    task: input.task,
  });
}

export async function notifyProjectFeedEvent(input: {
  projectId: string;
  task?: Task | null;
  eventType: ProjectActivityEventType;
  summary: string;
  detail?: string | null;
  clientVisible?: boolean;
  users: AppUser[];
}): Promise<void> {
  void logProjectActivity({
    projectId: input.projectId,
    taskId: input.task?._uuid,
    eventType: input.eventType,
    summary: input.summary,
    detail: input.detail,
    clientVisible: input.clientVisible,
  });

  if (input.clientVisible) {
    void notifyFeedEntry({
      projectId: input.projectId,
      taskId: input.task?._uuid,
      summary: input.summary,
      detail: input.detail,
      users: input.users,
      task: input.task,
    });
  }
}
