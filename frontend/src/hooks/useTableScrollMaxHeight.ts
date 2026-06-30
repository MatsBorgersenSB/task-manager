"use client";

import { useEffect, useState, type RefObject } from "react";

const MIN_TABLE_HEIGHT = 240;
const MIN_TABLE_HEIGHT_FOCUS = 480;
const BOTTOM_GAP = 16;
const BOTTOM_GAP_FOCUS = 8;

export function useTableScrollMaxHeight(
  containerRef: RefObject<HTMLElement | null>,
  enabled = true,
  focusMode = false
) {
  const [maxHeight, setMaxHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setMaxHeight(null);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const top = containerRef.current?.getBoundingClientRect().top ?? 0;
      const minHeight = focusMode ? MIN_TABLE_HEIGHT_FOCUS : MIN_TABLE_HEIGHT;
      const bottomGap = focusMode ? BOTTOM_GAP_FOCUS : BOTTOM_GAP;
      const next = Math.max(minHeight, window.innerHeight - top - bottomGap);
      setMaxHeight(next);
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(document.documentElement);

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, [containerRef, enabled, focusMode]);

  return maxHeight;
}
