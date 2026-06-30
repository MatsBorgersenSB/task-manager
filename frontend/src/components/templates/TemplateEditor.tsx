"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TemplatePreviewTree from "@/components/templates/TemplatePreviewTree";
import {
  deleteTemplateDependency,
  deleteTemplateTask,
  fetchTemplateById,
  fetchTemplateDependencies,
  fetchTemplateTasks,
  updateTemplateMeta,
  upsertTemplateDependency,
  upsertTemplateTask,
} from "@/lib/templates/api";
import { buildTemplatePreviewGroups } from "@/lib/templates/preview";
import type {
  DependencyType,
  ProjectTemplate,
  ProjectTemplateTask,
} from "@/lib/templates/types";
import { DEPENDENCY_TYPE_LABELS } from "@/lib/templates/types";
import { todayIso } from "@/lib/tasks/taskDates";
import { ui } from "@/lib/ui/classes";

type TemplateEditorProps = {
  templateId: string;
  onBack?: () => void;
};

export default function TemplateEditor({ templateId, onBack }: TemplateEditorProps) {
  const [template, setTemplate] = useState<ProjectTemplate | null>(null);
  const [tasks, setTasks] = useState<ProjectTemplateTask[]>([]);
  const [deps, setDeps] = useState<Awaited<ReturnType<typeof fetchTemplateDependencies>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tpl, taskRows, depRows] = await Promise.all([
        fetchTemplateById(templateId),
        fetchTemplateTasks(templateId),
        fetchTemplateDependencies(templateId),
      ]);
      setTemplate(tpl);
      setTasks(taskRows);
      setDeps(depRows);
      if (!selectedTaskId && taskRows[0]) setSelectedTaskId(taskRows[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load template.");
    } finally {
      setLoading(false);
    }
  }, [selectedTaskId, templateId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  const mains = tasks.filter((t) => !t.parent_template_task_id);
  const previewGroups = useMemo(
    () => buildTemplatePreviewGroups(tasks, todayIso()),
    [tasks]
  );
  const taskTitleById = useMemo(
    () => new Map(tasks.map((t) => [t.id, t.title])),
    [tasks]
  );

  async function saveTemplateMeta(field: "knowledge_notes" | "description", value: string) {
    if (!template) return;
    setSaving(true);
    try {
      const updated = await updateTemplateMeta(template.id, { [field]: value });
      setTemplate(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTask(patch: Partial<ProjectTemplateTask>) {
    if (!selectedTask) return;
    setSaving(true);
    try {
      const updated = await upsertTemplateTask(
        templateId,
        { ...selectedTask, ...patch, title: patch.title ?? selectedTask.title },
        selectedTask.id
      );
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function addMainTask() {
    setSaving(true);
    try {
      const created = await upsertTemplateTask(templateId, {
        title: "New Main Task",
        sort_order: (mains.at(-1)?.sort_order ?? 0) + 10,
      });
      setTasks((prev) => [...prev, created]);
      setSelectedTaskId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add failed.");
    } finally {
      setSaving(false);
    }
  }

  async function addSubtask(parentId: string) {
    setSaving(true);
    try {
      const siblings = tasks.filter((t) => t.parent_template_task_id === parentId);
      const created = await upsertTemplateTask(templateId, {
        title: "New Subtask",
        parent_template_task_id: parentId,
        sort_order: (siblings.at(-1)?.sort_order ?? 0) + 1,
      });
      setTasks((prev) => [...prev, created]);
      setSelectedTaskId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add failed.");
    } finally {
      setSaving(false);
    }
  }

  async function removeTask(taskId: string) {
    setSaving(true);
    try {
      await deleteTemplateTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId && t.parent_template_task_id !== taskId));
      setSelectedTaskId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setSaving(false);
    }
  }

  async function addDependency(predecessorId: string, successorId: string) {
    setSaving(true);
    try {
      await upsertTemplateDependency(templateId, predecessorId, successorId, "FS");
      const depRows = await fetchTemplateDependencies(templateId);
      setDeps(depRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dependency failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading template…</p>;
  if (!template) return <p className="text-sm text-red-600">Template not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className={`${ui.btnSecondarySm} mb-2`}>
            ← Back to library
          </button>
          <h2 className={ui.sectionTitle}>
            {template.name} <span className="text-muted">v{template.version}</span>
          </h2>
          <p className="text-sm text-muted">{template.category}</p>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <section className={`p-4 xl:col-span-1 ${ui.card}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary">Task tree</h3>
            <button type="button" onClick={() => void addMainTask()} className={ui.btnSecondarySm}>
              + Main
            </button>
          </div>
          <ul className="mt-3 max-h-[24rem] space-y-1 overflow-y-auto text-sm">
            {mains.map((main) => (
              <li key={main.id}>
                <button
                  type="button"
                  onClick={() => setSelectedTaskId(main.id)}
                  className={`w-full rounded px-2 py-1 text-left ${
                    selectedTaskId === main.id ? "bg-accent/10 font-semibold" : "hover:bg-background"
                  }`}
                >
                  {main.is_milestone ? "◆ " : null}
                  {main.title}
                </button>
                <ul className="ml-4 mt-1 space-y-0.5">
                  {tasks
                    .filter((s) => s.parent_template_task_id === main.id)
                    .map((sub) => (
                      <li key={sub.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedTaskId(sub.id)}
                          className={`w-full rounded px-2 py-0.5 text-left text-xs ${
                            selectedTaskId === sub.id ? "bg-accent/10" : "hover:bg-background"
                          }`}
                        >
                          ↳ {sub.title}
                        </button>
                      </li>
                    ))}
                  <li>
                    <button
                      type="button"
                      onClick={() => void addSubtask(main.id)}
                      className="px-2 py-0.5 text-xs text-accent"
                    >
                      + Subtask
                    </button>
                  </li>
                </ul>
              </li>
            ))}
          </ul>
        </section>

        <section className={`p-4 xl:col-span-1 ${ui.card}`}>
          <h3 className="text-sm font-semibold text-primary">Task settings</h3>
          {selectedTask ? (
            <div className="mt-3 space-y-3">
              <div>
                <label className={ui.label}>Title</label>
                <input
                  value={selectedTask.title}
                  onChange={(e) =>
                    setTasks((prev) =>
                      prev.map((t) =>
                        t.id === selectedTask.id ? { ...t, title: e.target.value } : t
                      )
                    )
                  }
                  onBlur={(e) => void saveTask({ title: e.target.value })}
                  className={ui.input}
                />
              </div>
              <div>
                <label className={ui.label}>Description</label>
                <textarea
                  value={selectedTask.description ?? ""}
                  onChange={(e) =>
                    setTasks((prev) =>
                      prev.map((t) =>
                        t.id === selectedTask.id ? { ...t, description: e.target.value } : t
                      )
                    )
                  }
                  onBlur={(e) => void saveTask({ description: e.target.value || null })}
                  className={`${ui.input} ${ui.textarea}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={ui.label}>Area name</label>
                  <input
                    defaultValue={selectedTask.area_name ?? ""}
                    onBlur={(e) => void saveTask({ area_name: e.target.value || null })}
                    className={ui.input}
                  />
                </div>
                <div>
                  <label className={ui.label}>Area code</label>
                  <input
                    defaultValue={selectedTask.area_code ?? ""}
                    onBlur={(e) => void saveTask({ area_code: e.target.value || null })}
                    className={ui.input}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={ui.label}>SB Owner</label>
                  <input
                    defaultValue={selectedTask.sb_owner ?? ""}
                    onBlur={(e) => void saveTask({ sb_owner: e.target.value || null })}
                    className={ui.input}
                  />
                </div>
                <div>
                  <label className={ui.label}>Responsible</label>
                  <input
                    defaultValue={selectedTask.responsible ?? ""}
                    onBlur={(e) => void saveTask({ responsible: e.target.value || null })}
                    className={ui.input}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={ui.label}>Due offset (days)</label>
                  <input
                    type="number"
                    min={0}
                    defaultValue={selectedTask.due_offset_days ?? ""}
                    onBlur={(e) =>
                      void saveTask({
                        due_offset_days: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className={ui.input}
                  />
                </div>
                <div>
                  <label className={ui.label}>Est. duration (days)</label>
                  <input
                    type="number"
                    min={0}
                    defaultValue={selectedTask.estimated_duration_days ?? ""}
                    onBlur={(e) =>
                      void saveTask({
                        estimated_duration_days: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className={ui.input}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedTask.is_milestone}
                    onChange={(e) => void saveTask({ is_milestone: e.target.checked })}
                  />
                  Milestone
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedTask.is_critical}
                    onChange={(e) => void saveTask({ is_critical: e.target.checked })}
                  />
                  Critical
                </label>
              </div>
              <div>
                <label className={ui.label}>Template notes (best practices)</label>
                <textarea
                  defaultValue={selectedTask.template_notes ?? ""}
                  onBlur={(e) => void saveTask({ template_notes: e.target.value || null })}
                  className={`${ui.input} ${ui.textarea}`}
                  placeholder="Lessons learned, sequencing guidance…"
                />
              </div>
              {mains.length > 1 && !selectedTask.parent_template_task_id ? (
                <div>
                  <label className={ui.label}>Add dependency (after task)</label>
                  <select
                    className={ui.input}
                    defaultValue=""
                    onChange={(e) => {
                      const pred = e.target.value;
                      if (pred) void addDependency(pred, selectedTask.id);
                      e.target.value = "";
                    }}
                  >
                    <option value="">Select predecessor…</option>
                    {mains
                      .filter((m) => m.id !== selectedTask.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                  </select>
                </div>
              ) : null}
              <button
                type="button"
                disabled={saving}
                onClick={() => void removeTask(selectedTask.id)}
                className="text-xs font-semibold text-red-600"
              >
                Delete task
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">Select a task to edit settings.</p>
          )}
        </section>

        <section className={`p-4 xl:col-span-1 ${ui.card}`}>
          <h3 className="text-sm font-semibold text-primary">Knowledge & preview</h3>
          <label className={`${ui.label} mt-3`}>Template knowledge notes</label>
          <textarea
            defaultValue={template.knowledge_notes ?? ""}
            onBlur={(e) => void saveTemplateMeta("knowledge_notes", e.target.value)}
            className={`${ui.input} ${ui.textarea}`}
            placeholder="Standard Bio best practices for this playbook…"
          />
          <div className="mt-4 max-h-64 overflow-y-auto">
            <TemplatePreviewTree
              groups={previewGroups}
              dependencies={deps}
              taskTitleById={taskTitleById}
              compact
            />
          </div>
          {deps.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {deps.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <span>
                    {taskTitleById.get(d.predecessor_template_task_id)} →{" "}
                    {taskTitleById.get(d.successor_template_task_id)} (
                    {DEPENDENCY_TYPE_LABELS[d.dependency_type as DependencyType]})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void deleteTemplateDependency(d.id).then(() => load())
                    }
                    className="text-red-600"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
