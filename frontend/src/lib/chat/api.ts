"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrCreateInternalConversation } from "@/lib/chat/conversations";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import type { ChatMessage } from "@/lib/chat/types";

type ChatMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  profiles: { email: string } | { email: string }[] | null;
};

function mapChatMessageRow(row: ChatMessageRow): ChatMessage {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    user_id: row.sender_id,
    message: row.content,
    mentioned_user_ids: [],
    created_at: row.created_at,
    author_email: profile?.email ?? null,
  };
}

export async function checkChatAvailable(): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("conversations")
    .select("id", { head: true, count: "exact" });
  return !error;
}

export async function fetchChatMessages(conversationId: string): Promise<ChatMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, content, created_at, profiles:sender_id (email)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return ((data ?? []) as ChatMessageRow[]).map(mapChatMessageRow);
}

export async function sendChatMessage(
  message: string,
  mentionedUserIds: string[] = []
): Promise<{ chatMessage: ChatMessage; conversationId: string }> {
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

  const activeConversationId = await getOrCreateInternalConversation(
    user.id,
    mentionedUserIds
  );

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: activeConversationId,
      sender_id: user.id,
      content: trimmed,
    })
    .select(
      "id, conversation_id, sender_id, content, created_at, profiles:sender_id (email)"
    )
    .single();

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return {
    chatMessage: mapChatMessageRow(data as ChatMessageRow),
    conversationId: activeConversationId,
  };
}

export function useInternalChat() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatAvailable, setChatAvailable] = useState(false);

  const loadMessages = useCallback(async (activeConversationId: string) => {
    setError(null);
    try {
      const next = await fetchChatMessages(activeConversationId);
      setMessages(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);

      const available = await checkChatAvailable();
      if (cancelled) return;

      setChatAvailable(available);
      if (!available) {
        setError("Chat is not available.");
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        setError("You must be signed in to chat.");
        setLoading(false);
        return;
      }

      try {
        const activeConversationId = await getOrCreateInternalConversation(user.id);
        if (cancelled) return;

        setConversationId(activeConversationId);
        await loadMessages(activeConversationId);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load chat.");
        setLoading(false);
      }
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, [loadMessages]);

  useEffect(() => {
    if (!chatAvailable || !conversationId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`internal-chat:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          void loadMessages(conversationId);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatAvailable, conversationId, loadMessages]);

  const sendMessage = useCallback(
    async (message: string, mentionedUserIds: string[] = []) => {
      const { chatMessage, conversationId: activeConversationId } =
        await sendChatMessage(message, mentionedUserIds);
      setConversationId(activeConversationId);
      await loadMessages(activeConversationId);
      return chatMessage;
    },
    [loadMessages]
  );

  return {
    messages,
    loading,
    error,
    chatAvailable,
    conversationId,
    reload: () => (conversationId ? loadMessages(conversationId) : Promise.resolve()),
    sendMessage,
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
