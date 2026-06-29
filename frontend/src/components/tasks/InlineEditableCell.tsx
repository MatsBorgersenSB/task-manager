"use client";

import { useEffect, useRef, useState } from "react";

const HOVER_AFFORDANCE =
  "cursor-pointer rounded px-1 -mx-1 transition-colors hover:bg-gray-50 group/edit";
const DISPLAY_TEXT =
  "group-hover/edit:underline group-hover/edit:decoration-dotted group-hover/edit:decoration-gray-400";
const INPUT_CLASS =
  "h-8 w-full rounded-md border border-border px-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";
const SELECT_CLASS =
  "h-8 w-full rounded-md border border-border px-1 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

type SaveHandler = (value: string) => void | Promise<void>;

export type SyncStatus = "saving" | "saved" | "error";

function SyncIndicator({ status }: { status?: SyncStatus }) {
  if (!status) return null;

  if (status === "saving") {
    return (
      <span className="ml-1 text-[10px] text-gray-400" aria-hidden="true">
        ●
      </span>
    );
  }

  if (status === "saved") {
    return (
      <span className="ml-1 text-[10px] text-green-500" aria-hidden="true">
        ●
      </span>
    );
  }

  return (
    <span className="ml-1 text-[10px] text-red-500" aria-hidden="true">
      ●
    </span>
  );
}

function stopRowClick(event: React.SyntheticEvent) {
  event.stopPropagation();
}

type InlineEditableTextProps = {
  value: string;
  displayValue?: string;
  onSave: SaveHandler;
  status?: SyncStatus;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
};

export function InlineEditableText({
  value,
  displayValue,
  onSave,
  status,
  className = "",
  inputClassName = "",
  placeholder = "—",
}: InlineEditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  async function save() {
    const trimmed = draft.trim();
    if (trimmed === value.trim()) {
      setIsEditing(false);
      return;
    }
    setIsEditing(false);
    try {
      await onSave(trimmed);
    } catch {
      setDraft(value);
    }
  }

  function cancel() {
    setDraft(value);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <span className="inline-flex items-center">
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void save()}
          onClick={stopRowClick}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") {
              event.preventDefault();
              void save();
            }
            if (event.key === "Escape") cancel();
          }}
          className={`${INPUT_CLASS} ${inputClassName}`}
        />
        <SyncIndicator status={status} />
      </span>
    );
  }

  const shown = (displayValue ?? value).trim() || placeholder;

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(event) => {
        stopRowClick(event);
        setIsEditing(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          stopRowClick(event);
          setIsEditing(true);
        }
      }}
      className={`inline-flex items-center ${HOVER_AFFORDANCE} ${DISPLAY_TEXT} ${className}`}
      title="Click to edit"
    >
      {shown}
      <SyncIndicator status={status} />
    </span>
  );
}

type InlineEditableSelectProps = {
  value: string;
  options: readonly string[];
  onSave: SaveHandler;
  status?: SyncStatus;
  display?: React.ReactNode;
  className?: string;
};

export function InlineEditableSelect({
  value,
  options,
  onSave,
  status,
  display,
  className = "",
}: InlineEditableSelectProps) {
  const [isEditing, setIsEditing] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isEditing) selectRef.current?.focus();
  }, [isEditing]);

  async function handleChange(next: string) {
    if (next === value) {
      setIsEditing(false);
      return;
    }
    setIsEditing(false);
    try {
      await onSave(next);
    } catch {
      // Parent reverts optimistic state; display syncs via value prop.
    }
  }

  if (isEditing) {
    const hasCustom = value && !options.includes(value);

    return (
      <span className="inline-flex items-center">
        <select
          ref={selectRef}
          value={value}
          onChange={(event) => void handleChange(event.target.value)}
          onClick={stopRowClick}
          onBlur={() => setIsEditing(false)}
          className={`${SELECT_CLASS} ${className}`}
        >
          <option value="">—</option>
          {hasCustom ? <option value={value}>{value}</option> : null}
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <SyncIndicator status={status} />
      </span>
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(event) => {
        stopRowClick(event);
        setIsEditing(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          stopRowClick(event);
          setIsEditing(true);
        }
      }}
      className={`inline-flex items-center ${HOVER_AFFORDANCE} ${className}`}
      title="Click to edit"
    >
      {display ?? (
        <span className={DISPLAY_TEXT}>{value.trim() || "—"}</span>
      )}
      <SyncIndicator status={status} />
    </span>
  );
}

type InlineEditableDateProps = {
  value: string;
  onSave: SaveHandler;
  status?: SyncStatus;
  className?: string;
  prefix?: string;
};

export function InlineEditableDate({
  value,
  onSave,
  status,
  className = "",
  prefix = "",
}: InlineEditableDateProps) {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  async function handleChange(next: string) {
    if (next === value) {
      setIsEditing(false);
      return;
    }
    setIsEditing(false);
    try {
      await onSave(next);
    } catch {
      // Parent reverts optimistic state; display syncs via value prop.
    }
  }

  if (isEditing) {
    return (
      <span className="inline-flex items-center">
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(event) => void handleChange(event.target.value)}
          onClick={stopRowClick}
          onBlur={() => setIsEditing(false)}
          className={`${INPUT_CLASS} ${className}`}
        />
        <SyncIndicator status={status} />
      </span>
    );
  }

  const shown = value.trim() || "—";

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(event) => {
        stopRowClick(event);
        setIsEditing(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          stopRowClick(event);
          setIsEditing(true);
        }
      }}
      className={`inline-flex items-center ${HOVER_AFFORDANCE} ${DISPLAY_TEXT} ${className}`}
      title="Click to edit"
    >
      {prefix}
      {shown}
      <SyncIndicator status={status} />
    </span>
  );
}
