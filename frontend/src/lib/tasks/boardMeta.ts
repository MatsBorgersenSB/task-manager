import type { Task } from "@/lib/tasks/types";

export type BoardLabelColor =
  | "rose"
  | "amber"
  | "sky"
  | "violet"
  | "emerald"
  | "slate";

export type ProjectBucket = {
  id: string;
  project_id: string;
  name: string;
  position: number;
};

export type ProjectBoardLabel = {
  id: string;
  project_id: string;
  name: string;
  color: BoardLabelColor;
  position: number;
};

export const BOARD_LABEL_COLORS: {
  id: BoardLabelColor;
  label: string;
  chipClass: string;
  barClass: string;
}[] = [
  { id: "rose", label: "Rose", chipClass: "bg-rose-100 text-rose-800", barClass: "bg-rose-500" },
  { id: "amber", label: "Amber", chipClass: "bg-amber-100 text-amber-900", barClass: "bg-amber-500" },
  { id: "sky", label: "Sky", chipClass: "bg-sky-100 text-sky-800", barClass: "bg-sky-500" },
  { id: "violet", label: "Violet", chipClass: "bg-violet-100 text-violet-800", barClass: "bg-violet-500" },
  { id: "emerald", label: "Emerald", chipClass: "bg-emerald-100 text-emerald-800", barClass: "bg-emerald-500" },
  { id: "slate", label: "Slate", chipClass: "bg-slate-200 text-slate-800", barClass: "bg-slate-500" },
];

export function boardLabelChipClass(color: string | null | undefined): string {
  const match = BOARD_LABEL_COLORS.find((item) => item.id === color);
  return match?.chipClass ?? "bg-slate-100 text-slate-700";
}

export function boardLabelBarClass(color: string | null | undefined): string {
  const match = BOARD_LABEL_COLORS.find((item) => item.id === color);
  return match?.barClass ?? "bg-slate-400";
}

export function normalizeBoardLabelColor(value: string | null | undefined): BoardLabelColor {
  const match = BOARD_LABEL_COLORS.find((item) => item.id === value);
  return match?.id ?? "slate";
}

export function taskLabelIds(task: Task): string[] {
  return Array.isArray(task.board_label_ids) ? task.board_label_ids : [];
}

export function collectBoardMembers(tasks: Task[]): string[] {
  const names = new Set<string>();
  for (const task of tasks) {
    const responsible = (task.Responsible ?? "").trim();
    if (responsible) names.add(responsible);
    const owners = (task["SB Owner"] ?? "")
      .split(/[,;]/)
      .map((part) => part.trim())
      .filter(Boolean);
    for (const owner of owners) names.add(owner);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function taskMatchesMemberFilter(
  task: Task,
  selectedMembers: string[]
): boolean {
  if (selectedMembers.length === 0) return true;
  const selected = new Set(selectedMembers.map((name) => name.toLowerCase()));
  const responsible = (task.Responsible ?? "").trim().toLowerCase();
  if (responsible && selected.has(responsible)) return true;
  const owners = (task["SB Owner"] ?? "")
    .split(/[,;]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  return owners.some((owner) => selected.has(owner));
}
