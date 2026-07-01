"use client";

import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import ProjectImpactSummary from "@/components/projects/ProjectImpactSummary";
import {
  DELETE_REASONS,
  type DeleteReason,
  type ProjectDeleteImpact,
} from "@/lib/projects/lifecycle";
import { fetchProjectDeleteImpact, permanentlyDeleteProject } from "@/lib/projects/lifecycleApi";
import { ui } from "@/lib/ui/classes";

type ProjectDeleteDialogProps = {
  open: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
  onDeleted: () => void;
};

export default function ProjectDeleteDialog({
  open,
  projectId,
  projectName,
  onClose,
  onDeleted,
}: ProjectDeleteDialogProps) {
  const [step, setStep] = useState<"impact" | "confirm" | "final">("impact");
  const [impact, setImpact] = useState<ProjectDeleteImpact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameConfirm, setNameConfirm] = useState("");
  const [reason, setReason] = useState<DeleteReason>("Other");
  const [reasonDetail, setReasonDetail] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("impact");
      setImpact(null);
      setNameConfirm("");
      setReason("Other");
      setReasonDetail("");
      setError(null);
      return;
    }

    setLoading(true);
    void fetchProjectDeleteImpact(projectId)
      .then(setImpact)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load project impact.")
      )
      .finally(() => setLoading(false));
  }, [open, projectId]);

  const reasonText =
    reason === "Other" ? reasonDetail.trim() || "Other" : reason;

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await permanentlyDeleteProject(projectId, reasonText);
      onDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 bg-primary/60 backdrop-blur-sm"
          aria-label="Close"
          onClick={deleting ? undefined : onClose}
        />
        <div className={`relative max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 ${ui.card}`}>
          <h3 className={ui.sectionTitle}>Delete project permanently</h3>
          <p className="mt-2 text-sm text-muted">
            This action cannot be undone. The project will be removed from all operational views.
          </p>

          {loading ? (
            <p className="mt-6 text-sm text-muted">Analyzing project impact…</p>
          ) : impact ? (
            <div className="mt-4">
              <ProjectImpactSummary impact={impact} />
            </div>
          ) : null}

          {step === "confirm" ? (
            <div className="mt-6 space-y-4">
              <div>
                <label className={ui.label} htmlFor="delete-reason">
                  Reason for deletion
                </label>
                <select
                  id="delete-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as DeleteReason)}
                  className={ui.input}
                >
                  {DELETE_REASONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              {reason === "Other" ? (
                <div>
                  <label className={ui.label} htmlFor="delete-reason-detail">
                    Details
                  </label>
                  <input
                    id="delete-reason-detail"
                    value={reasonDetail}
                    onChange={(e) => setReasonDetail(e.target.value)}
                    className={ui.input}
                    placeholder="Describe why this project is being deleted"
                  />
                </div>
              ) : null}
              <div>
                <label className={ui.label} htmlFor="delete-name-confirm">
                  Type <span className="font-semibold text-primary">{projectName}</span> to continue
                </label>
                <input
                  id="delete-name-confirm"
                  value={nameConfirm}
                  onChange={(e) => setNameConfirm(e.target.value)}
                  className={ui.input}
                  autoComplete="off"
                />
              </div>
            </div>
          ) : null}

          {error ? <p className="mt-4 text-xs text-red-600">{error}</p> : null}

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={deleting} className={ui.btnSecondary}>
              Cancel
            </button>
            {step === "impact" ? (
              <button
                type="button"
                disabled={!impact || loading}
                onClick={() => setStep("confirm")}
                className={ui.btnPrimary}
              >
                Continue
              </button>
            ) : step === "confirm" ? (
              <button
                type="button"
                disabled={
                  nameConfirm.trim() !== projectName.trim() ||
                  (reason === "Other" && !reasonDetail.trim())
                }
                onClick={() => setStep("final")}
                className={ui.btnPrimary}
              >
                Continue
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={step === "final"}
        title="This action cannot be undone"
        description={`Permanently delete "${projectName}" and remove it from Standard Bio operational history?`}
        confirmLabel="DELETE PERMANENTLY"
        variant="danger"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => !deleting && setStep("confirm")}
        layerClassName="z-[85]"
      />
    </>
  );
}
