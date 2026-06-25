import type { Task, TaskViewMode } from "@/lib/tasks/types";
import { formatAreaDisplay } from "@/lib/tasks/areas";
import { formatVisibilityScope } from "@/lib/tasks/visibility";
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
  "SB Priority": "SB Priority",
  "SB Owner": "SB Owners",
  Risk: "Risk",
  "Risk Comment": "Risk comment",
  "SB Note": "SB Note",
  Priority: "Priority",
  Area: "AREA",
  Visibility: "Visibility",
  "Registration Date": "Registered",
};

export function fieldLabel(fieldName: string): string {
  return FIELD_LABELS[fieldName] ?? fieldName;
}

/** Fields writable from client mode (SB/internal fields stay unchanged on submit). */
export const CLIENT_WRITABLE_FIELDS = new Set([
  "Issue",
  "status",
  "Priority",
  "areaName",
  "areaCode",
  "Responsible",
  "CE Comments",
  "Date Due",
  "Date Completed",
]);

/** Visible in client mode UI (Action Comment last). */
export const CLIENT_VISIBLE_FIELDS = [
  "Issue",
  "Area",
  "status",
  "Priority",
  "Responsible",
  "CE Comments",
  "Date Due",
  "Date Completed",
  "Response or Action taken by SB",
] as const;

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
};

function cellText(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed || "—";
}

const TABLE_ID_CELL = "w-16 text-center";

type TableColumnLayout = {
  cellClass: string;
  wrapContent: boolean;
  innerClass?: string;
  clampedComment?: boolean;
  wrapTextCell?: boolean;
};

/** Width on <td>/<th>; wrap styles live on the inner div when wrapContent is true. */
function tableColumnLayout(field: string): TableColumnLayout {
  switch (field) {
    case "Issue":
      return { cellClass: "min-w-[14rem]", wrapContent: true };
    case "CE Comments":
      return {
        cellClass: "w-[260px] min-w-[260px]",
        wrapContent: false,
        clampedComment: true,
      };
    case "Response or Action taken by SB":
      return {
        cellClass: "w-[320px] min-w-[320px]",
        wrapContent: false,
        clampedComment: true,
      };
    case "Risk Comment":
    case "SB Note":
      return { cellClass: "min-w-[10rem]", wrapContent: true };
    case "Responsible":
    case "SB Owner":
      return { cellClass: "min-w-[8rem]", wrapContent: true };
    case "Area":
      return {
        cellClass: "w-[200px] min-w-[200px] whitespace-normal break-words align-top",
        wrapContent: false,
        wrapTextCell: true,
      };
    case "status":
      return {
        cellClass: "w-[220px] min-w-[220px] whitespace-normal break-words align-top",
        wrapContent: false,
        wrapTextCell: true,
      };
    case "Priority":
      return { cellClass: "w-32 min-w-[8rem] whitespace-nowrap", wrapContent: false };
    case "Visibility":
    case "SB Status":
    case "SB Priority":
    case "Risk":
      return { cellClass: "w-28 whitespace-nowrap", wrapContent: false };
    case "Date Due":
    case "Date Completed":
    case "Registration Date":
      return { cellClass: "w-32 whitespace-nowrap", wrapContent: false };
    default:
      return { cellClass: "min-w-[8rem]", wrapContent: true };
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
      return formatAreaDisplay(task.areaName, task.areaCode);
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

export function getTableColumns(mode: TaskViewMode): TableColumnDef[] {
  const sbBorder = "border-l-2 border-accent/25 pl-4";

  const columns: TableColumnDef[] = [
    {
      id: "id",
      label: "ID",
      group: "meta",
      getValue: (t) => String(t.id),
      headerClass: TABLE_ID_CELL,
      cellClass: TABLE_ID_CELL,
    },
  ];

  if (mode === "client") {
    for (const field of CLIENT_VISIBLE_FIELDS) {
      columns.push(
        columnForField(field, "client", {
          showClientBadge: field === "Issue",
          ...columnLayoutForField(field),
        })
      );
    }
    return columns;
  }

  // Internal: client block → divider at SB Status → SB block
  const clientFields = [
    "Issue",
    "Area",
    "status",
    "Priority",
    "Responsible",
    "Response or Action taken by SB",
    "CE Comments",
    "Date Due",
    "Date Completed",
  ] as const;

  for (const field of clientFields) {
    const layout = columnLayoutForField(field);
    columns.push(
      columnForField(field, "client", {
        showClientBadge: field === "Issue",
        ...layout,
        cellClass:
          field === "Issue"
            ? `${layout.cellClass} font-medium`
            : layout.cellClass,
      })
    );
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
        headerClass:
          index === 0 ? `${sbBorder} ${layout.cellClass}` : layout.cellClass,
        cellClass:
          index === 0 ? `${sbBorder} ${layout.cellClass}` : layout.cellClass,
        wrapContent: layout.wrapContent,
        innerClass: layout.innerClass,
      })
    );
  });

  columns.push({
    id: "links",
    label: "Links",
    group: "sb",
    getValue: () => "",
    cellClass: "min-w-[10rem] align-middle",
    wrapContent: false,
  });

  return columns;
}

export function tableColumnCount(mode: TaskViewMode): number {
  return getTableColumns(mode).length;
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
      "priority",
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
  if (sort === "sb-owners-asc") return `${fieldLabel("SB Owner")} (A–Z)`;
  if (sort === "sb-owners-desc") return `${fieldLabel("SB Owner")} (Z–A)`;
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

export type FormFieldType = "text" | "textarea" | "date" | "select" | "sb_owner" | "area";

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
        : name === "CE Comments" ||
      name === ACTION_COMMENT_FIELD ||
      name === "Risk Comment" ||
      name === "SB Note"
        ? "textarea"
        : name === "Date Due" ||
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
