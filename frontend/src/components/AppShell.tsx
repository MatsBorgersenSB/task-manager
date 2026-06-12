import type { ReactNode } from "react";
import AppHeader from "@/components/AppHeader";
import ChatAssistant from "@/components/ChatAssistant";
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
  const mainLayoutClass = fullWidth
    ? "w-full px-6 py-8"
    : `${ui.container} ${maxWidthClass[maxWidth]}`;

  return (
    <div className={ui.page}>
      <AppHeader
        pageTitle={pageTitle}
        pageDescription={pageDescription}
        userEmail={userEmail}
        userRole={userRole}
        actions={headerActions}
        fullWidth={fullWidth}
      />
      <main className={`${mainLayoutClass} space-y-6 ${mainClassName}`}>
        {children}
      </main>
      <ChatAssistant />
    </div>
  );
}
