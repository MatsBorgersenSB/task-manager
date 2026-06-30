"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

export function useFullscreen(targetRef: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === targetRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [targetRef]);

  const enterFullscreen = useCallback(async () => {
    const el = targetRef.current;
    if (!el) return;
    try {
      await el.requestFullscreen();
    } catch {
      /* unsupported or denied */
    }
  }, [targetRef]);

  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement === targetRef.current) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }, [targetRef, enterFullscreen, exitFullscreen]);

  return { isFullscreen, enterFullscreen, exitFullscreen, toggleFullscreen };
}
