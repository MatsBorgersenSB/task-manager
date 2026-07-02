"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

type FullscreenOverlayContextValue = {
  isFullscreen: boolean;
  overlayElement: HTMLDivElement | null;
};

const FullscreenOverlayContext = createContext<FullscreenOverlayContextValue>({
  isFullscreen: false,
  overlayElement: null,
});

export function FullscreenOverlayProvider({
  isFullscreen,
  overlayElement,
  children,
}: {
  isFullscreen: boolean;
  overlayElement: HTMLDivElement | null;
  children: ReactNode;
}) {
  return (
    <FullscreenOverlayContext.Provider
      value={{ isFullscreen, overlayElement }}
    >
      {children}
    </FullscreenOverlayContext.Provider>
  );
}

export function useFullscreenOverlay() {
  return useContext(FullscreenOverlayContext);
}

export function usePortalRoot(): HTMLElement {
  if (typeof document === "undefined") {
    return null as unknown as HTMLElement;
  }

  const { isFullscreen, overlayElement } = useFullscreenOverlay();
  if (isFullscreen && overlayElement) {
    return overlayElement;
  }

  return document.body;
}
