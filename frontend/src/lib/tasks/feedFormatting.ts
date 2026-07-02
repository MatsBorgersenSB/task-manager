import type { ProjectActivityEntry } from "@/lib/tasks/projectActivity";

function actorName(entry: ProjectActivityEntry): string {
  return entry.author_name ?? "Someone";
}

export function formatProjectFeedHeadline(entry: ProjectActivityEntry): string {
  const actor = actorName(entry);
  const taskRef =
    entry.task_number != null ? `task #${entry.task_number}` : "a task";

  switch (entry.event_type) {
    case "task_created":
      return `${actor} created ${taskRef}`;
    case "due_date_changed":
      return `${actor} changed due date on ${taskRef}`;
    case "client_comment_added":
      return `${actor} added a client comment`;
    case "internal_comment_added":
      return `${actor} added an internal note`;
    case "subtask_completed":
      return `${actor} completed a subtask`;
    case "project_shared":
      return `${actor} shared the project with client`;
    case "link_added":
      return `${actor} added a link`;
    case "client_task_opened":
      return entry.summary.includes(actor)
        ? entry.summary
        : `${actor} opened ${taskRef}`;
    case "client_project_viewed":
      return `${actor} viewed the project`;
    case "client_acknowledged":
      return `${actor} acknowledged completion`;
    case "status_changed":
      return `${actor} changed status on ${taskRef}`;
    case "task_completed":
      return `${actor} completed ${taskRef}`;
    case "project_generated_from_template":
      return `${actor} created the project from a template`;
    default:
      if (entry.summary.trim()) {
        return entry.summary.includes(actor)
          ? entry.summary
          : `${actor}: ${entry.summary}`;
      }
      return `${actor} updated the project`;
  }
}

export function formatProjectFeedEditLine(entry: ProjectActivityEntry): string | null {
  if (!entry.updated_by || !entry.updated_at) return null;
  if (entry.updated_at === entry.created_at) return null;

  const editor = entry.editor_name ?? "Someone";
  return `Edited by ${editor}`;
}
