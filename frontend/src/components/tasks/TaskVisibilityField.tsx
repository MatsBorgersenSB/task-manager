"use client";

import {
  VISIBILITY_OPTION_LABELS,
  type VisibilityScope,
} from "@/lib/tasks/visibility";
import { ui } from "@/lib/ui/classes";

type TaskVisibilityFieldProps = {
  value: string;
  onChange: (value: VisibilityScope) => void;
  embedded?: boolean;
};

export default function TaskVisibilityField({
  value,
  onChange,
  embedded = false,
}: TaskVisibilityFieldProps) {
  return (
    <div className={embedded ? "" : "space-y-2"}>
      <label htmlFor="task-visibility" className={ui.label}>
        Task visibility
      </label>
      <p className="text-xs text-muted">
        Internal tasks are not visible in the client dashboard.
      </p>
      <select
        id="task-visibility"
        value={value}
        onChange={(event) => onChange(event.target.value as VisibilityScope)}
        className={ui.input}
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
