import type { Task, TaskViewMode } from "@/lib/tasks/types";
import { formatAreaCodeOnly } from "@/lib/tasks/areas";
import { formatVisibilityScope } from "@/lib/tasks/visibility";
import { normalizeDateInput } from "@/lib/tasks/utils";
import { formatInterventionDuration } from "@/lib/tasks/interventionDuration";

/** Internal form/DB field name → display label (schema unchanged). */
export const FIELD_LABELS: Record<string, string> = {
  Issue: "Issue",
  status: "Client Status",
  "CE Comments": "Client Comment",
  "Response or Action taken by SB": "Action Comment",
  Responsible: "Responsible",
  "Date Due": "Date Due",
  "Intervention Date": "Intervention Date",
  "Intervention Duration": "Intervention Duration",
  "Date Completed": "Date Completed",
  "SB Status": "SB Status",
  "SB Priority": "SB Priority",
  "SB Owner": "SB Owners",
  Risk: "Risk",
  "Risk Comment": "Risk comment",
  "SB Note": "SB Note",
  Priority: "Priority",
  Area: "AREA",
  Visibility: "Task Visibility",
  "Registration Date": "Registered",
};

export function fieldLabel(fieldName: string): string {
  return FIELD_LABELS[fieldName] ?? fieldName;
}

/** Client-facing label overrides (Part 10 — customer-friendly terminology). */
const CLIENT_FIELD_LABEL_OVERRIDES: Partial<Record<string, string>> = {
  status: "Status",
  "Response or Action taken by SB": "Project Notes",
  "CE Comments": "Your Notes",
};

export function fieldLabelForMode(
  fieldName: string,
  mode: TaskViewMode
): string {
  if (mode === "client") {
    const override = CLIENT_FIELD_LABEL_OVERRIDES[fieldName];
    if (override) return override;
  }
  return fieldLabel(fieldName);
}

/** Fields writable from client mode (SB/internal fields stay unchanged on submit). */
export const CLIENT_WRITABLE_FIELDS = new Set([
  "Issue",
  "status",
  "areaName",
  "areaCode",
  "Responsible",
  "CE Comments",
  "Date Due",
  "Intervention Date",
  "Intervention Duration",
  "Date Completed",
]);

/** Client MVP — table, panel, and export (no priority or action comments). */
export const CLIENT_VISIBLE_FIELDS = [
  "status",
  "Date Due",
  "Intervention Date",
  "Date Completed",
  "Responsible",
  "CE Comments",
] as const;

/** Default internal table columns (always visible). */
export const INTERNAL_DEFAULT_TABLE_FIELDS = [
  "status",
  "Date Due",
  "Responsible",
  "CE Comments",
] as const;

/** Optional internal columns — hidden by default to reduce clutter. */
export const INTERNAL_OPTIONAL_TABLE_FIELDS = [
  "Response or Action taken by SB",
  "Priority",
  "Intervention Date",
  "Intervention Duration",
  "Date Completed",
] as const;

export type TableColumnOptions = {
  showOptionalColumns?: boolean;
};

/** Full field order for internal mode (table, export, forms). */
export const INTERNAL_FIELD_ORDER = [
  "Issue",
  "Area",
  "status",
  "Priority",
  "Responsible",
  "Response or Action taken by SB",
  "CE Comments",
  "Date Due",
  "Intervention Date",
  "Intervention Duration",
  "Date Completed",
  "SB Status",
  "SB Priority",
  "Visibility",
  "SB Owner",
  "Risk",
  "Risk Comment",
  "SB Note",
] as const;

export type FieldGroup = "meta" | "client" | "sb" | "other";

export type TableColumnDef = {
  id: string;
  /** Original task field name (e.g. "CE Comments"). Omitted for non-editable meta columns. */
  fieldName?: string;
  label: string;
  group: FieldGroup;
  getValue: (task: Task) => string;
  headerClass?: string;
  cellClass?: string;
  /** Wrap cell value in an inner div so max-width and break-words apply reliably. */
  wrapContent?: boolean;
  innerClass?: string;
  showClientBadge?: boolean;
  /** Clamp long comment text with hover popup (table cells). */
  clampedComment?: boolean;
  /** Status / area cells: normal wrap + line height (no nowrap). */
  wrapTextCell?: boolean;
  /** Fixed width for table-fixed colgroup alignment. */
  colWidth?: string;
};

