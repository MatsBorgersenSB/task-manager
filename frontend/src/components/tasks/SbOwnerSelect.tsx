"use client";

import { useEffect, useRef, useState } from "react";
import type { AppUser } from "@/lib/tasks/types";
import { ui } from "@/lib/ui/classes";

type SbOwnerSelectProps = {
  users: AppUser[];
  selected: string[];
  onToggle: (name: string, checked: boolean) => void;
  disabled?: boolean;
  /** Native form field name for create-task forms. */
  name?: string;
  placeholder?: string;
};

function buttonLabel(selected: string[], placeholder: string): string {
  if (selected.length === 0) return placeholder;
  if (selected.length <= 2) return selected.join(", ");
  return `${selected.length} owners selected`;
}

/** Multi-select dropdown of SB (admin + internal) users for task ownership. */
export default function SbOwnerSelect({
  users,
  selected,
  onToggle,
  disabled = false,
  name,
  placeholder = "Select SB owners...",
}: SbOwnerSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative mt-1">
      {name
        ? selected.map((owner) => (
            <input key={owner} type="hidden" name={name} value={owner} />
          ))
        : null}

      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled) setOpen((prev) => !prev);
        }}
        className={`${ui.input} flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:bg-background disabled:text-muted`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="SB Owners"
      >
        <span
          className={
            selected.length === 0 ? "truncate text-muted/70" : "truncate"
          }
        >
          {buttonLabel(selected, placeholder)}
        </span>
        <span className="shrink-0 text-muted" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-surface p-2 shadow-lg"
          onClick={(event) => event.stopPropagation()}
          role="listbox"
          aria-label="SB Owners"
          aria-multiselectable
        >
          {users.length === 0 ? (
            <p className="px-2 py-2 text-sm text-muted">No SB users available</p>
          ) : (
            users.map((user) => {
              const checked = selected.includes(user.name);
              return (
                <label
                  key={user.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-primary hover:bg-background"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      onToggle(user.name, event.target.checked)
                    }
                    className="rounded border-border text-accent focus:ring-accent/20"
                  />
                  <span className="min-w-0 truncate">
                    {user.name}
                    {user.email ? (
                      <span className="ml-1 text-xs text-muted">
                        ({user.email})
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
