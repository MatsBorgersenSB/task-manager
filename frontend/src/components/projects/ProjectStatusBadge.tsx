import type { ProjectStatus } from "@/lib/projects/lifecycle";
import {
  projectStatusBadgeClass,
  projectStatusIcon,
  projectStatusLabel,
} from "@/lib/projects/lifecycleDisplay";

type ProjectStatusBadgeProps = {
  status?: ProjectStatus | null;
  className?: string;
};

export default function ProjectStatusBadge({
  status = "active",
  className = "",
}: ProjectStatusBadgeProps) {
  const resolved = status ?? "active";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${projectStatusBadgeClass(resolved)} ${className}`}
    >
      <span aria-hidden>{projectStatusIcon(resolved)}</span>
      {projectStatusLabel(resolved)}
    </span>
  );
}
