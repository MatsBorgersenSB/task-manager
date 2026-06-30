"use client";

import { useEffect, useState, type RefObject } from "react";

const MIN_TABLE_HEIGHT = 240;
const BOTTOM_GAP = 16;

export function useTableScrollMaxHeight(
  containerRef: RefObject<HTMLElement | null>,
  enabled = true
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
      const top = container.getBoundingClientRect().top;
      const next = Math.max(
        MIN_TABLE_HEIGHT,
        window.innerHeight - top - BOTTOM_GAP
      );
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
  }, [containerRef, enabled]);

  return maxHeight;
}
