"use client";

import type { FormFieldDef, TableColumnDef } from "@/lib/tasks/labels";
import {
  type Area,
  areaOptionLabel,
  findAreaByCode,
  findAreaOption,
} from "@/lib/tasks/areas";
import { panelFieldDef } from "@/lib/tasks/panelFields";
import {
  getPanelDraftValue,
  type TaskPanelDraft,
} from "@/lib/tasks/taskPanel";
import type { AppUser, TaskViewMode } from "@/lib/tasks/types";
import { ui } from "@/lib/ui/classes";

const inputClass = ui.input;
const labelClass = ui.label;
const textareaClass = `${ui.input} ${ui.textarea}`;
const AREA_CUSTOM_VALUE = "__custom__";

type TaskPanelFieldProps = {
  column: TableColumnDef;
  mode: TaskViewMode;
  draft: TaskPanelDraft;
  users: AppUser[];
  areas: Area[];
  onFieldChange: (fieldName: string, value: string) => void;
  onAreaChange: (areaName: string, areaCode: string) => void;
  onSbOwnerToggle: (name: string, checked: boolean) => void;
};

function renderSelect(
  def: FormFieldDef,
  value: string,
  onChange: (value: string) => void,
  readOnly: boolean
) {
  const options = def.options ?? [];
  const hasCustom =
    value && !options.includes(value as (typeof options)[number]);

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
      disabled={readOnly}
    >
      {def.type === "select" && !def.defaultValue ? (
        <option value="">Select…</option>
      ) : null}
      {hasCustom ? (
        <option value={value}>{def.optionLabels?.[value] ?? value}</option>
      ) : null}
      {options.map((option) => (
        <option key={option} value={option}>
          {def.optionLabels?.[option] ?? option}
        </option>
      ))}
    </select>
  );
}

function renderAreaField(
  draft: TaskPanelDraft,
  areas: Area[],
  readOnly: boolean,
  onAreaChange: (areaName: string, areaCode: string) => void
) {
  const predefined = findAreaOption(areas, draft.areaName, draft.areaCode);
  const hasCustomValue =
    Boolean((draft.areaName ?? "").trim() || (draft.areaCode ?? "").trim()) &&
    !predefined;
  const selectValue = predefined?.code ?? (hasCustomValue ? AREA_CUSTOM_VALUE : "");

  return (
    <div className="space-y-2">
      <select
        value={selectValue}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "") {
            onAreaChange("", "");
            return;
          }
          if (next === AREA_CUSTOM_VALUE) {
            onAreaChange(draft.areaName, "");
            return;
          }
          const option = findAreaByCode(next, areas);
          if (option) {
            onAreaChange(option.name, option.code);
          }
        }}
        className={inputClass}
        disabled={readOnly}
      >
        <option value="">Select…</option>
        {areas.map((option) => (
          <option key={option.id} value={option.code}>
            {areaOptionLabel(option)}
          </option>
        ))}
        <option value={AREA_CUSTOM_VALUE}>Custom…</option>
      </select>

      {selectValue === AREA_CUSTOM_VALUE ? (
        <input
          type="text"
          value={draft.areaName}
          onChange={(event) => onAreaChange(event.target.value, "")}
          className={inputClass}
          placeholder="Enter custom area"
          readOnly={readOnly}
        />
      ) : null}
    </div>
  );
}

export default function TaskPanelField({
  column,
  mode,
  draft,
  users,
  areas,
  onFieldChange,
  onAreaChange,
  onSbOwnerToggle,
}: TaskPanelFieldProps) {
  const def = panelFieldDef(column, mode);
  if (!def || !column.fieldName) return null;

  const rawValue = getPanelDraftValue(draft, column.fieldName);
  const readOnly = Boolean(def.readOnly);

  if (def.type === "area") {
    return (
      <div className={labelClass}>
        {def.label}
        {renderAreaField(draft, areas, readOnly, onAreaChange)}
      </div>
    );
  }

  if (def.type === "sb_owner") {
    const selected = Array.isArray(rawValue) ? rawValue : [];
    return (
      <div className={labelClass}>
        {def.label}
        <div className="mt-1 grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-border bg-surface p-3">
          {users.length === 0 ? (
            <span className="text-sm text-muted">No users loaded.</span>
          ) : (
            users.map((user) => (
              <label
                key={user.id}
                className="flex items-center gap-2 text-sm text-primary/80"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(user.name)}
                  onChange={(event) =>
                    onSbOwnerToggle(user.name, event.target.checked)
                  }
                  className="rounded border-border text-accent focus:ring-accent/20"
                />
                {user.name}
              </label>
            ))
          )}
        </div>
      </div>
    );
  }

  const value = typeof rawValue === "string" ? rawValue : "";

  return (
    <label className={labelClass}>
      {def.label}
      {def.type === "textarea" ? (
        <textarea
          value={value}
          onChange={(event) => onFieldChange(column.fieldName!, event.target.value)}
          className={`${textareaClass}${readOnly ? " bg-background text-muted" : ""}`}
          rows={3}
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : undefined}
        />
      ) : def.type === "date" ? (
        <input
          type="date"
          value={value}
          onChange={(event) => onFieldChange(column.fieldName!, event.target.value)}
          className={inputClass}
          readOnly={readOnly}
        />
      ) : def.type === "select" ? (
        renderSelect(def, value, (next) => onFieldChange(column.fieldName!, next), readOnly)
      ) : (
        <input
          type="text"
          value={value}
          onChange={(event) => onFieldChange(column.fieldName!, event.target.value)}
          className={inputClass}
          placeholder={column.fieldName === "Issue" ? "Describe the task" : undefined}
          readOnly={readOnly}
        />
      )}
    </label>
  );
}
