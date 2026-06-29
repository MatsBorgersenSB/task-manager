/** Shared helpers when optional Supabase columns/tables are not migrated yet. */

export type SupabaseErrorLike = { message?: string; code?: string } | null;

export type SelectQueryResult = {
  data: unknown;
  error: SupabaseErrorLike;
};

/** Parse PostgREST/Postgres missing-column errors. */
export function extractMissingColumnName(error: SupabaseErrorLike): string | null {
  if (!error?.message) return null;
  const message = error.message;

  const qualified = message.match(/column\s+(?:\w+\.)?(\w+)\s+does not exist/i);
  if (qualified?.[1]) return qualified[1];

  const schemaCache = message.match(/could not find the '(\w+)' column/i);
  if (schemaCache?.[1]) return schemaCache[1];

  return null;
}

export function isMissingColumnError(
  error: SupabaseErrorLike,
  column?: string
): boolean {
  if (!error?.message) return false;

  const message = error.message.toLowerCase();
  const missing = extractMissingColumnName(error);

  if (column) {
    return (
      missing === column ||
      (message.includes(column) &&
        (message.includes("does not exist") || message.includes("could not find")))
    );
  }

  return (
    Boolean(missing) &&
    (message.includes("does not exist") ||
      message.includes("could not find") ||
      message.includes("schema cache"))
  );
}

export function isMissingTableError(
  error: SupabaseErrorLike,
  table: string
): boolean {
  if (!error?.message) return false;
  const message = error.message.toLowerCase();
  const tableName = table.toLowerCase();

  return (
    error.code === "PGRST205" ||
    (message.includes(tableName) &&
      (message.includes("schema cache") ||
        message.includes("does not exist") ||
        message.includes("could not find the table")))
  );
}

export function stripRecordKeys<T extends Record<string, unknown>>(
  row: T,
  keys: readonly string[]
): T {
  const next = { ...row };
  for (const key of keys) {
    delete next[key];
  }
  return next;
}

/** Try select strings in order until one succeeds or a non-column error occurs. */
export async function selectWithColumnFallback(
  columnSets: readonly string[],
  run: (columns: string) => PromiseLike<SelectQueryResult>
): Promise<{ data: unknown; columnsUsed: string }> {
  let lastError: SupabaseErrorLike = null;

  for (let index = 0; index < columnSets.length; index++) {
    const columns = columnSets[index];
    const result = await run(columns);
    if (!result.error) {
      return { data: result.data, columnsUsed: columns };
    }

    lastError = result.error;
    const hasFallback = index < columnSets.length - 1;
    if (hasFallback && isMissingColumnError(result.error)) {
      continue;
    }
    break;
  }

  throw new Error(lastError?.message ?? "Request failed");
}

/** Retry writes after stripping missing optional columns (best-effort). */
export async function writeWithOptionalColumnFallback<
  T,
  R extends Record<string, unknown>,
>(
  write: (row: R) => PromiseLike<{ data: T | null; error: SupabaseErrorLike }>,
  row: R,
  optionalKeys: readonly string[]
): Promise<{ data: T; strippedKeys: string[] }> {
  let current: R = { ...row };
  const strippedKeys: string[] = [];
  const maxAttempts = optionalKeys.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await write(current);
    if (!result.error && result.data) {
      return { data: result.data, strippedKeys };
    }

    const missing = extractMissingColumnName(result.error);
    if (!missing || !optionalKeys.includes(missing) || !(missing in current)) {
      throw new Error(result.error?.message ?? "Request failed");
    }

    current = stripRecordKeys(current, [missing]);
    strippedKeys.push(missing);

    if (strippedKeys.length === 1) {
      console.warn(
        `Optional column "${missing}" missing in database; retrying without it.`
      );
    }
  }

  throw new Error("Request failed after removing optional columns.");
}
