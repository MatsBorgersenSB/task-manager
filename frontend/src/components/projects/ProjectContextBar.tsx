"use client";

import type { Project } from "@/lib/projects/types";

type ProjectContextBarProps = {
  project: Project;
};

export default function ProjectContextBar({ project }: ProjectContextBarProps) {
  return (
    <div className="no-print rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-sm text-primary">
      You are working in:{" "}
      <strong className="font-semibold text-primary">{project.name}</strong>
      {project.is_shared ? (
        <span className="ml-2 font-medium text-green-600">
          Shared with client
        </span>
      ) : null}
    </div>
  );
}
