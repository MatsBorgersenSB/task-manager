import type { Task, TaskViewMode } from "@/lib/tasks/types";
import { normalizeDateInput } from "@/lib/tasks/utils";

/** Internal form/DB field name → display label (schema unchanged). */
export const FIELD_LABELS: Record<string, string> = {
  Issue: "Task",
  status: "Client Status",
  "CE Comments": "Client Comment",
  "Response or Action taken by SB": "Action Comment",
  Responsible: "Responsible",
  "Date Due": "Date Due",
  "Date Completed": "Date Completed",
  "SB Status": "SB Status",
  "SB Owner": "SB Owners",
  Risk: "Risk",
  "Risk Comment": "Risk comment",
  "SB Note": "SB Note",
  Priority: "Priority",
  "Registration Date": "Registered",
};

export function fieldLabel(fieldName: string): string {
  return FIELD_LABELS[fieldName] ?? fieldName;
}

/** Fields writable from client mode (SB/internal fields stay unchanged on submit). */
export const CLIENT_WRITABLE_FIELDS = new Set([
  "Issue",
  "status",
  "Responsible",
  "CE Comments",
  "Date Due",
  "Date Completed",
]);

/** Visible in client mode UI (Action Comment last). */
export const CLIENT_VISIBLE_FIELDS = [
  "Issue",
  "status",
  "Responsible",
  "CE Comments",
  "Date Due",
  "Date Completed",
  "Response or Action taken by SB",
] as const;

/** Full field order for internal mode (table, export, forms). */
export const INTERNAL_FIELD_ORDER = [
  "Issue",
  "status",
  "Responsible",
  "Response or Action taken by SB",
  "CE Comments",
  "Date Due",
  "Date Completed",
  "SB Status",
  "SB Owner",
  "Risk",
  "Risk Comment",
  "SB Note",
] as const;

export type FieldGroup = "meta" | "client" | "sb" | "other";

export type TableColumnDef = {
  id: string;
  label: string;
  group: FieldGroup;
  getValue: (task: Task) => string;
  headerClass?: string;
  cellClass?: string;
  showClientBadge?: boolean;
};

function cellText(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed || "—";
}

function fieldValue(task: Task, field: string): string {
  switch (field) {
    case "Issue":
      return cellText(task.Issue);
    case "status":
      return cellText(task.status);
    case "Responsible":
      return cellText(task.Responsible);
    case "CE Comments":
      return cellText(task["CE Comments"]);
    case "Response or Action taken by SB":
      return cellText(task["Response or Action taken by SB"]);
    case "Date Due":
      return normalizeDateInput(task["Date Due"]) || "—";
    case "Date Completed":
      return normalizeDateInput(task["Date Completed"]) || "—";
    case "SB Status":
      return cellText(task["SB Status"]);
    case "SB Owner":
      return cellText(task["SB Owner"]);
    case "Risk":
      return cellText(task.Risk);
    case "Risk Comment":
      return cellText(task["Risk Comment"]);
    case "SB Note":
      return cellText(task["SB Note"]);
    default:
      return "—";
  }
}

function columnForField(
  field: string,
  group: FieldGroup,
  extra?: Partial<TableColumnDef>
): TableColumnDef {
  const id = field.replace(/\s+/g, "_").toLowerCase();
  return {
    id,
    label: fieldLabel(field),
    group,
    getValue: (task) => fieldValue(task, field),
    ...extra,
  };
}

export function getTableColumns(mode: TaskViewMode): TableColumnDef[] {
  const sbBorder = "border-l-2 border-accent/25 pl-4";

  const columns: TableColumnDef[] = [
    {
      id: "id",
      label: "ID",
      group: "meta",
      getValue: (t) => String(t.id),
    },
  ];

  if (mode === "client") {
    for (const field of CLIENT_VISIBLE_FIELDS) {
      columns.push(
        columnForField(field, "client", {
          showClientBadge: field === "Issue",
          cellClass:
            field === "Issue"
              ? "max-w-[14rem] print:max-w-none print:whitespace-normal"
              : field === "CE Comments" ||
                  field === "Response or Action taken by SB"
                ? "max-w-[12rem] truncate print:max-w-none print:whitespace-normal"
                : undefined,
        })
      );
    }
    return columns;
  }

  // Internal: client block → divider at SB Status → SB block
  const clientFields = [
    "Issue",
    "status",
    "Responsible",
    "Response or Action taken by SB",
    "CE Comments",
    "Date Due",
    "Date Completed",
  ] as const;

  for (const field of clientFields) {
    columns.push(
      columnForField(field, "client", {
        showClientBadge: field === "Issue",
        cellClass:
          field === "Issue"
            ? "max-w-[14rem] font-medium truncate print:max-w-none print:whitespace-normal"
            : field === "CE Comments" || field === "Response or Action taken by SB"
              ? "max-w-[12rem] truncate print:max-w-none print:whitespace-normal"
              : undefined,
      })
    );
  }

  const sbFields = [
    "SB Status",
    "SB Owner",
    "Risk",
    "Risk Comment",
    "SB Note",
  ] as const;

  sbFields.forEach((field, index) => {
    columns.push(
      columnForField(field, "sb", {
        headerClass: index === 0 ? sbBorder : undefined,
        cellClass:
          index === 0
            ? sbBorder
            : field === "SB Owner" || field === "Risk Comment"
              ? "max-w-[10rem] truncate print:max-w-none print:whitespace-normal"
              : undefined,
      })
    );
  });

  return columns;
}

