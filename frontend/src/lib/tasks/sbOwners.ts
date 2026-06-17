export function parseSbOwners(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function formatSbOwners(selected: string[]): string | null {
  return selected.length ? selected.join(", ") : null;
}
