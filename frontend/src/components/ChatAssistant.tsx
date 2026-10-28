"use client";

import { useEffect, useRef, useState } from "react";
import { formatAssistantReply } from "@/lib/chatbot/formatReply";
import { ui } from "@/lib/ui/classes";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const WELCOME =
  'Hi! I can help you use Task Manager — or run quick project skills like "standup", "workload", "show blocked", "show overdue", or "done #12".';

const QUICK_COMMANDS = [
  "standup",
  "workload",
  "show overdue",
  "show blocked",
  "show critical",
  "show unassigned",
  "list today",
] as const;

type ChatAssistantProps = {
  projectId?: string | null;
};

export default function ChatAssistant({ projectId }: ChatAssistantProps = {}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", text: WELCOME },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  async function sendMessage(rawText: string) {
    const text = rawText.trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, projectId: projectId ?? null }),
      });

      const data = (await response.json()) as { reply?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not get a reply.");
      }

      const formatted = data.reply
        ? formatAssistantReply(data.reply)
        : "Sorry, I couldn't generate a reply.";

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: formatted,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await sendMessage(input);
  }

  return (
    <div className="no-print fixed bottom-4 left-4 z-30 flex flex-col items-start gap-2.5 print:hidden">
      {open ? (
        <div
          className="flex h-[min(28rem,70vh)] w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
          role="dialog"
          aria-label="Task Manager assistant"
        >
          <header className="flex items-center justify-between border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <div>
              <p className="text-sm font-semibold">Assistant</p>
              <p className="text-xs text-primary-foreground/70">Task Manager help &amp; quick commands</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-sm hover:bg-white/10"
              aria-label="Close assistant"
            >
              ✕
            </button>
          </header>

          <div
            ref={listRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <p
                  className={`max-w-[90%] whitespace-pre-line rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-accent text-white"
                      : "bg-background text-primary/90"
                  }`}
                >
                  {msg.text}
                </p>
              </div>
            ))}
            {loading ? (
              <p className="text-sm text-muted">Thinking…</p>
            ) : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>

          <div className="flex flex-wrap gap-1.5 border-t border-border/60 bg-slate-50/70 px-3 py-1.5">
            {QUICK_COMMANDS.map((cmd) => (
              <button
                key={cmd}
                type="button"
                disabled={loading}
                onClick={() => void sendMessage(cmd)}
                className="rounded-full border border-border bg-white px-2 py-0.5 font-mono text-[11px] text-primary/80 transition hover:border-accent hover:text-accent disabled:opacity-40"
              >
                {cmd}
              </button>
            ))}
          </div>

          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="border-t border-border p-3"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask help or type 'done #12'…"
                className={`${ui.input} mt-0 flex-1`}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className={ui.btnPrimarySm}
              >
                Send
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`${ui.btnSecondarySm} rounded-full border border-border bg-surface/95 px-3 py-1.5 shadow-md backdrop-blur-sm`}
        aria-expanded={open}
      >
        {open ? "Close help" : "? Help & Commands"}
      </button>
    </div>
  );
}
