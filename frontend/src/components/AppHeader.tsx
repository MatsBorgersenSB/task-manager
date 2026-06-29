import type { ReactNode } from "react";
import BrandLogo from "@/components/BrandLogo";
import { roleBadgeClass } from "@/lib/roles";

type AppHeaderProps = {
  pageTitle?: string;
  pageDescription?: string;
  userEmail?: string;
  userRole?: string;
  toolbar?: ReactNode;
  actions?: ReactNode;
  fullWidth?: boolean;
};

export default function AppHeader({
  pageTitle,
  pageDescription,
  userEmail,
  userRole,
  toolbar,
  actions,
  fullWidth = false,
}: AppHeaderProps) {
  const innerClass = fullWidth
    ? "flex w-full flex-col gap-3 px-6 py-3 sm:flex-row sm:items-center sm:justify-between"
    : "mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6";

  return (
    <header className="no-print sticky top-0 z-50 border-b border-primary-light bg-[#0B2A2F] shadow-header">
      <div className={innerClass}>
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <BrandLogo variant="light" />
          {pageTitle ? (
            <div className="hidden h-8 w-px bg-white/15 sm:block" aria-hidden />
          ) : null}
          {pageTitle ? (
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-white">
                {pageTitle}
              </h1>
              {pageDescription ? (
                <p className="truncate text-sm text-white/70">
                  {pageDescription}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {toolbar ? (
          <div className="flex shrink-0 items-center">{toolbar}</div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
          {userEmail ? (
            <div className="hidden text-right sm:block">
              <p className="max-w-[14rem] truncate text-sm text-white/90">
                {userEmail}
              </p>
              {userRole ? (
                <span
                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${roleBadgeClass(userRole)}`}
                >
                  {userRole}
                </span>
              ) : null}
            </div>
          ) : null}
          {actions}
        </div>
      </div>
    </header>
  );
}
