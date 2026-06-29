export const SELECTED_PROJECT_STORAGE_KEY = "task-manager-selected-project";

export function readStoredProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SELECTED_PROJECT_STORAGE_KEY);
}

export function persistProjectId(projectId: string) {
  window.localStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, projectId);
}

export function resolveSelectedProjectId(
  projects: { id: string }[],
  current: string | null,
  initialProjectId?: string | null
): string | null {
  if (projects.length === 0) return null;

  const storedId = readStoredProjectId();
  const next =
    (initialProjectId &&
    projects.some((project) => project.id === initialProjectId)
      ? initialProjectId
      : null) ??
    (current && projects.some((project) => project.id === current)
      ? current
      : null) ??
    (storedId && projects.some((project) => project.id === storedId)
      ? storedId
      : null) ??
    projects[0]?.id ??
    null;

  if (next) persistProjectId(next);
  return next;
}
