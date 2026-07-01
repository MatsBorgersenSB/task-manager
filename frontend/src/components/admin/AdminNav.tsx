"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ui } from "@/lib/ui/classes";

const ADMIN_NAV = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/access", label: "Access Center" },
] as const;

type AdminNavProps = {
  backHref?: string;
};

export default function AdminNav({ backHref = "/dashboard" }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Standard Bio Admin
          </p>
          <h1 className="text-xl font-bold text-primary">Admin Panel</h1>
        </div>
        <Link href={backHref} className={ui.btnHeader}>
          Back to dashboard
        </Link>
      </div>

      <nav
        className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1"
        aria-label="Admin sections"
      >
        {ADMIN_NAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href === "/admin/access" && pathname.startsWith("/admin/access"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-accent text-white shadow-sm"
                  : "text-muted hover:bg-background hover:text-primary"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
