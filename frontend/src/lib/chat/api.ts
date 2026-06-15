"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import type { ChatMessage } from "@/lib/chat/types";

type ChatMessageRow = {
  id: string;
  user_id: string;
  message: string;
  mentioned_user_ids: string[] | null;
  created_at: string;
  profiles: { email: string } | { email: string }[] | null;
};

function mapChatMessageRow(row: ChatMessageRow): ChatMessage {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    user_id: row.user_id,
    message: row.message,
    mentioned_user_ids: row.mentioned_user_ids ?? [],
    created_at: row.created_at,
    author_email: profile?.email ?? null,
  };
}

export async function fetchChatMessages(): Promise<ChatMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("internal_chat_messages")
    .select(
      "id, user_id, message, mentioned_user_ids, created_at, profiles:user_id (email)"
    )
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return ((data ?? []) as ChatMessageRow[]).map(mapChatMessageRow);
}

export async function sendChatMessage(
  message: string,
  mentionedUserIds: string[]
): Promise<ChatMessage> {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error("Message cannot be empty.");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to chat.");
  }

  const { data, error } = await supabase
    .from("internal_chat_messages")
    .insert({
      user_id: user.id,
      message: trimmed,
      mentioned_user_ids: mentionedUserIds,
    })
    .select(
      "id, user_id, message, mentioned_user_ids, created_at, profiles:user_id (email)"
    )
    .single();

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return mapChatMessageRow(data as ChatMessageRow);
}

export function useInternalChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    setError(null);
    try {
      const next = await fetchChatMessages();
      setMessages(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load chat.";
      if (message.toLowerCase().includes("internal_chat_messages")) {
        setError("Chat is not available yet. Run migration 015_internal_chat.sql.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("internal-chat")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "internal_chat_messages",
        },
        () => {
          void loadMessages();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadMessages]);

  return {
    messages,
    loading,
    error,
    reload: loadMessages,
    sendMessage: sendChatMessage,
  };
}

export function chatAuthorLabel(
  message: ChatMessage,
  currentUserId: string | null
): string {
  if (currentUserId && message.user_id === currentUserId) {
    return "You";
  }
  if (message.author_email) {
    return message.author_email.split("@")[0] || message.author_email;
  }
  return "User";
}

export function formatChatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
