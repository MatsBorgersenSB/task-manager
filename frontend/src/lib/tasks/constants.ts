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

export {
  DEFAULT_VISIBILITY_SCOPE,
  VISIBILITY_OPTION_LABELS,
  VISIBILITY_SCOPE_VALUES,
  formatVisibilityScope,
  normalizeVisibilityScope,
  type VisibilityScope,
} from "@/lib/tasks/visibility";
