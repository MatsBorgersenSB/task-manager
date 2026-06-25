/** Dropdown value for tasks with no area assigned. */
export const AREA_NONE_VALUE = "-";

export function isNoAreaValue(value: string | null | undefined): boolean {
  const trimmed = (value ?? "").trim();
  return trimmed === "" || trimmed === AREA_NONE_VALUE;
}

/** Generate a unique 3-character area code from a display name. */
export function generateAreaCode(name: string, existingCodes: string[]): string {
  if (!name) return "";

  const clean = name.replace(/[^a-zA-Z0-9 ]/g, "").toUpperCase().trim();
  if (!clean) return "";

  const words = clean.split(" ").filter(Boolean);

  let base = "";

  if (words.length >= 3) {
    base = words
      .slice(0, 3)
      .map((w) => w[0] ?? "")
      .join("");
  } else if (words.length === 2) {
    const [first, second] = words;
    base =
      (first[0] ?? "X") +
      (first[1] ?? first[0] ?? "X") +
      (second[0] ?? "X");
  } else {
    base = clean.slice(0, 3).padEnd(3, "X");
  }

  base = base.slice(0, 3);

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
