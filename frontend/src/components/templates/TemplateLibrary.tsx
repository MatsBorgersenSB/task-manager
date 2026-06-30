"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import TemplatePreviewTree from "@/components/templates/TemplatePreviewTree";
import {
  cloneTemplate,
  createTemplate,
  createTemplateVersion,
  fetchProjectTemplates,
  fetchTemplateDependencies,
  fetchTemplateTasks,
  searchTemplates,
  updateTemplateMeta,
} from "@/lib/templates/api";
import { buildTemplatePreviewGroups, countTemplateStats } from "@/lib/templates/preview";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_ICONS,
} from "@/lib/templates/constants";
import type { ProjectTemplate } from "@/lib/templates/types";
import { todayIso } from "@/lib/tasks/taskDates";
import { ui } from "@/lib/ui/classes";

type TemplateLibraryProps = {
  onEditTemplate?: (templateId: string) => void;
};

export default function TemplateLibrary({ onEditTemplate }: TemplateLibraryProps) {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewTasks, setPreviewTasks] = useState<Awaited<ReturnType<typeof fetchTemplateTasks>>>([]);
  const [previewDeps, setPreviewDeps] = useState<Awaited<ReturnType<typeof fetchTemplateDependencies>>>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = query.trim()
        ? await searchTemplates(query)
        : await fetchProjectTemplates({ latestOnly: true, category: category || undefined });
      setTemplates(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates.");
    } finally {
      setLoading(false);
    }
  }, [category, query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!previewId) {
      setPreviewTasks([]);
      setPreviewDeps([]);
      return;
    }
    void Promise.all([
      fetchTemplateTasks(previewId),
      fetchTemplateDependencies(previewId),
    ]).then(([tasks, deps]) => {
      setPreviewTasks(tasks);
      setPreviewDeps(deps);
    });
  }, [previewId]);

  const previewTemplate = templates.find((t) => t.id === previewId) ?? null;
  const previewGroups = useMemo(
    () => buildTemplatePreviewGroups(previewTasks, todayIso()),
    [previewTasks]
  );
  const taskTitleById = useMemo(
    () => new Map(previewTasks.map((t) => [t.id, t.title])),
    [previewTasks]
  );

  async function handleCreateBlank() {
    setActionLoading(true);
    try {
      const created = await createTemplate({
        name: "New Custom Template",
        category: "Custom",
      });
      onEditTemplate?.(created.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleClone(id: string) {
    setActionLoading(true);
    try {
      await cloneTemplate(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clone failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleVersion(id: string) {
    setActionLoading(true);
    try {
      await createTemplateVersion(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Version failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleArchive(id: string, archived: boolean) {
    setActionLoading(true);
    try {
      await updateTemplateMeta(id, { is_archived: archived });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className={ui.sectionTitle}>Standard Bio Template Library</h2>
          <p className="mt-1 text-sm text-muted">
            Repeatable execution playbooks for installation, FAT, commissioning, and service.
          </p>
        </div>
        <button
          type="button"
          disabled={actionLoading}
          onClick={() => void handleCreateBlank()}
          className={ui.btnPrimary}
        >
          + New template
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search templates…"
          className={`${ui.input} max-w-xs`}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={ui.filterToolbarSelect}
        >
          <option value="">All categories</option>
          {TEMPLATE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-muted">Loading templates…</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {templates.map((template) => (
            <li key={template.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewId(template.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="font-semibold text-primary">
                    {TEMPLATE_CATEGORY_ICONS[template.category as keyof typeof TEMPLATE_CATEGORY_ICONS] ?? "📋"}{" "}
                    {template.name}{" "}
                    <span className="text-xs font-normal text-muted">v{template.version}</span>
                  </span>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">
                    {template.description ?? "No description"}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {template.category} · {template.task_count ?? 0} tasks
                    {template.is_archived ? " · Archived" : ""}
                  </p>
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {onEditTemplate ? (
                  <button
                    type="button"
                    onClick={() => onEditTemplate(template.id)}
                    className={ui.btnSecondarySm}
                  >
                    Edit
                  </button>
                ) : (
                  <Link
                    href={`/internal/templates/${template.id}`}
                    className={ui.btnSecondarySm}
                  >
                    Edit
                  </Link>
                )}
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void handleClone(template.id)}
                  className={ui.btnSecondarySm}
                >
                  Clone
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void handleVersion(template.id)}
                  className={ui.btnSecondarySm}
                >
                  New version
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void handleArchive(template.id, !template.is_archived)}
                  className={ui.btnSecondarySm}
                >
                  {template.is_archived ? "Restore" : "Archive"}
                </button>
              </div>
            </li>
          ))}
          {!loading && templates.length === 0 ? (
            <li className="p-6 text-sm text-muted">No templates match your filters.</li>
          ) : null}
        </ul>

        <div className={`min-h-[20rem] p-5 ${ui.card}`}>
          {previewTemplate ? (
            <>
              <h3 className="font-semibold text-primary">
                {previewTemplate.name} v{previewTemplate.version}
              </h3>
              {previewTemplate.knowledge_notes ? (
                <p className="mt-2 text-xs text-muted">{previewTemplate.knowledge_notes}</p>
              ) : null}
              <p className="mt-2 text-xs text-muted">
                {countTemplateStats(previewTasks).mainTasks} main tasks ·{" "}
                {countTemplateStats(previewTasks).subtasks} subtasks ·{" "}
                {countTemplateStats(previewTasks).milestones} milestones
              </p>
              <div className="mt-4 max-h-[28rem] overflow-y-auto">
                <TemplatePreviewTree
                  groups={previewGroups}
                  dependencies={previewDeps}
                  taskTitleById={taskTitleById}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Select a template to preview its structure.</p>
          )}
        </div>
      </div>
    </div>
  );
}
