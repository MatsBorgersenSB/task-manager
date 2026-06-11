export const SB_STATUS_OPTIONS = [
  "Not started",
  "In planning",
  "In execution",
  "Finished",
] as const;

export const RISK_OPTIONS = ["LL", "L", "M", "H", "HH"] as const;

export const PRIORITY_FILTER_OPTIONS = ["High", "Med", "Low"] as const;

export const CLIENT_ADD_FIELDS = [
  "Priority",
  "Responsible",
  "CE Comments",
] as const;

export const INTERNAL_ADD_FIELDS = [
  "status",
  "Priority",
  "Responsible",
  "Risk",
  "Risk Comment",
  "Date Due",
  "Date Completed",
  "SB Status",
  "SB Owner",
  "CE Comments",
  "Response or Action taken by SB",
  "SB Note",
] as const;

export const CLIENT_EDIT_FIELDS = [
  "Issue",
  "Registration Date",
  "status",
  "Priority",
  "Responsible",
  "Risk",
  "Risk Comment",
  "Date Due",
  "Date Completed",
  "CE Comments",
  "Response or Action taken by SB",
] as const;

export const INTERNAL_EDIT_FIELDS = [
  "Issue",
  "Registration Date",
  "status",
  "Priority",
  "Responsible",
  "Risk",
  "Risk Comment",
  "Date Due",
  "Date Completed",
  "SB Status",
  "SB Owner",
  "CE Comments",
  "Response or Action taken by SB",
  "SB Note",
] as const;
