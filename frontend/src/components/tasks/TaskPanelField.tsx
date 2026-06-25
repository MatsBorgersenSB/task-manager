"use client";

import type { FormFieldDef, TableColumnDef } from "@/lib/tasks/labels";
import {
  type Area,
  AREA_CUSTOM_VALUE,
  AREA_NONE_VALUE,
  areaOptionLabel,
  findAreaRecordByCode,
  isNoAreaValue,
} from "@/lib/tasks/areas";
import { panelFieldDef } from "@/lib/tasks/panelFields";
import {
  getPanelDraftValue,
  type AreaDraftChangeMeta,
  type TaskPanelDraft,
} from "@/lib/tasks/taskPanel";
import type { AppUser, TaskViewMode } from "@/lib/tasks/types";
import { ui } from "@/lib/ui/classes";

const inputClass = ui.input;
const labelClass = ui.label;
const textareaClass = `${ui.input} ${ui.textarea}`;

type TaskPanelFieldProps = {
  column: TableColumnDef;
  mode: TaskViewMode;
  draft: TaskPanelDraft;
  users: AppUser[];
  areas?: Area[];
  onFieldChange: (fieldName: string, value: string) => void;
  onAreaChange: (
    selectedValue: string,
    customAreaInput: string,
    meta?: AreaDraftChangeMeta
  ) => void;
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
  onAreaChange: (
    selectedValue: string,
    customAreaInput: string,
    meta?: AreaDraftChangeMeta
  ) => void
) {
  const areaOptions = areas.map((a) => ({
    value: a.code,
    label: areaOptionLabel(a),
  }));

  const selectedValue = draft.areaSelectedValue;
  const isCustom = selectedValue === AREA_CUSTOM_VALUE;
  const selectedArea = findAreaRecordByCode(selectedValue, areas);
  const canEditName =
    Boolean(selectedArea) &&
    !isCustom &&
    !isNoAreaValue(selectedValue) &&
    !readOnly;

  return (
    <div className="relative z-[1100] space-y-2">
      <select
        value={selectedValue}
        onChange={(event) => {
          const next = event.target.value;
          if (isNoAreaValue(next)) {
            onAreaChange(AREA_NONE_VALUE, "", { areaId: "", editName: "" });
            return;
          }
          if (next === AREA_CUSTOM_VALUE) {
            onAreaChange(AREA_CUSTOM_VALUE, draft.customAreaInput, {
              areaId: "",
              editName: "",
            });
            return;
          }
          const area = findAreaRecordByCode(next, areas);
          if (area) {
            onAreaChange(area.code, "", { areaId: area.id, editName: area.name });
          }
        }}
        className={inputClass}
        disabled={readOnly}
      >
        <option value={AREA_NONE_VALUE}>—</option>
        {areaOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        <option value={AREA_CUSTOM_VALUE}>Custom…</option>
      </select>

      {canEditName ? (
        <input
          type="text"
          value={draft.areaEditName}
          onChange={(event) =>
            onAreaChange(selectedValue, "", {
              areaId: draft.areaSelectedId,
              editName: event.target.value,
            })
          }
          className={inputClass}
          placeholder="Area name"
          aria-label="Area name"
        />
      ) : null}

      {isCustom ? (
        <input
          type="text"
          value={draft.customAreaInput}
          onChange={(event) =>
            onAreaChange(AREA_CUSTOM_VALUE, event.target.value, {
              areaId: "",
              editName: "",
            })
          }
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
  areas = [],
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
