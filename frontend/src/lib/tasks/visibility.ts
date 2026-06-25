export type VisibilityScope = "internal" | "internal_client";

export const DEFAULT_VISIBILITY_SCOPE: VisibilityScope = "internal_client";

export const VISIBILITY_SCOPE_VALUES = [
  "internal",
  "internal_client",
] as const satisfies readonly VisibilityScope[];

export const VISIBILITY_OPTION_LABELS: Record<VisibilityScope, string> = {
  internal: "Internal only (hidden from client)",
  internal_client: "Client / External (visible to client)",
};

/** Default null/undefined/unknown values to internal_client. */
export function normalizeVisibilityScope(
  value?: string | null
): VisibilityScope {
  return value === "internal" ? "internal" : DEFAULT_VISIBILITY_SCOPE;
}

export function formatVisibilityScope(
  value?: string | null
): string {
  return VISIBILITY_OPTION_LABELS[normalizeVisibilityScope(value)];
}

const VISIBILITY_BADGE_BASE =
  "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap";

export function visibilityBadgeClass(scope?: string | null): string {
  const normalized = normalizeVisibilityScope(scope);
  if (normalized === "internal") {
    return `${VISIBILITY_BADGE_BASE} border border-gray-300 bg-gray-100 text-gray-700`;
  }
  return `${VISIBILITY_BADGE_BASE} border border-green-300 bg-green-100 text-green-700`;
}

export function visibilityBadgeLabel(scope?: string | null): string {
  const normalized = normalizeVisibilityScope(scope);
  if (normalized === "internal") return "Internal only";
  return "Client visible";
}

export function isClientVisibleTask(scope?: string | null): boolean {
  return normalizeVisibilityScope(scope) === "internal_client";
}
