"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { checkChatAvailable } from "@/lib/chat/api";
import { fetchChatNotifications, markConversationRead } from "@/lib/chat/unread";
import { ui } from "@/lib/ui/classes";

type ChatPanelContextValue = {
  open: boolean;
  toggle: () => void;
  close: () => void;
  openPanel: () => void;
  unreadCount: number;
  mentionCount: number;
  lastReadAt: string | null;
  refreshNotifications: () => Promise<void>;
  markConversationAsRead: (conversationId: string) => Promise<void>;
};

const ChatPanelContext = createContext<ChatPanelContextValue | null>(null);

type ChatPanelProviderProps = {
  enabled: boolean;
  children: ReactNode;
};

function currentUserHandle(email: string | null | undefined): string {
  if (!email) return "user";
  return email.split("@")[0] || email;
}

export function ChatPanelProvider({ enabled, children }: ChatPanelProviderProps) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mentionCount, setMentionCount] = useState(0);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatAvailable, setChatAvailable] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const userHandleRef = useRef("user");

  const refreshNotifications = useCallback(async () => {
    if (!enabled || !userIdRef.current) return;

    try {
      const summary = await fetchChatNotifications(
        userIdRef.current,
        userHandleRef.current
      );
      setConversationId(summary.conversationId);
      setLastReadAt(summary.lastReadAt);
      setUnreadCount(summary.unreadCount);
      setMentionCount(summary.mentionCount);
    } catch {
      setUnreadCount(0);
      setMentionCount(0);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function init() {
      const available = await checkChatAvailable();
      if (cancelled) return;

      setChatAvailable(available);
      if (!available) return;

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled || !user) return;

      userIdRef.current = user.id;
      userHandleRef.current = currentUserHandle(user.email);
      await refreshNotifications();
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, [enabled, refreshNotifications]);

  useEffect(() => {
    if (!enabled || !chatAvailable || !conversationId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`chat-notifications:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          if (!open) {
            void refreshNotifications();
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatAvailable, conversationId, enabled, open, refreshNotifications]);

  const markConversationAsRead = useCallback(
    async (activeConversationId: string) => {
      if (!userIdRef.current) return;

      await markConversationRead(activeConversationId, userIdRef.current);
      const readAt = new Date().toISOString();
      setLastReadAt(readAt);
      setUnreadCount(0);
      setMentionCount(0);
    },
    []
  );

  const toggle = useCallback(() => {
    if (!enabled) return;
    setOpen((value) => !value);
  }, [enabled]);

  const close = useCallback(() => setOpen(false), []);
  const openPanel = useCallback(() => {
    if (!enabled) return;
    setOpen(true);
  }, [enabled]);

  const value = useMemo(
    () => ({
      open,
      toggle,
      close,
      openPanel,
      unreadCount,
      mentionCount,
      lastReadAt,
      refreshNotifications,
      markConversationAsRead,
    }),
    [
      close,
      lastReadAt,
      markConversationAsRead,
      mentionCount,
      open,
      openPanel,
      refreshNotifications,
      toggle,
      unreadCount,
    ]
  );

  return (
    <ChatPanelContext.Provider value={value}>{children}</ChatPanelContext.Provider>
  );
}

export function useChatPanel() {
  const context = useContext(ChatPanelContext);
  if (!context) {
    throw new Error("useChatPanel must be used within ChatPanelProvider.");
  }
  return context;
}

export function ChatToggleButton({ enabled }: { enabled: boolean }) {
  const { open, toggle, unreadCount, mentionCount } = useChatPanel();

  if (!enabled) return null;

  const label =
    unreadCount > 0
      ? `Chat, ${unreadCount} unread message${unreadCount === 1 ? "" : "s"}${
          mentionCount > 0
            ? `, ${mentionCount} mention${mentionCount === 1 ? "" : "s"}`
            : ""
        }`
      : "Chat";

  return (
    <button
      type="button"
      onClick={toggle}
      className={`relative ${ui.btnHeader} ${open ? "bg-white/15" : ""} ${
        mentionCount > 0 ? "ring-2 ring-accent/60" : ""
      }`}
      aria-expanded={open}
      aria-controls="internal-chat-panel"
      aria-label={label}
    >
      <span className="inline-flex items-center gap-1.5">
        <span>💬 Chat</span>
        {unreadCount > 0 ? (
          <span
            className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold ${
              mentionCount > 0 ? "bg-accent text-white" : "bg-white/20 text-white"
            }`}
          >
            {unreadCount}
          </span>
        ) : null}
      </span>
    </button>
  );
}
