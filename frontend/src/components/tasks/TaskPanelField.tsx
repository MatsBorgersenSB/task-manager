"use client";

import { useState } from "react";
import type { FormFieldDef, TableColumnDef } from "@/lib/tasks/labels";
import {
  type Area,
  AREA_CUSTOM_VALUE,
  AREA_NONE_VALUE,
  areaOptionLabel,
  findAreaRecordByCode,
  isNoAreaValue,
} from "@/lib/tasks/areas";
import {
  isHideableClientPanelField,
  panelFieldDef,
} from "@/lib/tasks/panelFields";
import {
  getPanelDraftValue,
  type AreaDraftChangeMeta,
  type TaskPanelDraft,
} from "@/lib/tasks/taskPanel";
import { splitInterventionHours } from "@/lib/tasks/interventionDuration";
import type { AppUser, TaskViewMode } from "@/lib/tasks/types";
import { ui } from "@/lib/ui/classes";
import SbOwnerSelect from "@/components/tasks/SbOwnerSelect";

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
  onAreaEditNameChange: (name: string) => void;
  onInterventionDurationChange: (days: number, hours: number) => void;
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

function AreaFieldControl({
  draft,
  areas,
  readOnly,
  onAreaChange,
  onAreaEditNameChange,
}: {
  draft: TaskPanelDraft;
  areas: Area[];
  readOnly: boolean;
  onAreaChange: (
    selectedValue: string,
    customAreaInput: string,
    meta?: AreaDraftChangeMeta
  ) => void;
  onAreaEditNameChange: (name: string) => void;
}) {
  const [showRenameInput, setShowRenameInput] = useState(false);
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
  const missingAreaId = canEditName && !draft.areaSelectedId.trim();

  return (
    <div className="relative z-[1100] space-y-1.5">
      <div className="flex items-center gap-1.5">
        <select
          value={selectedValue}
          onChange={(event) => {
            const next = event.target.value;
            setShowRenameInput(false);
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
              onAreaChange(area.code, "", {
                areaId: area.id,
                editName: area.name,
              });
            }
          }}
          className={`${inputClass} flex-1`}
          disabled={readOnly}
        >
          <option value={AREA_NONE_VALUE}>—</option>
          {areaOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          <option value={AREA_CUSTOM_VALUE}>+ New area…</option>
        </select>

        {canEditName ? (
          <button
            type="button"
            onClick={() => setShowRenameInput((prev) => !prev)}
            className="shrink-0 rounded border border-border/80 bg-slate-50 px-2 py-1.5 text-[11px] font-medium text-muted transition hover:bg-slate-100 hover:text-primary"
            title="Rename this area globally across the project"
          >
            {showRenameInput ? "Done" : "Rename"}
          </button>
        ) : null}
      </div>

      {canEditName && showRenameInput ? (
        <div className="rounded-md border border-border/70 bg-slate-50 p-2">
          <p className="mb-1 text-[10px] font-medium text-muted">
            Rename area label for code <strong className="text-primary">{selectedValue}</strong>:
          </p>
          <input
            type="text"
            value={draft.areaEditName}
            onChange={(event) => onAreaEditNameChange(event.target.value)}
            className={inputClass}
            placeholder="Area name"
            aria-label="Area name"
            disabled={missingAreaId}
          />
          {missingAreaId ? (
            <p className="mt-1 text-xs text-amber-700">
              Select an area before editing
            </p>
          ) : null}
        </div>
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
          placeholder="Enter new area name…"
          readOnly={readOnly}
        />
      ) : null}
    </div>
  );
}

function renderInterventionDurationField(
  draft: TaskPanelDraft,
  readOnly: boolean,
  onInterventionDurationChange: (days: number, hours: number) => void
) {
  const { days, hours } = splitInterventionHours(draft.interventionHours);

  function parseDays(value: string): number {
    return Math.max(0, Number.parseInt(value, 10) || 0);
  }

  function parseHours(value: string): number {
    return Math.min(23, Math.max(0, Number.parseInt(value, 10) || 0));
  }

  return (
    <div className="flex gap-2">
      <label className={`${labelClass} flex-1`}>
        Days
        <input
          type="number"
          min={0}
          value={days === 0 ? "" : days}
          onChange={(event) =>
            onInterventionDurationChange(
              parseDays(event.target.value),
              hours
            )
          }
          className={inputClass}
          disabled={readOnly}
          aria-label="Intervention days"
        />
      </label>
      <label className={`${labelClass} flex-1`}>
        Hours
        <input
          type="number"
          min={0}
          max={23}
          value={hours === 0 ? "" : hours}
          onChange={(event) =>
            onInterventionDurationChange(
              days,
              parseHours(event.target.value)
            )
          }
          className={inputClass}
          disabled={readOnly}
          aria-label="Intervention hours"
        />
      </label>
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
  onAreaEditNameChange,
  onInterventionDurationChange,
  onSbOwnerToggle,
}: TaskPanelFieldProps) {
  const def = panelFieldDef(column, mode);
  if (!def || !column.fieldName) return null;

  const rawValue = getPanelDraftValue(draft, column.fieldName);
  const readOnly = Boolean(def.readOnly);
  const audienceBadge =
    mode === "internal" ? (
      column.group === "sb" ? (
        <span
          className="ml-1.5 inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.2 text-[10px] font-semibold text-amber-800"
          title="Internal (Standard Bio) only — never shown to external clients"
        >
          SB Internal
        </span>
      ) : isHideableClientPanelField(column.fieldName) ? (
        <span
          className="ml-1.5 inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-800"
          title="Shared with client when task visibility includes client"
        >
          Client-facing
        </span>
      ) : null
    ) : null;

  if (def.type === "area") {
    return (
      <div className={labelClass}>
        <span className="inline-flex items-center">
          {def.label}
          {audienceBadge}
        </span>
        <AreaFieldControl
          draft={draft}
          areas={areas}
          readOnly={readOnly}
          onAreaChange={onAreaChange}
          onAreaEditNameChange={onAreaEditNameChange}
        />
      </div>
    );
  }

  if (def.type === "intervention_duration") {
    return (
      <div className={labelClass}>
        <span className="inline-flex items-center">
          {def.label}
          {audienceBadge}
        </span>
        {renderInterventionDurationField(
          draft,
          readOnly,
          onInterventionDurationChange
        )}
      </div>
    );
  }

  if (def.type === "sb_owner") {
    const selected = Array.isArray(rawValue) ? rawValue : [];
    return (
      <div className={labelClass}>
        <span className="inline-flex items-center">
          {def.label}
          {audienceBadge}
        </span>
        <SbOwnerSelect
          users={users}
          selected={selected}
          onToggle={onSbOwnerToggle}
          disabled={readOnly}
        />
      </div>
    );
  }

  const value = typeof rawValue === "string" ? rawValue : "";

  return (
    <label className={labelClass}>
      <span className="inline-flex items-center">
        {def.label}
        {audienceBadge}
      </span>
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
