import type {
  LegacyTaskLinkType,
  Task,
  TaskLink,
  TaskLinkType,
} from "@/lib/tasks/types";

export type { TaskLink, TaskLinkType };

const LINK_TYPES: TaskLinkType[] = ["document", "photo", "email", "folder"];

const LEGACY_TYPE_MAP: Record<LegacyTaskLinkType, TaskLinkType> = {
  file: "document",
  image: "photo",
  link: "document",
};

export function normalizeLinkType(value: unknown): TaskLinkType {
  if (typeof value !== "string") return "document";
  if (LINK_TYPES.includes(value as TaskLinkType)) {
    return value as TaskLinkType;
  }
  if (value in LEGACY_TYPE_MAP) {
    return LEGACY_TYPE_MAP[value as LegacyTaskLinkType];
  }
  if (value === "folder") return "folder";
  return "document";
}

function isTaskLink(value: unknown): value is TaskLink {
  if (!value || typeof value !== "object") return false;
  const link = value as Record<string, unknown>;
  return (
    typeof link.id === "string" &&
    typeof link.name === "string" &&
    typeof link.url === "string" &&
    typeof link.type === "string"
  );
}

/** Parse and validate links from Supabase JSONB (normalizes legacy types). */
export function parseTaskLinks(raw: unknown): TaskLink[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isTaskLink).map((link) => ({
    ...link,
    type: normalizeLinkType(link.type),
  }));
}

/** Strip internal-only task fields for client view (links remain visible). */
export function sanitizeTaskForExternal(task: Task): Task {
  const {
    Priority: _priority,
    "Response or Action taken by SB": _actionComment,
    _updatedBy,
    _createdByRole,
    _createdByEmail,
    ...safe
  } = task;
  return safe;
}

export function createTaskLinkId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `link-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Guess link type from URL (SharePoint, OneDrive, Outlook). */
export function inferLinkType(url: string): TaskLinkType {
  const lower = url.toLowerCase();

  if (lower.startsWith("mailto:") || lower.includes("outlook.office")) {
    return "email";
  }
  if (/\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(lower)) {
    return "photo";
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
    lower.includes("sharepoint.com") ||
    lower.includes("1drv.ms") ||
    lower.includes(":x:/") ||
    lower.includes(":b:/") ||
    lower.includes("/personal/")
  ) {
    return "document";
  }
  return "document";
}

export function extractFileName(url: string): string {
  try {
    if (url.toLowerCase().startsWith("mailto:")) {
      return url.replace(/^mailto:/i, "").split("?")[0] || "Email";
    }
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
    case "document":
      return "Document";
    case "photo":
      return "Photo";
    case "email":
      return "Email";
    case "folder":
      return "Folder";
    default:
      return "Document";
  }
}

export function linkTypeIcon(type: TaskLinkType): string {
  switch (type) {
    case "document":
      return "📄";
    case "photo":
      return "📷";
    case "email":
      return "📧";
    case "folder":
      return "📁";
    default:
      return "📄";
  }
}

export const LINK_TYPE_OPTIONS: TaskLinkType[] = [
  "document",
  "photo",
  "email",
  "folder",
];

/** Example labels for link management UI. */
export const LINK_TYPE_EXAMPLES: Record<TaskLinkType, string> = {
  document: "Burner Test Report",
  photo: "Installation Photo",
  email: "Client Correspondence",
  folder: "SharePoint Project Folder",
};
