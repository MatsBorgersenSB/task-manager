"use client";

import {
  PRIORITY_FILTER_OPTIONS,
  RISK_OPTIONS,
  SB_STATUS_OPTIONS,
} from "@/lib/tasks/constants";
import {
  ACTION_COMMENT_FIELD,
  createFormFieldDef,
  type FormFieldDef,
} from "@/lib/tasks/labels";
import type { AppUser, TaskViewMode } from "@/lib/tasks/types";
import { ui } from "@/lib/ui/classes";

const inputClass = ui.input;
const labelClass = ui.label;
const selectClass = ui.input;
const textareaClass = `${ui.input} ${ui.textarea}`;

type TaskFormFieldsProps = {
  mode: TaskViewMode;
  users: AppUser[];
  /** Omit Task field (used on add form where Issue is rendered separately). */
  omitIssue?: boolean;
  /** Skip the client section header (when rendered above this block). */
  suppressClientHeader?: boolean;
};

export default function TaskFormFields({
  mode,
  users,
  omitIssue = false,
  suppressClientHeader = false,
}: TaskFormFieldsProps) {
  return (
    <>
      {/* ── Client fields (always visible) ── */}
      {!suppressClientHeader ? (
        <FieldSectionHeader title="Client fields" first />
      ) : null}

      {!omitIssue ? (
        <FormFieldControl
          field={createFormFieldDef("Issue", mode, "client")}
          users={users}
        />
      ) : null}

      <FormFieldControl
        field={createFormFieldDef("status", mode, "client")}
        users={users}
      />
      <FormFieldControl
        field={createFormFieldDef("Responsible", mode, "client")}
        users={users}
      />
      <FormFieldControl
        field={createFormFieldDef("CE Comments", mode, "client")}
        users={users}
      />
      <FormFieldControl
        field={createFormFieldDef(ACTION_COMMENT_FIELD, mode, "client", {
          readOnly: mode === "client",
        })}
        users={users}
      />

      {/* ── Internal fields (internal mode only) ── */}
      {mode === "internal" ? (
        <>
          <ClientInternalDivider />

          <FormFieldControl
            field={createFormFieldDef("Risk", mode, "sb")}
            users={users}
          />
          <FormFieldControl
            field={createFormFieldDef("Risk Comment", mode, "sb")}
            users={users}
          />
          <FormFieldControl
            field={createFormFieldDef("Date Due", mode, "sb")}
            users={users}
          />
          <FormFieldControl
            field={createFormFieldDef("Date Completed", mode, "sb")}
            users={users}
          />
          <FormFieldControl
            field={createFormFieldDef("SB Status", mode, "sb")}
            users={users}
          />
          <FormFieldControl
            field={createFormFieldDef("SB Owner", mode, "sb")}
            users={users}
          />
          <FormFieldControl
            field={createFormFieldDef("SB Note", mode, "sb")}
            users={users}
          />
        </>
      ) : null}
    </>
  );
}

function ClientInternalDivider() {
  return (
    <div
      className="my-6 border-t-2 border-blue-400 sm:col-span-2"
      role="separator"
      aria-label="Client and internal fields"
    />
  );
}

function FormFieldControl({
  field,
  users,
}: {
  field: FormFieldDef;
  users: AppUser[];
}) {
  const colSpan = field.colSpan === 2 ? "sm:col-span-2" : "";
  const label = field.label;

  if (field.type === "sb_owner") {
    return (
      <label className={`${labelClass} sm:col-span-2`}>
        {label}
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
                  name="SB Owner"
                  value={user.name}
                  className="rounded border-border text-accent focus:ring-accent/20"
                />
                {user.name}
              </label>
            ))
          )}
        </div>
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className={`${labelClass} ${colSpan}`}>
        {label}
        <textarea
          name={field.name}
          className={`${textareaClass}${field.readOnly ? " bg-background text-muted" : ""}`}
          readOnly={field.readOnly}
          tabIndex={field.readOnly ? -1 : undefined}
        />
      </label>
    );
  }

  if (field.type === "date") {
    return (
      <label className={`${labelClass} ${colSpan}`}>
        {label}
        <input type="date" name={field.name} className={inputClass} />
      </label>
    );
  }

  if (field.type === "select") {
    const options =
      field.name === "Risk"
        ? RISK_OPTIONS
        : field.name === "SB Status"
          ? SB_STATUS_OPTIONS
          : field.name === "Priority"
            ? PRIORITY_FILTER_OPTIONS
            : [];

    return (
      <label className={`${labelClass} ${colSpan}`}>
        {label}
        <select
          name={field.name}
          className={selectClass}
          defaultValue={field.defaultValue ?? ""}
        >
          <option value="">Select...</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className={`${labelClass} ${colSpan}`}>
      {label}
      {field.required ? <span className="text-red-500"> *</span> : null}
      <input
        name={field.name}
        required={field.required}
        defaultValue={field.defaultValue}
        className={inputClass}
        placeholder={
          field.name === "Issue" ? "Describe the task" : undefined
        }
      />
    </label>
  );
}

export function FieldSectionHeader({
  title,
  first = false,
}: {
  title: string;
  first?: boolean;
}) {
  return (
    <div
      className={`sm:col-span-2 ${first ? "" : "mt-2 border-t border-border pt-4"}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </p>
    </div>
  );
}
