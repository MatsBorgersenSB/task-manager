import type { ReactNode } from "react";
import AppHeader from "@/components/AppHeader";
import { ui } from "@/lib/ui/classes";

type MaxWidth = "5xl" | "6xl" | "7xl";

type AppShellProps = {
  pageTitle?: string;
  pageDescription?: string;
  userEmail?: string;
  userRole?: string;
  headerActions?: ReactNode;
  maxWidth?: MaxWidth;
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
  children,
  mainClassName = "",
}: AppShellProps) {
  return (
    <div className={ui.page}>
      <AppHeader
        pageTitle={pageTitle}
        pageDescription={pageDescription}
        userEmail={userEmail}
        userRole={userRole}
        actions={headerActions}
      />
      <main
        className={`${ui.container} ${maxWidthClass[maxWidth]} space-y-6 ${mainClassName}`}
      >
        {children}
      </main>
    </div>
  );
}
