"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TemplatePreviewTree from "@/components/templates/TemplatePreviewTree";
import {
  fetchProjectTemplates,
  fetchTemplateDependencies,
  fetchTemplateTasks,
  instantiateProjectFromTemplate,
  fetchProjectAfterInstantiate,
} from "@/lib/templates/api";
import {
  buildTemplatePreviewGroups,
  countTemplateStats,
} from "@/lib/templates/preview";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_ICONS,
  WIZARD_STEPS,
  type WizardStepId,
} from "@/lib/templates/constants";
import type { ProjectTemplate } from "@/lib/templates/types";
import { todayIso } from "@/lib/tasks/taskDates";
import { logProjectActivity } from "@/lib/tasks/projectActivity";
import type { Project } from "@/lib/projects/types";
import { ui } from "@/lib/ui/classes";

type CreateProjectWizardProps = {
  open: boolean;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onCreated: (project: Project) => void;
};

export default function CreateProjectWizard({
  open,
  loading: externalLoading = false,
  error: externalError = null,
  onClose,
  onCreated,
}: CreateProjectWizardProps) {
  const [step, setStep] = useState<WizardStepId>("name");
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [projectOwner, setProjectOwner] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [previewTasks, setPreviewTasks] = useState<Awaited<ReturnType<typeof fetchTemplateTasks>>>([]);
  const [previewDeps, setPreviewDeps] = useState<Awaited<ReturnType<typeof fetchTemplateDependencies>>>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;
  const loading = externalLoading || creating || templatesLoading;

  useEffect(() => {
    if (!open) {
      setStep("name");
      setName("");
      setClientName("");
      setProjectOwner("");
      setStartDate(todayIso());
      setTemplateId(null);
      setCategoryFilter("");
      setLocalError(null);
      return;
    }

    setTemplatesLoading(true);
    void fetchProjectTemplates({ latestOnly: true })
      .then(setTemplates)
      .catch((err) =>
        setLocalError(err instanceof Error ? err.message : "Failed to load templates.")
      )
      .finally(() => setTemplatesLoading(false));
  }, [open]);

  useEffect(() => {
    if (!templateId) {
      setPreviewTasks([]);
      setPreviewDeps([]);
      return;
    }
    void Promise.all([
      fetchTemplateTasks(templateId),
      fetchTemplateDependencies(templateId),
    ]).then(([tasks, deps]) => {
      setPreviewTasks(tasks);
      setPreviewDeps(deps);
    });
  }, [templateId]);

  const filteredTemplates = useMemo(() => {
    if (!categoryFilter) return templates;
    return templates.filter((t) => t.category === categoryFilter);
  }, [categoryFilter, templates]);

  const previewGroups = useMemo(
    () => buildTemplatePreviewGroups(previewTasks, startDate),
    [previewTasks, startDate]
  );

  const stats = useMemo(() => countTemplateStats(previewTasks), [previewTasks]);

  const taskTitleById = useMemo(
    () => new Map(previewTasks.map((t) => [t.id, t.title])),
    [previewTasks]
  );

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === step);

  const canNext = useCallback(() => {
    switch (step) {
      case "name":
        return name.trim().length > 0;
      case "client":
        return true;
      case "template":
        return true;
      case "start":
        return Boolean(startDate);
      case "owner":
        return true;
      case "review":
        return true;
      default:
        return false;
    }
  }, [name, startDate, step]);

  function goNext() {
    const next = WIZARD_STEPS[stepIndex + 1];
    if (next) setStep(next.id);
  }

  function goBack() {
    const prev = WIZARD_STEPS[stepIndex - 1];
    if (prev) setStep(prev.id);
  }

  async function handleCreate() {
    setCreating(true);
    setLocalError(null);
    try {
      const projectId = await instantiateProjectFromTemplate({
        name: name.trim(),
        clientName: clientName.trim() || null,
        projectOwner: projectOwner.trim() || null,
        startDate,
        templateId,
      });
      const project = await fetchProjectAfterInstantiate(projectId);
      await logProjectActivity({
        projectId,
        eventType: "project_generated_from_template",
        summary: selectedTemplate
          ? `Project generated from template ${selectedTemplate.name} v${selectedTemplate.version}`
          : "Project created",
        detail: selectedTemplate?.description ?? null,
        clientVisible: false,
      });
      onCreated(project);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Project creation failed.");
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;

  const displayError = localError ?? externalError;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-primary/60 backdrop-blur-sm"
        aria-label="Close"
        onClick={loading ? undefined : onClose}
      />
      <div className={`relative flex max-h-[90vh] w-full max-w-2xl flex-col ${ui.card}`}>
        <div className="border-b border-border px-6 py-4">
          <h3 className={ui.sectionTitle}>Create Standard Bio Project</h3>
          <p className="mt-1 text-sm text-muted">
            Set up a repeatable execution project in under 30 seconds.
          </p>
          <div className="mt-4 flex flex-wrap gap-1">
            {WIZARD_STEPS.map((s, index) => (
              <span
                key={s.id}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  s.id === step
                    ? "bg-accent text-white"
                    : index < stepIndex
                      ? "bg-accent/15 text-accent"
                      : "bg-background text-muted"
                }`}
              >
                {index + 1}. {s.label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === "name" ? (
            <>
              <label className={ui.label} htmlFor="wiz-name">
                Project name
              </label>
              <input
                id="wiz-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={ui.input}
                placeholder="e.g. Plant X Commissioning 2026"
                autoFocus
              />
            </>
          ) : null}

          {step === "client" ? (
            <>
              <label className={ui.label} htmlFor="wiz-client">
                Client
              </label>
              <input
                id="wiz-client"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className={ui.input}
                placeholder="Client organization"
              />
              <p className="mt-2 text-xs text-muted">
                Optional — used for internal tracking and client portal context.
              </p>
            </>
          ) : null}

          {step === "template" ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCategoryFilter("")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    !categoryFilter ? "bg-accent text-white" : "bg-background text-muted"
                  }`}
                >
                  All
                </button>
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      categoryFilter === cat
                        ? "bg-accent text-white"
                        : "bg-background text-muted"
                    }`}
                  >
                    {TEMPLATE_CATEGORY_ICONS[cat]} {cat}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setTemplateId(null)}
                  className={`rounded-lg border p-3 text-left transition ${
                    templateId === null
                      ? "border-accent bg-accent/5 ring-1 ring-accent/30"
                      : "border-border hover:border-accent/40"
                  }`}
                >
                  <span className="font-semibold text-primary">Blank project</span>
                  <p className="mt-1 text-xs text-muted">No template — add tasks manually.</p>
                </button>
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setTemplateId(template.id)}
                    className={`rounded-lg border p-3 text-left transition ${
                      templateId === template.id
                        ? "border-accent bg-accent/5 ring-1 ring-accent/30"
                        : "border-border hover:border-accent/40"
                    }`}
                  >
                    <span className="font-semibold text-primary">
                      {template.name}{" "}
                      <span className="text-xs font-normal text-muted">
                        v{template.version}
                      </span>
                    </span>
                    <p className="mt-1 line-clamp-2 text-xs text-muted">
                      {template.description ?? template.category}
                    </p>
                    <p className="mt-2 text-[10px] font-semibold uppercase text-muted">
                      {template.task_count ?? 0} tasks
                    </p>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step === "start" ? (
            <>
              <label className={ui.label} htmlFor="wiz-start">
                Project start date
              </label>
              <input
                id="wiz-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={ui.input}
              />
              <p className="mt-2 text-xs text-muted">
                Task due dates are calculated from this date using template offsets.
              </p>
            </>
          ) : null}

          {step === "owner" ? (
            <>
              <label className={ui.label} htmlFor="wiz-owner">
                Project owner
              </label>
              <input
                id="wiz-owner"
                value={projectOwner}
                onChange={(e) => setProjectOwner(e.target.value)}
                className={ui.input}
                placeholder="Standard Bio lead"
              />
            </>
          ) : null}

          {step === "review" || step === "create" ? (
            <div className="space-y-4">
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase text-muted">Project</dt>
                  <dd className="font-semibold text-primary">{name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-muted">Client</dt>
                  <dd>{clientName || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-muted">Template</dt>
                  <dd>
                    {selectedTemplate
                      ? `${selectedTemplate.name} v${selectedTemplate.version}`
                      : "Blank"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-muted">Start</dt>
                  <dd>{startDate}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-muted">Owner</dt>
                  <dd>{projectOwner || "—"}</dd>
                </div>
                {selectedTemplate ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase text-muted">Structure</dt>
                    <dd>
                      {stats.areas} areas · {stats.mainTasks} tasks · {stats.subtasks}{" "}
                      subtasks · {stats.milestones} milestones
                    </dd>
                  </div>
                ) : null}
              </dl>

              {selectedTemplate && previewTasks.length > 0 ? (
                <div className="rounded-lg border border-border bg-background p-4">
                  <h4 className="text-sm font-semibold text-primary">Project preview</h4>
                  <div className="mt-3 max-h-64 overflow-y-auto">
                    <TemplatePreviewTree
                      groups={previewGroups}
                      dependencies={previewDeps}
                      taskTitleById={taskTitleById}
                      compact
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {displayError ? (
            <p className="mt-4 text-xs text-red-600">{displayError}</p>
          ) : null}
        </div>

        <div className="flex justify-between gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            disabled={loading || stepIndex === 0}
            onClick={goBack}
            className={ui.btnSecondary}
          >
            Back
          </button>
          <div className="flex gap-3">
            <button type="button" disabled={loading} onClick={onClose} className={ui.btnSecondary}>
              Cancel
            </button>
            {step === "review" ? (
              <button
                type="button"
                disabled={loading || !canNext()}
                onClick={() => setStep("create")}
                className={ui.btnPrimary}
              >
                Continue
              </button>
            ) : step === "create" ? (
              <button
                type="button"
                disabled={loading || !canNext()}
                onClick={() => void handleCreate()}
                className={ui.btnPrimary}
              >
                {creating ? "Creating project…" : "Create project"}
              </button>
            ) : (
              <button
                type="button"
                disabled={loading || !canNext()}
                onClick={goNext}
                className={ui.btnPrimary}
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
