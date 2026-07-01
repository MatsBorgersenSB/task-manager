"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

type ClampedCommentProps = {
  text: unknown;
};

const clampTextStyle: CSSProperties = {
  wordBreak: "normal",
  overflowWrap: "anywhere",
  whiteSpace: "normal",
};

function normalizeCommentText(text: unknown): string {
  if (typeof text === "string") return text;
  if (Array.isArray(text)) return text.map((part) => String(part)).join("");
  if (text == null) return "";
  return String(text);
}

export default function ClampedComment({ text }: ClampedCommentProps) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);

  const normalizedText = normalizeCommentText(text);
  const cleanText = normalizedText.replace(/\n/g, " ").trim();
  const display = cleanText || "—";
  const hasContent = display !== "—";
  const showPopup = pinned || hovered;

  const updatePopupPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const popupWidth = Math.min(420, window.innerWidth * 0.9);
    const padding = 8;
    let left = rect.left;

    if (left + popupWidth > window.innerWidth - padding) {
      left = window.innerWidth - padding - popupWidth;
    }

    setPosition({
      top: rect.bottom + 8,
      left: Math.max(padding, left),
    });
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const showHoverPopup = useCallback(() => {
    clearHideTimer();
    setHovered(true);
    updatePopupPosition();
  }, [clearHideTimer, updatePopupPosition]);

  const scheduleHideHoverPopup = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setHovered(false);
      hideTimerRef.current = null;
    }, 120);
  }, [clearHideTimer]);

  useEffect(() => {
    if (!pinned) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      setPinned(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [pinned]);

  useEffect(() => {
    if (!showPopup) return;

    updatePopupPosition();

    function handleReposition() {
      updatePopupPosition();
    }

    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [showPopup, updatePopupPosition]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  if (!hasContent) {
    return <span className="text-sm text-primary/90">—</span>;
  }

  const popup =
    showPopup && typeof document !== "undefined" ? (
      <div
        role="tooltip"
        className="fixed z-[200] w-[420px] max-w-[90vw] rounded-lg border border-border bg-white p-3 text-sm text-gray-800 shadow-xl"
        style={{
          top: position.top,
          left: position.left,
          ...clampTextStyle,
        }}
        onMouseEnter={showHoverPopup}
        onMouseLeave={scheduleHideHoverPopup}
      >
        <div className="block w-full whitespace-normal [word-break:normal]">
          {cleanText}
        </div>
      </div>
    ) : null;

  return (
    <>
      <div
        ref={anchorRef}
        className="relative block w-full min-w-0 cursor-pointer"
        onClick={(event) => {
          event.stopPropagation();
          setPinned((prev) => !prev);
          updatePopupPosition();
        }}
        onMouseEnter={showHoverPopup}
        onMouseLeave={scheduleHideHoverPopup}
      >
        <div
          className="clamp-5 fade-clamp text-sm text-gray-800 whitespace-normal break-words [word-break:normal]"
          style={clampTextStyle}
        >
          <div className="block w-full">{cleanText}</div>
        </div>
      </div>
      {popup ? createPortal(popup, document.body) : null}
    </>
  );
}
