"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ui } from "@/lib/ui/classes";

type ChatPanelContextValue = {
  open: boolean;
  toggle: () => void;
  close: () => void;
  openPanel: () => void;
};

const ChatPanelContext = createContext<ChatPanelContextValue | null>(null);

type ChatPanelProviderProps = {
  enabled: boolean;
  children: ReactNode;
};

export function ChatPanelProvider({ enabled, children }: ChatPanelProviderProps) {
  const [open, setOpen] = useState(false);

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
    () => ({ open, toggle, close, openPanel }),
    [close, open, openPanel, toggle]
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
  const { open, toggle } = useChatPanel();

  if (!enabled) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      className={`${ui.btnHeader} ${open ? "bg-white/15" : ""}`}
      aria-expanded={open}
      aria-controls="internal-chat-panel"
    >
      💬 Chat
    </button>
  );
}
