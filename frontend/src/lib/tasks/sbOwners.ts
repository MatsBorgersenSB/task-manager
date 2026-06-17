import type { Task } from "@/lib/tasks/types";

export function parseSbOwners(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function formatSbOwners(selected: string[]): string | null {
  return selected.length ? selected.join(", ") : null;
}

/** Filter tasks where any SB owner matches one of the selected owners. */
export function filterTasksByOwners(
  tasks: Task[],
  selectedOwners: string[]
): Task[] {
  if (!selectedOwners.length) return tasks;

  const target = new Set(selectedOwners.map((owner) => owner.toLowerCase()));

  return tasks.filter((task) => {
    const owners = parseSbOwners(task["SB Owner"]).map((owner) =>
      owner.toLowerCase()
    );
    return owners.some((owner) => target.has(owner));
  });
}

/** Unique SB owner names from tasks (case-insensitive dedupe, sorted A–Z). */
export function extractSbOwners(tasks: Task[]): string[] {
  const byKey = new Map<string, string>();

  for (const task of tasks) {
    for (const owner of parseSbOwners(task["SB Owner"])) {
      const key = owner.toLowerCase();
      if (!byKey.has(key)) {
        byKey.set(key, owner);
      }
    }
  }

  return [...byKey.values()].sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" })
  );
}
