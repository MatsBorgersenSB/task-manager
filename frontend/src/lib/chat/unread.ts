import { createClient } from "@/lib/supabase/client";
import { messageMentionsHandle } from "@/lib/chat/mentions";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import type { ChatMessage } from "@/lib/chat/types";

export type ChatNotificationSummary = {
  conversationId: string | null;
  lastReadAt: string | null;
  unreadCount: number;
  mentionCount: number;
};

type ParticipantRow = {
  conversation_id: string;
  last_read_at: string | null;
};

type MessageRow = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export async function fetchPrimaryParticipation(
  userId: string
): Promise<ParticipantRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("user_id", userId)
    .order("last_read_at", { ascending: false, nullsFirst: false })
    .maybeSingle();

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return data;
}

export async function markConversationRead(
  conversationId: string,
  userId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }
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
