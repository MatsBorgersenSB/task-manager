import { getAddFieldNames, getEditFieldNames } from "@/lib/tasks/labels";

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
