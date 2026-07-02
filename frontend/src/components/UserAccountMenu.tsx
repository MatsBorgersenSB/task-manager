"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { signOut } from "@/lib/auth";
import { roleBadgeClass } from "@/lib/roles";

type UserAccountMenuProps = {
  email: string;
  role?: string;
};

function emailInitials(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase() || "?";
}

export default function UserAccountMenu({ email, role }: UserAccountMenuProps) {
  const router = useRouter();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, closeMenu]);

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    setError(null);

    try {
      await signOut();
      closeMenu();
      router.push("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign out.");
      setSigningOut(false);
    }
  }

  const initials = emailInitials(email);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="flex max-w-[14rem] items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-left text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/25 disabled:opacity-60 sm:px-2.5"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        disabled={signingOut}
        onClick={() => {
          setError(null);
          setOpen((prev) => !prev);
        }}
      >
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/90 text-xs font-semibold text-white"
        >
          {initials}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-sm text-white/90">{email}</span>
          {role ? (
            <span
              className={`mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${roleBadgeClass(role)}`}
            >
              {role}
            </span>
          ) : null}
        </span>
        <span aria-hidden className="hidden text-[10px] text-white/60 sm:inline">
          ▼
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 top-full z-[60] mt-2 w-56 rounded-lg border border-border bg-white py-1 shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-border px-3 py-2 sm:hidden">
            <p className="truncate text-sm font-medium text-primary">{email}</p>
            {role ? (
              <span
                className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleBadgeClass(role)}`}
              >
                {role}
              </span>
            ) : null}
          </div>

          {error ? (
            <p
              className="mx-2 my-1 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <Link
            href="/dashboard"
            role="menuitem"
            className="block px-3 py-2 text-sm text-primary transition hover:bg-slate-50"
            onClick={closeMenu}
          >
            Profile
          </Link>

          <button
            type="button"
            role="menuitem"
            disabled
            className="block w-full cursor-not-allowed px-3 py-2 text-left text-sm text-muted"
            title="Coming soon"
          >
            Settings
            <span className="ml-1 text-[10px] uppercase tracking-wide text-muted/80">
              Soon
            </span>
          </button>

          <div className="my-1 border-t border-border" />

          <button
            type="button"
            role="menuitem"
            disabled={signingOut}
            className="block w-full px-3 py-2 text-left text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
            onClick={() => void handleSignOut()}
          >
            {signingOut ? "Signing out…" : "Sign Out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
