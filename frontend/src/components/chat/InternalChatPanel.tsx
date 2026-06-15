"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useChatPanel } from "@/components/chat/ChatPanelContext";
import {
  chatAuthorLabel,
  formatChatTimestamp,
  useInternalChat,
} from "@/lib/chat/api";
import {
  filterUsersForMention,
  findActiveMentionQuery,
  insertMentionAt,
  parseMentionedUserIds,
  splitMessageWithMentions,
  userMentionHandle,
} from "@/lib/chat/mentions";
import { fetchAppUsers } from "@/lib/tasks/api";
import type { AppUser } from "@/lib/tasks/types";
import { ui } from "@/lib/ui/classes";

type InternalChatPanelProps = {
  enabled: boolean;
};

function useMobileChatLayout() {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return mobile;
}

function ChatMessageBody({ text }: { text: string }) {
  const parts = useMemo(() => splitMessageWithMentions(text), [text]);

  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-primary/90">
      {parts.map((part, index) =>
        part.type === "mention" ? (
          <span
            key={`${part.value}-${index}`}
            className="rounded bg-accent/15 px-0.5 font-medium text-primary"
          >
            {part.value}
          </span>
        ) : (
          <span key={`text-${index}`}>{part.value}</span>
        )
      )}
    </p>
  );
}

export default function InternalChatPanel({ enabled }: InternalChatPanelProps) {
  const { open, close } = useChatPanel();
  const mobile = useMobileChatLayout();
  const { messages, loading, error, sendMessage } = useInternalChat();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [inputCursor, setInputCursor] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!enabled) return;
    void fetchAppUsers().then(setUsers);
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, [enabled]);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open, sending]);

  const activeMention = useMemo(
    () => findActiveMentionQuery(input, inputCursor),
    [input, inputCursor]
  );

  const mentionSuggestions = useMemo(() => {
    if (!activeMention) return [];
    return filterUsersForMention(users, activeMention.query).slice(0, 6);
  }, [activeMention, users]);

  useEffect(() => {
    setMentionIndex(0);
  }, [activeMention?.query]);

  const applyMention = useCallback(
    (user: AppUser) => {
      const cursor = inputRef.current?.selectionStart ?? input.length;
      const handle = userMentionHandle(user);
      const { nextText, nextCursor } = insertMentionAt(input, cursor, handle);
      setInput(nextText);
      setShowUserPicker(false);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [input]
  );

  async function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setSendError(null);
    try {
      const mentionedUserIds = parseMentionedUserIds(text, users);
      await sendMessage(text, mentionedUserIds);
      setInput("");
      setShowUserPicker(false);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionSuggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionIndex((value) => (value + 1) % mentionSuggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex(
          (value) => (value - 1 + mentionSuggestions.length) % mentionSuggestions.length
        );
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        applyMention(mentionSuggestions[mentionIndex]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setShowUserPicker(false);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  if (!enabled) return null;

  const panelVisible = open;

  return (
    <>
      {panelVisible && mobile ? (
        <button
          type="button"
          className="fixed inset-0 z-[65] bg-primary/20 backdrop-blur-[1px] md:hidden"
          aria-label="Close chat"
          onClick={close}
        />
      ) : null}

      <aside
        id="internal-chat-panel"
        aria-hidden={!panelVisible}
        className={`fixed z-[70] flex flex-col overflow-hidden border border-border bg-surface shadow-2xl transition-transform duration-300 ease-out ${
          mobile
            ? `inset-y-0 right-0 h-full w-full max-w-none rounded-none ${
                panelVisible ? "translate-x-0" : "pointer-events-none translate-x-full"
              }`
            : `bottom-4 right-4 h-[500px] max-h-[calc(100vh-6rem)] w-[min(100vw-2rem,400px)] min-w-[320px] rounded-xl ${
                panelVisible
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-4 opacity-0"
              }`
        }`}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-border bg-primary px-4 py-3 text-primary-foreground">
          <div>
            <p className="text-sm font-semibold">Team chat</p>
            <p className="text-xs text-primary-foreground/70">Internal messages</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg px-2 py-1 text-sm transition hover:bg-white/10"
            aria-label="Close chat"
          >
            ✕
          </button>
        </header>

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-background/40 px-4 py-4">
          {loading ? (
            <p className="text-sm text-muted">Loading messages…</p>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {!loading && !error && messages.length === 0 ? (
            <p className="text-sm text-muted">
              No messages yet. Say hello or mention a teammate with @.
            </p>
          ) : null}
          {messages.map((message) => {
            const isOwn = currentUserId === message.user_id;
            return (
              <div
                key={message.id}
                className={`flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"}`}
              >
                <div className="flex items-baseline gap-2 text-xs text-muted">
                  <span className="font-medium text-primary/80">
                    {chatAuthorLabel(message, currentUserId)}
                  </span>
                  <span>{formatChatTimestamp(message.created_at)}</span>
                </div>
                <div
                  className={`max-w-[92%] rounded-lg px-3 py-2 ${
                    isOwn ? "bg-accent text-white" : "bg-surface shadow-card"
                  }`}
                >
                  {isOwn ? (
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white">
                      {message.message}
                    </p>
                  ) : (
                    <ChatMessageBody text={message.message} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="relative shrink-0 border-t border-border bg-surface p-3"
        >
          {showUserPicker ? (
            <div className="absolute bottom-full left-3 right-3 mb-2 max-h-44 overflow-y-auto rounded-lg border border-border bg-surface shadow-card">
              <p className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Mention teammate
              </p>
              {users.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted">No users available.</p>
              ) : (
                users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => applyMention(user)}
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm transition hover:bg-primary/5"
                  >
                    <span className="font-medium text-primary">@{userMentionHandle(user)}</span>
                    {user.email ? (
                      <span className="text-xs text-muted">{user.email}</span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          ) : null}

          {mentionSuggestions.length > 0 ? (
            <div className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-lg border border-border bg-surface shadow-card">
              {mentionSuggestions.map((user, index) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => applyMention(user)}
                  className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm transition ${
                    index === mentionIndex ? "bg-accent/10" : "hover:bg-primary/5"
                  }`}
                >
                  <span className="font-medium text-primary">@{userMentionHandle(user)}</span>
                  {user.email ? (
                    <span className="text-xs text-muted">{user.email}</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setShowUserPicker((value) => !value)}
              className={`${ui.btnSecondarySm} shrink-0 px-2.5`}
              aria-label="Mention user"
              title="Mention user"
            >
              +
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setInputCursor(event.target.selectionStart ?? event.target.value.length);
                setShowUserPicker(false);
              }}
              onKeyDown={handleInputKeyDown}
              onClick={(event) => {
                setInputCursor(event.currentTarget.selectionStart ?? input.length);
                setShowUserPicker(false);
              }}
              onKeyUp={(event) => {
                setInputCursor(event.currentTarget.selectionStart ?? input.length);
              }}
              placeholder="Message… use @ to mention"
              rows={2}
              className={`${ui.input} ${ui.textarea} mt-0 min-h-[2.75rem] flex-1 resize-none`}
              disabled={sending || Boolean(error)}
            />
            <button
              type="submit"
              disabled={sending || !input.trim() || Boolean(error)}
              className={`${ui.btnPrimarySm} shrink-0`}
            >
              Send
            </button>
          </div>
          {sendError ? <p className="mt-2 text-xs text-red-600">{sendError}</p> : null}
        </form>
      </aside>
    </>
  );
}
