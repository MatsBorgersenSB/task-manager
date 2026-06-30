import type { AppUser } from "@/lib/tasks/types";

const MENTION_PATTERN = /@([a-zA-Z0-9._-]+)/g;

export function extractMentionHandles(message: string): string[] {
  const handles = new Set<string>();
  for (const match of message.matchAll(MENTION_PATTERN)) {
    const handle = match[1]?.trim().toLowerCase();
    if (handle) handles.add(handle);
  }
  return [...handles];
}

export function userIdsForMentions(
  message: string,
  users: AppUser[],
  excludeUserId?: string
): string[] {
  const handles = extractMentionHandles(message);
  if (handles.length === 0) return [];

  const handleSet = new Set(handles);
  return users
    .filter(
      (user) =>
        user.id !== excludeUserId &&
        handleSet.has(user.name.toLowerCase())
    )
    .map((user) => user.id);
}

export function renderMentionSegments(message: string): Array<{
  type: "text" | "mention";
  value: string;
}> {
  const segments: Array<{ type: "text" | "mention"; value: string }> = [];
  let lastIndex = 0;

  for (const match of message.matchAll(MENTION_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: "text", value: message.slice(lastIndex, index) });
    }
    segments.push({ type: "mention", value: match[0] });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < message.length) {
    segments.push({ type: "text", value: message.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: message }];
}
