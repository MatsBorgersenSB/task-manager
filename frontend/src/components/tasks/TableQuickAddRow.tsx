"use client";

import { useState } from "react";
import { ui } from "@/lib/ui/classes";

type TableQuickAddRowProps = {
  colSpan: number;
  disabled?: boolean;
  onQuickAdd: (title: string) => Promise<void>;
};

export default function TableQuickAddRow({
  colSpan,
  disabled = false,
  onQuickAdd,
}: TableQuickAddRowProps) {
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed || submitting || disabled) return;
    setSubmitting(true);
    setError(null);
    try {
      await onQuickAdd(trimmed);
      setTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add task.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <tr className="no-print border-t border-border/60 bg-slate-50/60 hover:bg-slate-50">
      <td colSpan={colSpan} className="py-1.5 pl-12 pr-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-accent">+</span>
          <input
            type="text"
            value={title}
            disabled={disabled || submitting}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSubmit();
              } else if (event.key === "Escape") {
                setTitle("");
                setError(null);
              }
            }}
            placeholder="Quick add task — type an issue title and press Enter…"
            aria-label="Quick add task title"
            className="h-7 min-w-[16rem] max-w-md flex-1 rounded border border-transparent bg-transparent px-2 text-xs text-primary placeholder:text-muted/80 focus:border-accent focus:bg-white focus:outline-none focus:ring-1 focus:ring-accent/25"
          />
          {title.trim() ? (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || disabled}
              className={ui.btnPrimarySm}
            >
              {submitting ? "Adding…" : "Add task"}
            </button>
          ) : null}
          {error ? (
            <span className="text-xs text-red-600" role="alert">
              {error}
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
