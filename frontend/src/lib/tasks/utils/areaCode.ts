/** Dropdown value for tasks with no area assigned. */
export const AREA_NONE_VALUE = "-";

export function isNoAreaValue(value: string | null | undefined): boolean {
  const trimmed = (value ?? "").trim();
  return trimmed === "" || trimmed === AREA_NONE_VALUE;
}

/** True when the display name meaningfully changes (ignores case-only edits). */
export function isSignificantNameChange(
  oldName: string,
  newName: string
): boolean {
  return oldName.trim().toLowerCase() !== newName.trim().toLowerCase();
}

/** Generate a unique 3-character area code from a display name. */
export function generateAreaCode(name: string, existingCodes: string[]): string {
  if (!name) return "";

  const clean = name.replace(/[^a-zA-Z0-9 ]/g, "").toUpperCase().trim();
  if (!clean) return "";

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  let base = "";

  if (words.length >= 3) {
    base = words
      .slice(0, 3)
      .map((w) => w[0] ?? "")
      .join("");
  } else if (words.length === 2) {
    base =
      words[0][0] +
      words[1][0] +
      (words[1][1] ?? words[1][0] ?? "X");
  } else {
    base = words[0].slice(0, 3).toUpperCase();
  }

  base = base.toUpperCase().slice(0, 3);

  const taken = new Set(
    existingCodes
      .map((code) => code.trim().toUpperCase())
      .filter((code) => code.length > 0)
  );

  let code = base;
  let i = 1;

  while (taken.has(code)) {
    code = `${base.slice(0, 2)}${i}`.slice(0, 3);
    i += 1;
    if (i > 99) {
      code = `${base[0] ?? "X"}${String(i).slice(-2)}`.slice(0, 3);
    }
  }

  return code;
}
