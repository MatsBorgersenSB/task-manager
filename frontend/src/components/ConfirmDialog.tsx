"use client";

import AppModal from "@/components/shared/AppModal";
import { ui } from "@/lib/ui/classes";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmClass =
    variant === "danger" ? ui.btnDangerLg : ui.btnPrimary;

  return (
    <AppModal
      open={open}
      onClose={onCancel}
      disableClose={loading}
      ariaLabelledBy="confirm-dialog-title"
      panelClassName="max-w-md"
    >
      <div className={`p-6 ${ui.card}`}>
        <h3 id="confirm-dialog-title" className={ui.sectionTitle}>
          {title}
        </h3>
        <p className="mt-2 text-sm text-muted">{description}</p>
        {error ? <p className={`mt-3 ${ui.alertError}`}>{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className={ui.btnSecondary}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={confirmClass}
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </AppModal>
  );
}
