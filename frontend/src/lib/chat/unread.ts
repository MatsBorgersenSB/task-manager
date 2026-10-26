import { createClient } from "@/lib/supabase/client";
import { getOrCreateInternalConversation } from "@/lib/chat/conversations";
import { messageMentionsHandle } from "@/lib/chat/mentions";
import {
  isMissingColumnError,
  type SupabaseErrorLike,
} from "@/lib/supabase/schemaFallback";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import type { ChatMessage } from "@/lib/chat/types";

export type ChatNotificationSummary = {
  conversationId: string | null;
  lastReadAt: string | null;
  unreadCount: number;
  mentionCount: number;
};

export type ParticipantRow = {
  conversation_id: string;
  last_read_at: string | null;
};

type MessageRow = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

const LOCAL_STORAGE_PREFIX = "sb_chat_last_read_at";

function getLocalLastReadAt(
  userId: string,
  conversationId: string
): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      window.localStorage.getItem(
        `${LOCAL_STORAGE_PREFIX}:${userId}:${conversationId}`
      ) ?? null
    );
  } catch {
    return null;
  }
}

function setLocalLastReadAt(
  userId: string,
  conversationId: string,
  readAt: string
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${LOCAL_STORAGE_PREFIX}:${userId}:${conversationId}`,
      readAt
    );
  } catch {
    // Ignore storage quota or privacy mode errors.
  }
}

export async function resolveParticipationWithFallback(options: {
  queryWithLastRead: () => PromiseLike<{
    data: ParticipantRow | null;
    error: SupabaseErrorLike;
  }>;
  queryWithoutLastRead: () => PromiseLike<{
    data: { conversation_id: string } | null;
    error: SupabaseErrorLike;
  }>;
  getFallbackLastReadAt: (conversationId: string) => string | null;
}): Promise<ParticipantRow | null> {
  const first = await options.queryWithLastRead();
  if (!first.error) {
    if (!first.data) return null;
    const fallbackReadAt = options.getFallbackLastReadAt(
      first.data.conversation_id
    );
    return {
      conversation_id: first.data.conversation_id,
      last_read_at: first.data.last_read_at ?? fallbackReadAt,
    };
  }

  if (!isMissingColumnError(first.error, "last_read_at")) {
    throw new Error(supabaseErrorMessage(first.error));
  }

  const second = await options.queryWithoutLastRead();
  if (second.error) {
    throw new Error(supabaseErrorMessage(second.error));
  }

  if (!second.data) return null;

  return {
    conversation_id: second.data.conversation_id,
    last_read_at: options.getFallbackLastReadAt(second.data.conversation_id),
  };
}

export async function updateLastReadWithFallback(options: {
  conversationId: string;
  readAt: string;
  updateDb: () => PromiseLike<{ error: SupabaseErrorLike }>;
  saveFallbackLastReadAt: (conversationId: string, readAt: string) => void;
}): Promise<void> {
  options.saveFallbackLastReadAt(options.conversationId, options.readAt);

  const { error } = await options.updateDb();
  if (!error) return;

  if (isMissingColumnError(error, "last_read_at")) {
    return;
  }

  throw new Error(supabaseErrorMessage(error));
}

export async function fetchPrimaryParticipation(
  userId: string
): Promise<ParticipantRow | null> {
  const supabase = createClient();
  const sharedConversationId = await getOrCreateInternalConversation(userId);

  return resolveParticipationWithFallback({
    queryWithLastRead: () =>
      supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", userId)
        .eq("conversation_id", sharedConversationId)
        .limit(1)
        .maybeSingle(),
    queryWithoutLastRead: () =>
      supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", userId)
        .eq("conversation_id", sharedConversationId)
        .limit(1)
        .maybeSingle(),
    getFallbackLastReadAt: (conversationId) =>
      getLocalLastReadAt(userId, conversationId),
  });
}

export async function markConversationRead(
  conversationId: string,
  userId: string
): Promise<void> {
  const supabase = createClient();
  const readAt = new Date().toISOString();

  await updateLastReadWithFallback({
    conversationId,
    readAt,
    updateDb: () =>
      supabase
        .from("conversation_participants")
        .update({ last_read_at: readAt })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId),
    saveFallbackLastReadAt: (convId, iso) =>
      setLocalLastReadAt(userId, convId, iso),
  });
}

function isAfterLastRead(createdAt: string, lastReadAt: string | null): boolean {
  if (!lastReadAt) return true;
  return new Date(createdAt).getTime() > new Date(lastReadAt).getTime();
}

export function summarizeUnreadMessages(
  messages: MessageRow[],
  currentUserId: string,
  currentUserHandle: string,
  lastReadAt: string | null
): Pick<ChatNotificationSummary, "unreadCount" | "mentionCount"> {
  let unreadCount = 0;
  let mentionCount = 0;

  for (const message of messages) {
    if (message.sender_id === currentUserId) continue;
    if (!isAfterLastRead(message.created_at, lastReadAt)) continue;

    unreadCount += 1;
    if (messageMentionsHandle(message.content, currentUserHandle)) {
      mentionCount += 1;
    }
  }

  return { unreadCount, mentionCount };
}

export async function fetchChatNotifications(
  userId: string,
  currentUserHandle: string
): Promise<ChatNotificationSummary> {
  const participation = await fetchPrimaryParticipation(userId);
  if (!participation) {
    return {
      conversationId: null,
      lastReadAt: null,
      unreadCount: 0,
      mentionCount: 0,
    };
  }

  const supabase = createClient();
  let query = supabase
    .from("messages")
    .select("id, sender_id, content, created_at")
    .eq("conversation_id", participation.conversation_id)
    .order("created_at", { ascending: true });

  if (participation.last_read_at) {
    query = query.gt("created_at", participation.last_read_at);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  const counts = summarizeUnreadMessages(
    (data ?? []) as MessageRow[],
    userId,
    currentUserHandle,
    participation.last_read_at
  );

  return {
    conversationId: participation.conversation_id,
    lastReadAt: participation.last_read_at,
    ...counts,
  };
}

export function isChatMessageUnread(
  message: ChatMessage,
  currentUserId: string | null,
  lastReadAt: string | null
): boolean {
  if (!currentUserId || message.user_id === currentUserId) return false;
  return isAfterLastRead(message.created_at, lastReadAt);
}

export function isChatMessageMention(
  message: ChatMessage,
  currentUserHandle: string
): boolean {
  return messageMentionsHandle(message.message, currentUserHandle);
}