function cellText(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed || "—";
}

const TABLE_ID_CELL = "min-w-0 text-center";

const LEADING_TABLE_FIELDS = new Set(["Area", "Issue"]);

function idTableColumn(): TableColumnDef {
  return {
    id: "id",
    label: "ID",
    group: "meta",
    getValue: (t) => String(t.id),
    colWidth: "52px",
    headerClass: TABLE_ID_CELL,
    cellClass: TABLE_ID_CELL,
  };
}

function subtasksTableColumn(): TableColumnDef {
  return {
    id: "subtasks",
    label: "SUBTASKS",
    group: "meta",
    getValue: () => "",
    colWidth: "80px",
    headerClass: "min-w-0 align-middle text-center",
    cellClass: "min-w-0 align-middle text-center",
    wrapContent: false,
  };
}

function leadingTableColumns(): TableColumnDef[] {
  const areaLayout = columnLayoutForField("Area");
  const issueLayout = columnLayoutForField("Issue");

  return [
    idTableColumn(),
    columnForField("Area", "client", {
      ...areaLayout,
    }),
    columnForField("Issue", "client", {
      showClientBadge: true,
      ...issueLayout,
      headerClass: issueLayout.cellClass,
      cellClass: `${issueLayout.cellClass} font-medium`,
    }),
    subtasksTableColumn(),
  ];
}

function appendFieldColumns(
  columns: TableColumnDef[],
  fields: readonly string[]
): void {
  for (const field of fields) {
    if (LEADING_TABLE_FIELDS.has(field)) continue;

    const layout = columnLayoutForField(field);
    columns.push(
      columnForField(field, "client", {
        ...layout,
      })
    );
  }
}

type TableColumnLayout = {
  cellClass: string;
  colWidth: string;
  wrapContent: boolean;
  innerClass?: string;
  clampedComment?: boolean;
  wrapTextCell?: boolean;
};

/** Width on <td>/<th>; wrap styles live on the inner div when wrapContent is true. */
function tableColumnLayout(field: string): TableColumnLayout {
  switch (field) {
    case "Issue":
      return {
        colWidth: "280px",
        cellClass: "min-w-0 whitespace-normal break-words align-top",
        wrapContent: true,
      };
    case "CE Comments":
      return {
        colWidth: "240px",
        cellClass: "min-w-0 align-top",
        wrapContent: false,
        clampedComment: true,
      };
    case "Response or Action taken by SB":
      return {
        colWidth: "260px",
        cellClass: "min-w-0 align-top",
        wrapContent: false,
        clampedComment: true,
      };
    case "Risk Comment":
      return {
        colWidth: "200px",
        cellClass: "min-w-0 align-top",
        wrapContent: false,
        clampedComment: true,
      };
    case "SB Note":
      return {
        colWidth: "200px",
        cellClass: "min-w-0 align-top",
        wrapContent: false,
        clampedComment: true,
      };
    case "Responsible":
      return {
        colWidth: "96px",
        cellClass: "min-w-0 whitespace-normal break-words align-top",
        wrapContent: false,
        wrapTextCell: true,
      };
    case "SB Owner":
      return {
        colWidth: "104px",
        cellClass: "min-w-0 align-top",
        wrapContent: true,
      };
    case "Area":
      return {
        colWidth: "72px",
        cellClass:
          "min-w-0 whitespace-nowrap overflow-hidden text-ellipsis align-top",
        wrapContent: false,
      };
    case "status":
      return {
        colWidth: "108px",
        cellClass: "min-w-0 whitespace-normal break-words align-top",
        wrapContent: false,
        wrapTextCell: true,
      };
    case "Priority":
      return {
        colWidth: "88px",
        cellClass: "min-w-0 whitespace-nowrap align-top",
        wrapContent: false,
      };
    case "Visibility":
    case "SB Status":
    case "SB Priority":
    case "Risk":
      return {
        colWidth: "96px",
        cellClass: "min-w-0 whitespace-nowrap align-top",
        wrapContent: false,
      };
    case "Date Due":
    case "Intervention Date":
    case "Date Completed":
    case "Registration Date":
      return {
        colWidth: "104px",
        cellClass: "min-w-0 whitespace-nowrap align-top",
        wrapContent: false,
      };
    case "Intervention Duration":
      return {
        colWidth: "112px",
        cellClass: "min-w-0 whitespace-nowrap align-top",
        wrapContent: false,
      };
    default:
      return {
        colWidth: "120px",
        cellClass: "min-w-0 whitespace-normal break-words align-top",
        wrapContent: true,
      };
  }
}

