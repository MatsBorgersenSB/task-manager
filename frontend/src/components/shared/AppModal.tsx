"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { uiLayers } from "@/lib/ui/layers";

type AppModalProps = {
  open: boolean;
  children: ReactNode;
  onClose?: () => void;
  /** When true, backdrop click and Escape do not close the modal. */
  disableClose?: boolean;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  panelClassName?: string;
  align?: "center" | "top";
};

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        '[tabindex]:not([tabindex="-1"])',
      ].join(",")
    )
  ).filter((element) => !element.hasAttribute("disabled"));
}

export default function AppModal({
  open,
  children,
  onClose,
  disableClose = false,
  ariaLabelledBy,
  ariaDescribedBy,
  panelClassName = "",
  align = "center",
}: AppModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const labelledBy = ariaLabelledBy ?? titleId;

  const requestClose = useCallback(() => {
    if (disableClose) return;
    onClose?.();
  }, [disableClose, onClose]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const focusTarget =
      panel && getFocusableElements(panel).length > 0
        ? getFocusableElements(panel)[0]
        : panel;

    const previousFocus = document.activeElement as HTMLElement | null;
    focusTarget?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }

      if (event.key !== "Tab" || !panel) return;

      const focusables = getFocusableElements(panel);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [open, requestClose]);

  if (!open || typeof document === "undefined") return null;

  const alignClass =
    align === "top"
      ? "items-start pt-[max(1rem,10vh)]"
      : "items-center";

  return createPortal(
    <div
      className={`fixed inset-0 flex justify-center p-4 ${uiLayers.modal} ${alignClass}`}
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-primary/70 backdrop-blur-sm"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={requestClose}
        disabled={disableClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={ariaDescribedBy}
        className={`relative max-h-[min(90vh,calc(100dvh-2rem))] w-full overflow-y-auto outline-none ${panelClassName}`}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
