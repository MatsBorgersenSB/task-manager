"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ProjectStatusBadge from "@/components/projects/ProjectStatusBadge";
import SchemaMigrationNotice from "@/components/admin/SchemaMigrationNotice";
import { useSchemaCapabilities } from "@/hooks/useSchemaCapabilities";
import { fetchArchivedProjects } from "@/lib/projects/lifecycleApi";
import type { Project } from "@/lib/projects/types";
import { ui } from "@/lib/ui/classes";

export default function ArchivedProjectsExplorer() {
  const { capabilities } = useSchemaCapabilities();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!capabilities?.projectLifecycle) {
      setLoading(false);
      return;
    }
    void fetchArchivedProjects()
      .then(setProjects)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load archived projects.")
      )
      .finally(() => setLoading(false));
  }, [capabilities?.projectLifecycle]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(term) ||
        (project.description?.toLowerCase().includes(term) ?? false) ||
        (project.client_name?.toLowerCase().includes(term) ?? false)
    );
  }, [projects, query]);

  return (
    <section className={`p-6 ${ui.card}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className={ui.sectionTitle}>Archived projects</h2>
          <p className="mt-2 text-sm text-muted">
            Search and open archived projects in read-only mode. Data is preserved for audit and reference.
          </p>
        </div>
        <Link href="/dashboard" className={ui.btnSecondary}>
          Back to dashboard
        </Link>
      </div>

      <SchemaMigrationNotice
        capabilities={capabilities}
        feature="projectLifecycle"
        label="Archived projects"
      />

      <div className="mt-6">
        <label className={ui.label} htmlFor="archived-search">
          Search archived projects
        </label>
        <input
          id="archived-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, description, or client…"
          className={`mt-1 ${ui.input}`}
        />
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading archived projects…</p>
      ) : !capabilities?.projectLifecycle ? null : error ? (
        <p className="mt-6 text-sm text-red-600">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          {projects.length === 0
            ? "No archived projects yet."
            : "No projects match your search."}
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-surface">
          {filtered.map((project) => (
            <li key={project.id}>
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-primary">{project.name}</span>
                    <ProjectStatusBadge status={project.project_status} />
                  </div>
                  {project.description ? (
                    <p className="mt-1 text-sm text-muted">{project.description}</p>
                  ) : null}
                  {project.archived_at ? (
                    <p className="mt-1 text-xs text-muted">
                      Archived {new Date(project.archived_at).toLocaleDateString()}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={`/internal?project=${project.id}`}
                  className={ui.btnSecondarySm}
                >
                  Open read-only
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