function columnLayoutForField(
  field: string,
  extra?: Partial<TableColumnDef>
): Partial<TableColumnDef> {
  const layout = tableColumnLayout(field);
  return {
    headerClass: layout.cellClass,
    cellClass: layout.cellClass,
    colWidth: layout.colWidth,
    wrapContent: layout.wrapContent,
    innerClass: layout.innerClass,
    clampedComment: layout.clampedComment,
    wrapTextCell: layout.wrapTextCell,
    ...extra,
  };
}

function fieldValue(task: Task, field: string): string {
  switch (field) {
    case "Issue":
      return cellText(task.Issue);
    case "Area":
      return formatAreaCodeOnly(task.areaCode);
    case "status":
      return cellText(task.status);
    case "Priority":
      return cellText(task.Priority);
    case "Visibility":
      return formatVisibilityScope(task.visibility_scope ?? undefined);
    case "Responsible":
      return cellText(task.Responsible);
    case "CE Comments":
      return (task["CE Comments"] ?? "").trim();
    case "Response or Action taken by SB":
      return (task["Response or Action taken by SB"] ?? "").trim();
    case "Date Due":
      return normalizeDateInput(task["Date Due"]) || "—";
    case "Intervention Date":
      return (
        normalizeDateInput(
          task["Intervention Date"] ?? task.intervention_date
        ) || "—"
      );
    case "Intervention Duration":
      return formatInterventionDuration(task.intervention_hours ?? 0) || "—";
    case "Date Completed":
      return normalizeDateInput(task["Date Completed"]) || "—";
    case "SB Status":
      return cellText(task["SB Status"]);
    case "SB Priority":
      return cellText(task["SB Priority"]);
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
    fieldName: field,
    label: fieldLabel(field),
    group,
    getValue: (task) => fieldValue(task, field),
    ...extra,
  };
}

function linksTableColumn(group: FieldGroup = "client"): TableColumnDef {
  return {
    id: "links",
    label: "Links",
    group,
    getValue: () => "",
    colWidth: "120px",
    headerClass: "min-w-0 align-middle",
    cellClass: "min-w-0 align-middle",
    wrapContent: false,
  };
}

export function getTableColumns(
  mode: TaskViewMode,
  options: TableColumnOptions = {}
): TableColumnDef[] {
  const { showOptionalColumns = false } = options;
  const sbBorder = "border-l-2 border-accent/25 pl-4";
  const columns = leadingTableColumns();

  if (mode === "client") {
    appendFieldColumns(columns, CLIENT_VISIBLE_FIELDS);
    columns.push(linksTableColumn("client"));
    for (const col of columns) {
      if (col.fieldName) {
        col.label = fieldLabelForMode(col.fieldName, mode);
      }
    }
    return columns;
  }

  appendFieldColumns(columns, [...INTERNAL_DEFAULT_TABLE_FIELDS]);

  if (showOptionalColumns) {
    appendFieldColumns(columns, [...INTERNAL_OPTIONAL_TABLE_FIELDS]);
  }

  const sbFields = [
    "SB Status",
    "SB Priority",
    "Visibility",
    "SB Owner",
    "Risk",
    "Risk Comment",
    "SB Note",
  ] as const;

  sbFields.forEach((field, index) => {
    const layout = columnLayoutForField(field);
    columns.push(
      columnForField(field, "sb", {
        ...layout,
        headerClass:
          index === 0 ? `${sbBorder} ${layout.cellClass}` : layout.cellClass,
        cellClass:
          index === 0 ? `${sbBorder} ${layout.cellClass}` : layout.cellClass,
      })
    );
  });

  columns.push(linksTableColumn("sb"));

  return columns;
}

