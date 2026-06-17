import type { Task, TaskLink, TaskLinkType } from "@/lib/tasks/types";

const LINK_TYPES: TaskLinkType[] = ["file", "image", "folder", "link"];

function isTaskLinkType(value: unknown): value is TaskLinkType {
  return typeof value === "string" && LINK_TYPES.includes(value as TaskLinkType);
}

function isTaskLink(value: unknown): value is TaskLink {
  if (!value || typeof value !== "object") return false;
  const link = value as Record<string, unknown>;
  return (
    typeof link.id === "string" &&
    typeof link.name === "string" &&
    typeof link.url === "string" &&
    isTaskLinkType(link.type)
  );
}

/** Parse and validate links from Supabase JSONB. */
export function parseTaskLinks(raw: unknown): TaskLink[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isTaskLink);
}

/** Strip internal-only link data before exposing tasks to client view. */
export function sanitizeTaskForExternal(task: Task): Task {
  const { links: _links, ...safe } = task;
  return safe;
}

export function createTaskLinkId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `link-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Guess link type from URL (OneDrive / SharePoint friendly). */
export function inferLinkType(url: string): TaskLinkType {
  const lower = url.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(lower)) {
    return "image";
  }
  if (
    lower.includes(":f:/") ||
    lower.includes("/folders/") ||
    lower.includes("folder=") ||
    lower.includes("id=root")
  ) {
    return "folder";
  }
  if (
    lower.includes(":x:/") ||
    lower.includes(":b:/") ||
    lower.includes("/personal/") ||
    lower.includes("sharepoint.com") ||
    lower.includes("1drv.ms")
  ) {
    return "file";
  }
  return "link";
}

export function extractFileName(url: string): string {
  try {
    let decoded = decodeURIComponent(url);
    decoded = decoded.split("?")[0];
    decoded = decoded.replace(/:\w:\/r\//, "/");
    decoded = decoded.replace(/\/$/, "");

    const parts = decoded.split("/");
    const last = parts[parts.length - 1];

    return last || "Link";
  } catch {
    return "Link";
  }
}

export function linkTypeLabel(type: TaskLinkType): string {
  switch (type) {
    case "folder":
      return "Folder";
    case "file":
      return "File";
    case "image":
      return "Image";
    default:
      return "Link";
  }
}
