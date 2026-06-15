"use client";

import {
  CLIENT_STATUS_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
  RISK_OPTIONS,
  SB_PRIORITY_OPTIONS,
  SB_STATUS_OPTIONS,
} from "@/lib/tasks/constants";
import { fieldLabel } from "@/lib/tasks/labels";
import type { AppUser, TaskViewMode } from "@/lib/tasks/types";
import { ui } from "@/lib/ui/classes";

const inputClass = ui.input;
const labelClass = ui.label;
const selectClass = ui.input;
const textareaClass = `${ui.input} ${ui.textarea}`;

const ACTION_COMMENT_NAME = "Response or Action taken by SB";

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
  const actionCommentReadOnly = mode === "client";

  return (
    <>
      {!suppressClientHeader ? (
        <FieldSectionHeader title="Client fields" first />
      ) : null}

      {!omitIssue ? (
        <label className={`${labelClass} sm:col-span-2`}>
          {fieldLabel("Issue")} <span className="text-red-500">*</span>
          <input
            name="Issue"
            required
            className={inputClass}
            placeholder="Describe the task"
          />
        </label>
      ) : null}

      <label className={labelClass}>
        {fieldLabel("status")}
        <select name="status" className={selectClass} defaultValue="Pending">
          {CLIENT_STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      {/* 1. Responsible */}
      <label className={labelClass}>
        {fieldLabel("Responsible")}
        <input name="Responsible" className={inputClass} />
      </label>

      {/* 2. CE Comments (Client Comment) — directly after Responsible */}
      <label className={`${labelClass} sm:col-span-2`}>
        {fieldLabel("CE Comments")}
        <textarea name="CE Comments" className={textareaClass} />
      </label>

      {/* 3. Response or Action taken by SB (Action Comment) — directly after CE Comments */}
      <label className={`${labelClass} sm:col-span-2`}>
        {fieldLabel(ACTION_COMMENT_NAME)}
        <textarea
          name={ACTION_COMMENT_NAME}
          className={`${textareaClass}${actionCommentReadOnly ? " bg-background text-muted" : ""}`}
          readOnly={actionCommentReadOnly}
          tabIndex={actionCommentReadOnly ? -1 : undefined}
        />
      </label>

      {mode === "internal" ? (
        <>
          {/* Divider — after Action Comment, before internal fields */}
          <div className="my-6 border-t-2 border-blue-400 sm:col-span-2" />

          {/* 4. Risk — below divider */}
          <label className={labelClass}>
            {fieldLabel("Risk")}
            <select name="Risk" className={selectClass} defaultValue="">
              <option value="">Select...</option>
              {RISK_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          {/* 5. Risk Comment — below Risk */}
          <label className={`${labelClass} sm:col-span-2`}>
            {fieldLabel("Risk Comment")}
            <textarea name="Risk Comment" className={textareaClass} />
          </label>

          <label className={labelClass}>
            {fieldLabel("Date Due")}
            <input type="date" name="Date Due" className={inputClass} />
          </label>

          <label className={labelClass}>
            {fieldLabel("Date Completed")}
            <input type="date" name="Date Completed" className={inputClass} />
          </label>

          <label className={labelClass}>
            {fieldLabel("SB Status")}
            <select name="SB Status" className={selectClass} defaultValue="">
              <option value="">Select...</option>
              {SB_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            {fieldLabel("SB Priority")}
            <select name="SB Priority" className={selectClass} defaultValue="">
              <option value="">Select...</option>
              {SB_PRIORITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className={`${labelClass} sm:col-span-2`}>
            {fieldLabel("SB Owner")}
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

          <label className={`${labelClass} sm:col-span-2`}>
            {fieldLabel("SB Note")}
            <textarea name="SB Note" className={textareaClass} />
          </label>
        </>
      ) : null}
    </>
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