export function tableColumnCount(mode: TaskViewMode): number {
  return getTableColumns(mode).length + 1;
}

/** Export column ids in display order; filtered by mode in export.ts */
export const EXPORT_COLUMN_ORDER = [
  "id",
  "title",
  "status",
  "assigned",
  "response",
  "description",
  "due",
  "completed",
  "sb_status",
  "sb_owner",
  "risk",
  "risk_comment",
  "sb_note",
] as const;

export function exportColumnIdsForMode(mode: TaskViewMode): string[] {
  if (mode === "client") {
    return [
      "id",
      "title",
      "status",
      "assigned",
      "description",
      "due",
      "completed",
      "response",
    ];
  }
  return [...EXPORT_COLUMN_ORDER];
}

export function defaultExportColumnIds(mode: TaskViewMode): string[] {
  return exportColumnIdsForMode(mode);
}

export function filterStatusLabel(): string {
  return fieldLabel("status");
}

export function sortOptionLabel(sort: string): string {
  if (sort === "status") return fieldLabel("status");
  if (sort === "sb-status") return fieldLabel("SB Status");
  if (sort === "priority") return fieldLabel("Priority");
  if (sort === "due-asc") return "Due date (earliest)";
  if (sort === "due-desc") return "Due date (latest)";
  if (sort === "id") return "ID (default)";
  return sort;
}

const COMPANY_DOMAIN = (
  process.env.NEXT_PUBLIC_COMPANY_EMAIL_DOMAIN ?? "yourcompany.com"
).toLowerCase();

/** True when the task was created by an external (client) user. */
export function isClientCreatedTask(task: Task): boolean {
  if (task._createdByRole === "external") return true;
  if (task._createdByRole === "admin" || task._createdByRole === "internal") {
    return false;
  }
  if (task._createdByEmail) {
    const domain =
      task._createdByEmail.split("@")[1]?.toLowerCase().trim() ?? "";
    return domain !== "" && domain !== COMPANY_DOMAIN;
  }
  return false;
}

export type FormFieldType = "text" | "textarea" | "date" | "select" | "sb_owner";

/** DB/form field name for Action Comment (label: "Action Comment"). */
export const ACTION_COMMENT_FIELD = "Response or Action taken by SB" as const;

export type FormFieldDef = {
  name: string;
  label: string;
  type: FormFieldType;
  section: "client" | "sb" | "other";
  colSpan?: 2;
  required?: boolean;
  readOnly?: boolean;
  defaultValue?: string;
  options?: readonly string[];
  modes: TaskViewMode[];
};

export function createFormFieldDef(
  name: string,
  mode: TaskViewMode,
  section: FormFieldDef["section"],
  extra?: Partial<FormFieldDef>
): FormFieldDef {
  return {
    name,
    label: fieldLabel(name),
    type:
      name === "CE Comments" ||
      name === ACTION_COMMENT_FIELD ||
      name === "Risk Comment" ||
      name === "SB Note"
        ? "textarea"
        : name === "Date Due" ||
            name === "Date Completed" ||
            name === "Registration Date"
          ? "date"
          : name === "Risk" || name === "SB Status" || name === "Priority"
            ? "select"
            : name === "SB Owner"
              ? "sb_owner"
              : "text",
    section,
    colSpan:
      name === "Issue" ||
      name === "CE Comments" ||
      name === ACTION_COMMENT_FIELD ||
      name === "Risk Comment" ||
      name === "SB Note" ||
      name === "SB Owner"
        ? 2
        : undefined,
    required: name === "Issue",
    defaultValue: name === "status" ? "Open" : undefined,
    modes: mode === "client" ? ["client"] : ["internal"],
    ...extra,
  };
}

/** Client-section form fields (above divider). */
export const CLIENT_FORM_FIELDS = [
  "Issue",
  "status",
  "Responsible",
  "CE Comments",
  ACTION_COMMENT_FIELD,
] as const;

/** Internal-section form fields (below divider, internal mode only). */
export const INTERNAL_FORM_FIELDS = [
  "Risk",
  "Risk Comment",
  "Date Due",
  "Date Completed",
  "SB Status",
  "SB Owner",
  "SB Note",
] as const;

export function getFormFields(mode: TaskViewMode): FormFieldDef[] {
  const clientSection = CLIENT_FORM_FIELDS.map((name) =>
    createFormFieldDef(name, mode, "client", {
      readOnly: mode === "client" && name === ACTION_COMMENT_FIELD,
    })
  );

  if (mode === "client") {
    return clientSection;
  }

  const internalSection = INTERNAL_FORM_FIELDS.map((name) =>
    createFormFieldDef(name, mode, "sb")
  );

  return [...clientSection, ...internalSection];
}

export function getEditFieldNames(mode: TaskViewMode): string[] {
  return getFormFields(mode).map((f) => f.name);
}

export function getAddFieldNames(mode: TaskViewMode): string[] {
  return getFormFields(mode)
    .filter((f) => f.name !== "Issue")
    .map((f) => f.name);
}
