import type { ProjectDeleteImpact } from "@/lib/projects/lifecycle";
import { formatProjectAge } from "@/lib/projects/lifecycleDisplay";

type ProjectImpactSummaryProps = {
  impact: ProjectDeleteImpact;
  compact?: boolean;
};

export default function ProjectImpactSummary({
  impact,
  compact = false,
}: ProjectImpactSummaryProps) {
  const items = [
    { label: "Tasks", value: impact.tasks_total },
    { label: "Main tasks", value: impact.main_tasks },
    { label: "Subtasks", value: impact.subtasks },
    { label: "Comments", value: impact.comments },
    { label: "Activity entries", value: impact.activity_entries },
    { label: "Shared users", value: impact.users_assigned },
    { label: "Invitations", value: impact.invitations },
  ];

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="rounded-lg border border-border bg-slate-50/80 p-4">
        <p className="text-sm font-semibold text-primary">{impact.project_name}</p>
        <p className="mt-1 text-xs text-muted">
          {formatProjectAge(impact.project_age_days)} · Status: {impact.project_status}
        </p>
        {impact.template_name ? (
          <p className="mt-2 text-xs text-muted">
            Project template: <span className="font-medium text-primary">{impact.template_name}</span>
          </p>
        ) : null}
      </div>

      <div>
        <p className="text-sm font-medium text-primary">This project contains:</p>
        <ul className={`mt-2 ${compact ? "grid gap-1 sm:grid-cols-2" : "space-y-1"} text-sm text-muted`}>
          {items.map((item) => (
            <li key={item.label}>
              <span className="font-semibold text-primary">{item.value}</span> {item.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
