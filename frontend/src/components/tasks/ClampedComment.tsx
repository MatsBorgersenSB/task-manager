"use client";

type ClampedCommentProps = {
  text: string;
};

export default function ClampedComment({ text }: ClampedCommentProps) {
  const display = text.trim() || "—";
  const hasContent = display !== "—";

  if (!hasContent) {
    return <span className="text-sm text-primary/90">—</span>;
  }

  return (
    <div className="group relative max-w-[280px]">
      <div className="clamp-5 fade-clamp text-sm text-primary/90">{display}</div>

      <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 hidden w-[420px] rounded-lg border border-border bg-surface p-3 text-sm text-primary/90 shadow-lg group-hover:block">
        <p className="whitespace-pre-wrap break-words">{display}</p>
      </div>
    </div>
  );
}
