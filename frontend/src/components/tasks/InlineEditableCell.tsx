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

type ControlledEditProps = {
  isEditing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  /** When true, display clicks do not enter edit mode (spreadsheet select-first UX). */
  deferActivation?: boolean;
  onCommitNavigate?: (shiftKey: boolean) => void;
};

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

function useControlledEditing({
  isEditing,
  onEditingChange,
}: Pick<ControlledEditProps, "isEditing" | "onEditingChange">) {
  const [internalEditing, setInternalEditing] = useState(false);
  const editing = isEditing ?? internalEditing;

  const setEditing = (next: boolean) => {
    onEditingChange?.(next);
    if (isEditing === undefined) {
      setInternalEditing(next);
    }
  };

  return { editing, setEditing };
}

type InlineEditableTextProps = ControlledEditProps & {
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
  isEditing,
  onEditingChange,
  deferActivation = false,
  onCommitNavigate,
}: InlineEditableTextProps) {
  const { editing, setEditing } = useControlledEditing({
    isEditing,
    onEditingChange,
  });
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function save() {
    const trimmed = draft.trim();
    if (trimmed === value.trim()) {
      setEditing(false);
      return;
    }
    setEditing(false);
    try {
      await onSave(trimmed);
    } catch {
      setDraft(value);
    }
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <span className="inline-flex w-full items-center">
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
            if (event.key === "Tab") {
              event.preventDefault();
              void save().finally(() => onCommitNavigate?.(event.shiftKey));
            }
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
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
      className={`inline-flex items-center ${deferActivation ? "" : `${HOVER_AFFORDANCE} ${DISPLAY_TEXT}`} ${className}`}
      title={deferActivation ? undefined : "Click to edit"}
    >
      {shown}
      <SyncIndicator status={status} />
    </span>
  );
}

type InlineEditableSelectProps = ControlledEditProps & {
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
  isEditing,
  onEditingChange,
  deferActivation = false,
  onCommitNavigate,
}: InlineEditableSelectProps) {
  const { editing, setEditing } = useControlledEditing({
    isEditing,
    onEditingChange,
  });
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (editing) selectRef.current?.focus();
  }, [editing]);

  async function handleChange(next: string) {
    if (next === value) {
      setEditing(false);
      return;
    }
    setEditing(false);
    try {
      await onSave(next);
    } catch {
      // Parent reverts optimistic state; display syncs via value prop.
    }
  }

  if (editing) {
    const hasCustom = value && !options.includes(value);

    return (
      <span className="inline-flex w-full items-center">
        <select
          ref={selectRef}
          value={value}
          onChange={(event) => void handleChange(event.target.value)}
          onClick={stopRowClick}
          onBlur={() => setEditing(false)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") {
              event.preventDefault();
              setEditing(false);
            }
            if (event.key === "Tab") {
              event.preventDefault();
              setEditing(false);
              onCommitNavigate?.(event.shiftKey);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setEditing(false);
            }
          }}
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
      className={`inline-flex items-center ${deferActivation ? "" : `${HOVER_AFFORDANCE} ${DISPLAY_TEXT}`} ${className}`}
      title={deferActivation ? undefined : "Click to edit"}
    >
      {display ?? <span>{value.trim() || "—"}</span>}
      <SyncIndicator status={status} />
    </span>
  );
}

type InlineEditableDateProps = ControlledEditProps & {
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
  isEditing,
  onEditingChange,
  deferActivation = false,
  onCommitNavigate,
}: InlineEditableDateProps) {
  const { editing, setEditing } = useControlledEditing({
    isEditing,
    onEditingChange,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function handleChange(next: string) {
    if (next === value) {
      setEditing(false);
      return;
    }
    setEditing(false);
    try {
      await onSave(next);
    } catch {
      // Parent reverts optimistic state; display syncs via value prop.
    }
  }

  if (editing) {
    return (
      <span className="inline-flex w-full items-center">
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(event) => void handleChange(event.target.value)}
          onClick={stopRowClick}
          onBlur={() => setEditing(false)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") {
              event.preventDefault();
              setEditing(false);
            }
            if (event.key === "Tab") {
              event.preventDefault();
              setEditing(false);
              onCommitNavigate?.(event.shiftKey);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setEditing(false);
            }
          }}
          className={`${INPUT_CLASS} ${className}`}
        />
        <SyncIndicator status={status} />
      </span>
    );
  }

  const shown = value.trim() || "—";

  return (
    <span
      className={`inline-flex items-center ${deferActivation ? "" : `${HOVER_AFFORDANCE} ${DISPLAY_TEXT}`} ${className}`}
      title={deferActivation ? undefined : "Click to edit"}
    >
      {prefix}
      {shown}
      <SyncIndicator status={status} />
    </span>
  );
}
