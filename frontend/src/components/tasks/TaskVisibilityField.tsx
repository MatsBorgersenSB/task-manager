"use client";

import {
  VISIBILITY_OPTION_LABELS,
  type VisibilityScope,
} from "@/lib/tasks/visibility";
import { ui } from "@/lib/ui/classes";

type TaskVisibilityFieldProps = {
  value: string;
  onChange: (value: VisibilityScope) => void;
};

export default function TaskVisibilityField({
  value,
  onChange,
}: TaskVisibilityFieldProps) {
  return (
    <div className="mb-6 rounded-lg border border-border bg-background/80 p-4">
      <label htmlFor="task-visibility" className="block text-sm font-semibold text-primary">
        Task Visibility
      </label>
      <p className="mt-1 text-xs text-muted">
        Internal tasks will NOT be visible in the client dashboard.
      </p>
      <select
        id="task-visibility"
        value={value}
        onChange={(event) => onChange(event.target.value as VisibilityScope)}
        className={`${ui.input} mt-3 w-full`}
        aria-required="true"
      >
        {(["internal_client", "internal"] as const).map((option) => (
          <option key={option} value={option}>
            {VISIBILITY_OPTION_LABELS[option]}
          </option>
        ))}
      </select>
    </div>
  );
}
