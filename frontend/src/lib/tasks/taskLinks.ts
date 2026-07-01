import type {
  LegacyTaskLinkType,
  Task,
  TaskLink,
  TaskLinkType,
} from "@/lib/tasks/types";

export type { TaskLink, TaskLinkType };

export const LINK_TYPE_OPTIONS: TaskLinkType[] = [
  "web_link",
  "document",
  "photo",
  "video",
  "drawing",
  "onedrive_file",
  "sharepoint_file",
  "outlook_email",
  "other",
];

const LINK_TYPES = new Set<TaskLinkType>(LINK_TYPE_OPTIONS);

const LEGACY_TYPE_MAP: Record<LegacyTaskLinkType, TaskLinkType> = {
  file: "document",
  image: "photo",
  link: "web_link",
  email: "outlook_email",
  folder: "sharepoint_file",
};

/** Map display labels and legacy slugs to canonical type keys. */
const TYPE_LABEL_MAP: Record<string, TaskLinkType> = {
  web_link: "web_link",
  "web link": "web_link",
  link: "web_link",
  document: "document",
  photo: "photo",
  image: "photo",
  video: "video",
  drawing: "drawing",
  onedrive_file: "onedrive_file",
  "onedrive file": "onedrive_file",
  onedrive: "onedrive_file",
  sharepoint_file: "sharepoint_file",
  "sharepoint file": "sharepoint_file",
  sharepoint: "sharepoint_file",
  folder: "sharepoint_file",
  outlook_email: "outlook_email",
  "outlook email": "outlook_email",
  email: "outlook_email",
  other: "other",
  file: "document",
};

function slugToTypeKey(value: string): TaskLinkType | null {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return TYPE_LABEL_MAP[normalized] ?? null;
}

/**
 * Parse legacy combined values such as "Document — Burner Test Report"
 * that were mistakenly stored in the type field.
 */
function splitLegacyCombinedType(value: string): {
  typeKey: string;
  embeddedTitle?: string;
} {
  const match = value.match(/^(.+?)\s*[—\-]\s*(.+)$/);
  if (!match) return { typeKey: value };

  const prefix = match[1].trim();
  const suffix = match[2].trim();
  const mapped = slugToTypeKey(prefix);
  if (mapped) {
    return { typeKey: mapped, embeddedTitle: suffix };
  }
  return { typeKey: value };
}

export function normalizeLinkType(value: unknown): TaskLinkType {
  if (typeof value !== "string" || !value.trim()) return "other";

  const { typeKey } = splitLegacyCombinedType(value);
  if (LINK_TYPES.has(typeKey as TaskLinkType)) {
    return typeKey as TaskLinkType;
  }

  const fromLabel = slugToTypeKey(typeKey);
  if (fromLabel) return fromLabel;

  if (typeKey in LEGACY_TYPE_MAP) {
    return LEGACY_TYPE_MAP[typeKey as LegacyTaskLinkType];
  }

  return "other";
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

/** Normalize a single link (type mapping + legacy combined-type repair). */
export function normalizeTaskLink(link: TaskLink): TaskLink {
  const rawType = link.type;
  const { embeddedTitle } =
    typeof rawType === "string"
      ? splitLegacyCombinedType(rawType)
      : { embeddedTitle: undefined };

  const type = normalizeLinkType(rawType);
  const name = link.name.trim() || embeddedTitle?.trim() || extractFileName(link.url);

  return { ...link, type, name };
}

/** Parse and validate links from Supabase JSONB (normalizes legacy types). */
export function parseTaskLinks(raw: unknown): TaskLink[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isTaskLink).map((link) => normalizeTaskLink(link));
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

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|heic|tiff?)(\?|$)/i;
const VIDEO_EXT = /\.(mp4|mov|avi|wmv|webm|mkv|m4v)(\?|$)/i;
const DRAWING_EXT = /\.(dwg|dxf|dgn|rvt|ifc|step|stp|iges|igs)(\?|$)/i;
const DOCUMENT_EXT =
  /\.(pdf|docx?|xlsx?|pptx?|csv|txt|rtf|odt|ods|odp)(\?|$)/i;

/** Infer link type from URL and optional file extension. */
export function inferLinkType(url: string): TaskLinkType {
  const lower = url.trim().toLowerCase();
  if (!lower) return "web_link";

  if (lower.startsWith("mailto:") || lower.includes("outlook.office.com")) {
    return "outlook_email";
  }
  if (lower.includes("sharepoint.com")) {
    return "sharepoint_file";
  }
  if (lower.includes("onedrive.live.com") || lower.includes("1drv.ms")) {
    return "onedrive_file";
  }
  if (IMAGE_EXT.test(lower)) {
    return "photo";
  }
  if (VIDEO_EXT.test(lower)) {
    return "video";
  }
  if (DRAWING_EXT.test(lower)) {
    return "drawing";
  }
  if (DOCUMENT_EXT.test(lower)) {
    return "document";
  }
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    return "web_link";
  }

  return "other";
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
    case "web_link":
      return "Web Link";
    case "document":
      return "Document";
    case "photo":
      return "Photo";
    case "video":
      return "Video";
    case "drawing":
      return "Drawing";
    case "onedrive_file":
      return "OneDrive File";
    case "sharepoint_file":
      return "SharePoint File";
    case "outlook_email":
      return "Outlook Email";
    case "other":
      return "Other";
    default:
      return "Other";
  }
}

export function linkTypeIcon(type: TaskLinkType): string {
  switch (type) {
    case "web_link":
      return "🔗";
    case "document":
      return "📄";
    case "photo":
      return "📷";
    case "video":
      return "🎬";
    case "drawing":
      return "📐";
    case "onedrive_file":
      return "☁️";
    case "sharepoint_file":
      return "📁";
    case "outlook_email":
      return "📧";
    case "other":
      return "📎";
    default:
      return "🔗";
  }
}
