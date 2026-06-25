"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ClampedCommentProps = {
  text: string;
};

export default function ClampedComment({ text }: ClampedCommentProps) {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const display = text.trim() || "—";
  const hasContent = display !== "—";

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const updatePopupPosition = useCallback(() => {
    const anchor = ref.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const popupWidth = Math.min(420, window.innerWidth * 0.9);
    const padding = 8;

    setAlignRight(rect.left + popupWidth > window.innerWidth - padding);
  }, []);

  if (!hasContent) {
    return <span className="text-sm text-primary/90">—</span>;
  }

  const popupVisible = open
    ? "opacity-100 translate-y-0 pointer-events-auto"
    : "opacity-0 translate-y-1 pointer-events-none";

  const popupHover =
    "md:group-hover:opacity-100 md:group-hover:translate-y-0 md:group-hover:pointer-events-auto";

  return (
    <div
      ref={ref}
      className="group relative w-full min-w-0 cursor-pointer overflow-visible"
      onClick={(event) => {
        event.stopPropagation();
        setOpen((prev) => !prev);
        requestAnimationFrame(updatePopupPosition);
      }}
      onMouseEnter={updatePopupPosition}
    >
      <div className="clamp-5 fade-clamp whitespace-normal break-words text-sm text-primary/90">
        {display}
      </div>

      <div
        className={`absolute top-full z-50 mt-2 w-[420px] max-w-[90vw] rounded-lg border border-border bg-surface p-3 text-sm text-primary/90 shadow-lg transition-all duration-150 ease-out ${alignRight ? "right-0 left-auto" : "left-0 right-auto"} ${popupVisible} ${popupHover}`}
      >
        <p className="whitespace-pre-wrap break-words">{display}</p>
      </div>
    </div>
  );
}
