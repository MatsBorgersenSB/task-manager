"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { usePortalRoot } from "@/contexts/FullscreenOverlayContext";
import { ui } from "@/lib/ui/classes";

type ClampedCommentProps = {
  text: unknown;
};

const clampTextStyle: CSSProperties = {
  wordBreak: "normal",
  overflowWrap: "anywhere",
  whiteSpace: "normal",
};

const PREVIEW_MAX_WIDTH = 480;

function normalizeCommentText(text: unknown): string {
  if (typeof text === "string") return text;
  if (Array.isArray(text)) return text.map((part) => String(part)).join("");
  if (text == null) return "";
  return String(text);
}

export default function ClampedComment({ text }: ClampedCommentProps) {
  const portalRoot = usePortalRoot();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);

  const rawText = normalizeCommentText(text).replace(/\r\n/g, "\n").trim();
  const hasContent = rawText.length > 0;
  const display = rawText || "—";
  const showPopup = pinned || hovered;

  const updatePopupPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const popupWidth = Math.min(PREVIEW_MAX_WIDTH, window.innerWidth * 0.9);
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
    if (pinned) return;
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setHovered(false);
      hideTimerRef.current = null;
    }, 120);
  }, [clearHideTimer, pinned]);

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
    if (!showPopup) {
      setPreviewVisible(false);
      return;
    }

    updatePopupPosition();
    const frame = window.requestAnimationFrame(() => {
      setPreviewVisible(true);
    });

    function handleReposition() {
      updatePopupPosition();
    }

    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      window.cancelAnimationFrame(frame);
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
        className={`${ui.tableTextPreview} ${
          previewVisible ? ui.tableTextPreviewVisible : ui.tableTextPreviewHidden
        }`}
        style={{
          top: position.top,
          left: position.left,
          width: PREVIEW_MAX_WIDTH,
          maxWidth: "min(480px, 90vw)",
        }}
        onMouseEnter={showHoverPopup}
        onMouseLeave={scheduleHideHoverPopup}
      >
        <div className="max-h-[min(24rem,70vh)] overflow-y-auto whitespace-pre-wrap break-words [word-break:normal]">
          {rawText}
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
          className="clamp-5 fade-clamp text-sm text-primary/90 whitespace-normal break-words [word-break:normal]"
          style={clampTextStyle}
        >
          <div className="block w-full">{display}</div>
        </div>
      </div>
      {popup ? createPortal(popup, portalRoot) : null}
    </>
  );
}
