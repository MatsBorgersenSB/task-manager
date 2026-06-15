import { getAddFieldNames, getEditFieldNames } from "@/lib/tasks/labels";
import {
  DEFAULT_VISIBILITY_SCOPE,
  normalizeVisibilityScope,
  type VisibilityScope,
} from "@/lib/tasks/utils";

export type { VisibilityScope };

export { DEFAULT_VISIBILITY_SCOPE, normalizeVisibilityScope };

export const VISIBILITY_SCOPE_VALUES = [
  "internal",
  "internal_client",
] as const satisfies readonly VisibilityScope[];

export const VISIBILITY_OPTION_LABELS: Record<VisibilityScope, string> = {
  internal: "Internal only",
  internal_client: "Visible to client",
};

export function formatVisibilityScope(
  value: string | null | undefined
): string {
  const normalized = normalizeVisibilityScope(value);
  return VISIBILITY_OPTION_LABELS[normalized];
}

export const SB_STATUS_OPTIONS = [
  "Not started",
  "In planning",
  "In execution",
  "Finished",
] as const;

export const SB_PRIORITY_OPTIONS = [
  "Low",
  "Medium",
  "High",
  "Urgent",
] as const;

export const RISK_OPTIONS = ["LL", "L", "M", "H", "HH"] as const;

export const PRIORITY_FILTER_OPTIONS = [
  "Critical",
  "High",
  "Medium",
  "Low",
] as const;

export const CLIENT_STATUS_OPTIONS = ["Pending", "Issue", "Complete"] as const;

export const CLIENT_ADD_FIELDS = getAddFieldNames("client");
export const CLIENT_EDIT_FIELDS = getEditFieldNames("client");
export const INTERNAL_ADD_FIELDS = getAddFieldNames("internal");
export const INTERNAL_EDIT_FIELDS = getEditFieldNames("internal");