export function getTableColumnIds(
  mode: TaskViewMode,
  options?: TableColumnOptions
): string[] {
  return getTableColumns(mode, options).map((col) => col.id);
}

export function tableColumnCount(
  mode: TaskViewMode,
  options?: TableColumnOptions
): number {
  return getTableColumns(mode, options).length;
}

/** Export column ids in display order; filtered by mode in export.ts */
export const EXPORT_COLUMN_ORDER = [
  "id",
  "title",
  "area",
  "status",
  "priority",
  "assigned",
  "response",
  "description",
  "due",
  "intervention",
  "intervention_hours",
  "completed",
  "sb_status",
  "sb_priority",
  "visibility_scope",
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
      "area",
      "status",
      "assigned",
      "description",
      "due",
      "intervention",
      "intervention_hours",
      "completed",
    ];
  }
  return [...EXPORT_COLUMN_ORDER];
}

export function defaultExportColumnIds(mode: TaskViewMode): string[] {
  return exportColumnIdsForMode(mode);
}

export function filterStatusLabel(mode: TaskViewMode = "internal"): string {
  return fieldLabelForMode("status", mode);
}

export function sortOptionLabel(sort: string): string {
  if (sort === "status") return fieldLabel("status");
  if (sort === "sb-status") return fieldLabel("SB Status");
  if (sort === "sb-owners-asc") return `${fieldLabel("SB Owner")} (A–Z)`;
  if (sort === "sb-owners-desc") return `${fieldLabel("SB Owner")} (Z–A)`;
  if (sort === "priority") return fieldLabel("Priority");
  if (sort === "due-asc") return "Due date (earliest)";
  if (sort === "due-desc") return "Due date (latest)";
  if (sort === "id-desc") return "ID (high to low)";
  if (sort === "id") return "ID (low to high)";
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

export type FormFieldType =
  | "text"
  | "textarea"
  | "date"
  | "select"
  | "sb_owner"
  | "area"
  | "intervention_duration";

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
  optionLabels?: Record<string, string>;
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
      name === "Area"
        ? "area"
        : name === "Intervention Duration"
          ? "intervention_duration"
        : name === "CE Comments" ||
      name === ACTION_COMMENT_FIELD ||
      name === "Risk Comment" ||
      name === "SB Note"
        ? "textarea"
        : name === "Date Due" ||
            name === "Intervention Date" ||
            name === "Date Completed" ||
            name === "Registration Date"
          ? "date"
            : name === "Risk" || name === "SB Status" || name === "SB Priority" || name === "Priority" || name === "status" || name === "Visibility"
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
    defaultValue:
      name === "status"
        ? "Pending"
        : name === "Visibility"
          ? "internal_client"
          : undefined,
    modes: mode === "client" ? ["client"] : ["internal"],
    ...extra,
  };
}

/** Client-section form fields (above divider). */
export const CLIENT_FORM_FIELDS = [
  "Issue",
  "status",
  "Priority",
  "Responsible",
  "CE Comments",
  ACTION_COMMENT_FIELD,
] as const;

/** Internal-section form fields (below divider, internal mode only). */
export const INTERNAL_FORM_FIELDS = [
  "Risk",
  "Risk Comment",
  "Date Due",
  "Intervention Date",
  "Intervention Duration",
  "Date Completed",
  "SB Status",
  "SB Priority",
  "Visibility",
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
    return CLIENT_VISIBLE_FIELDS.map((name) =>
      createFormFieldDef(name, mode, "client")
    );
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
