"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import BrandLogo from "@/components/BrandLogo";
import { isAdmin, isInternal } from "@/lib/roles";

type AppHeaderProps = {
  pageTitle?: ReactNode;
  pageDescription?: string;
  userRole?: string;
  toolbar?: ReactNode;
  actions?: ReactNode;
  fullWidth?: boolean;
};

type NavItem = {
  href: string;
  label: string;
  matchPrefix: string;
};

function buildGlobalNavItems(userRole?: string): NavItem[] {
  if (!userRole) return [];
  if (isInternal(userRole)) {
    const items: NavItem[] = [
      { href: "/dashboard", label: "Dashboard", matchPrefix: "/dashboard" },
      { href: "/internal", label: "Workspace", matchPrefix: "/internal" },
      { href: "/today", label: "Today", matchPrefix: "/today" },
      {
        href: "/internal/templates",
        label: "Templates",
        matchPrefix: "/internal/templates",
      },
    ];
    if (isAdmin(userRole)) {
      items.push({ href: "/admin", label: "Admin", matchPrefix: "/admin" });
    }
    return items;
  }
  return [
    { href: "/dashboard", label: "Dashboard", matchPrefix: "/dashboard" },
    { href: "/client", label: "Project Portal", matchPrefix: "/client" },
  ];
}

function isNavActive(pathname: string | null, item: NavItem): boolean {
  if (!pathname) return false;
  if (item.matchPrefix === "/internal") {
    return (
      pathname === "/internal" ||
      (pathname.startsWith("/internal/") &&
        !pathname.startsWith("/internal/templates"))
    );
  }
  return (
    pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`)
  );
}

export default function AppHeader({
  pageTitle,
  pageDescription,
  userRole,
  toolbar,
  actions,
  fullWidth = false,
}: AppHeaderProps) {
  const pathname = usePathname();
  const navItems = buildGlobalNavItems(userRole);
  const innerClass = fullWidth
    ? "flex w-full flex-col gap-3 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6"
    : "mx-auto flex max-w-7xl flex-col gap-3 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6";

  return (
    <header className="no-print sticky top-0 z-50 border-b border-primary-light bg-[#0B2A2F] shadow-header">
      <div className={innerClass}>
        <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
          <BrandLogo variant="light" />
          {navItems.length > 0 ? (
            <nav
              aria-label="Primary navigation"
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1"
            >
              {navItems.map((item) => {
                const active = isNavActive(pathname, item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      active
                        ? "bg-white text-[#0B2A2F] shadow-sm"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}
          {pageTitle ? (
            <div className="hidden h-7 w-px shrink-0 bg-white/15 xl:block" aria-hidden />
          ) : null}
          {pageTitle ? (
            <div className="hidden min-w-0 xl:block">
              <h1 className="truncate text-sm font-semibold text-white">
                {pageTitle}
              </h1>
              {pageDescription ? (
                <p className="truncate text-xs text-white/70">
                  {pageDescription}
                </p>
              ) : null}
            </div>
          ) : null}
          {toolbar ? (
            <div className="flex shrink-0 items-center">{toolbar}</div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-2.5">
          {actions}
        </div>
      </div>
    </header>
  );
}
