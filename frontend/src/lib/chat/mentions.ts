import type { AppUser } from "@/lib/tasks/types";

export function userMentionHandle(user: AppUser): string {
  if (user.name?.trim()) return user.name.trim();
  const email = user.email ?? "";
  return email.split("@")[0] || email || "user";
}

export function findActiveMentionQuery(
  text: string,
  cursor: number
): { query: string; start: number } | null {
  const before = text.slice(0, cursor);
  const match = /(^|\s)@([\w.-]*)$/.exec(before);
  if (!match) return null;
  const query = match[2] ?? "";
  const start = before.length - query.length - 1;
  return { query, start };
}

export function filterUsersForMention(users: AppUser[], query: string): AppUser[] {
  const normalized = query.toLowerCase();
  if (!normalized) return users;
  return users.filter((user) => {
    const handle = userMentionHandle(user).toLowerCase();
    const email = (user.email ?? "").toLowerCase();
    return handle.includes(normalized) || email.includes(normalized);
  });
}

export function parseMentionedUserIds(message: string, users: AppUser[]): string[] {
  const handles = new Map<string, string>();
  for (const user of users) {
    handles.set(userMentionHandle(user).toLowerCase(), user.id);
  }

  const mentioned = new Set<string>();
  const pattern = /@([\w.-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(message)) !== null) {
    const id = handles.get(match[1].toLowerCase());
    if (id) mentioned.add(id);
  }
  return [...mentioned];
}

export function insertMentionAt(
  text: string,
  cursor: number,
  handle: string
): { nextText: string; nextCursor: number } {
  const active = findActiveMentionQuery(text, cursor);
  if (active) {
    const before = text.slice(0, active.start);
    const after = text.slice(cursor);
    const mention = `@${handle} `;
    const nextText = `${before}${mention}${after}`;
    return { nextText, nextCursor: before.length + mention.length };
  }

  const before = text.slice(0, cursor);
  const after = text.slice(cursor);
  const mention = `@${handle} `;
  const nextText = `${before}${mention}${after}`;
  return { nextText, nextCursor: before.length + mention.length };
}

const MENTION_PATTERN = /(@[\w.-]+)/g;

export function splitMessageWithMentions(text: string): Array<{ type: "text" | "mention"; value: string }> {
  const parts: Array<{ type: "text" | "mention"; value: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = MENTION_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "mention", value: match[1] });
    lastIndex = match.index + match[1].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return parts.length ? parts : [{ type: "text", value: text }];
}
