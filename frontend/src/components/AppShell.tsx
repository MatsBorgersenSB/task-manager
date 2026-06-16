"use client";

import type { ReactNode } from "react";
import AppHeader from "@/components/AppHeader";
import {
  ChatPanelProvider,
  ChatToggleButton,
} from "@/components/chat/ChatPanelContext";
import InternalChatPanel from "@/components/chat/InternalChatPanel";
import { isInternal } from "@/lib/roles";
import { ui } from "@/lib/ui/classes";

type MaxWidth = "5xl" | "6xl" | "7xl";

type AppShellProps = {
  pageTitle?: string;
  pageDescription?: string;
  userEmail?: string;
  userRole?: string;
  headerActions?: ReactNode;
  maxWidth?: MaxWidth;
  /** Use full viewport width (no max-w-* / mx-auto centering). */
  fullWidth?: boolean;
  children: ReactNode;
  mainClassName?: string;
};

const maxWidthClass: Record<MaxWidth, string> = {
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

export default function AppShell({
  pageTitle,
  pageDescription,
  userEmail,
  userRole,
  headerActions,
  maxWidth = "7xl",
  fullWidth = false,
  children,
  mainClassName = "",
}: AppShellProps) {
  const chatEnabled = isInternal(userRole);
  const mainLayoutClass = fullWidth
    ? "w-full px-6 pt-3 pb-3"
    : `${ui.container} ${maxWidthClass[maxWidth]}`;

  return (
    <ChatPanelProvider enabled={chatEnabled}>
      <div className={ui.page}>
        <AppHeader
          pageTitle={pageTitle}
          pageDescription={pageDescription}
          userEmail={userEmail}
          userRole={userRole}
          actions={
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <ChatToggleButton enabled={chatEnabled} />
              {headerActions}
            </div>
          }
          fullWidth={fullWidth}
        />
        <main className={`${mainLayoutClass} space-y-3 ${mainClassName}`}>
          {children}
        </main>
        <InternalChatPanel enabled={chatEnabled} />
      </div>
    </ChatPanelProvider>
  );
}
