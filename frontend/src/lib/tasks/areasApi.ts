import { createClient } from "@/lib/supabase/client";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import type { Area } from "@/lib/tasks/areas";
import {
  generateAreaCode,
  isNoAreaValue,
} from "@/lib/tasks/utils/areaCode";

type AreaRow = {
  id: string;
  name: string;
  code: string;
};

function rowToArea(row: AreaRow): Area {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
  };
}

function sortAreas(areas: Area[]): Area[] {
  return [...areas].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

export async function fetchAreas(): Promise<Area[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("areas")
    .select("id, name, code")
    .order("name", { ascending: true });

  if (error) {
    console.error("fetchAreas error:", error);
    throw new Error(supabaseErrorMessage(error));
  }

  const rows = (data ?? []) as AreaRow[];
  console.log("fetchAreas returned", rows.length, "rows");
  return sortAreas(rows.map(rowToArea));
}

async function fetchAllAreaCodes(): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("areas").select("code");

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return (data ?? []).map((row: { code: string }) => row.code);
}

async function findAreaByCodeInDb(code: string): Promise<Area | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("areas")
    .select("id, name, code")
    .ilike("code", trimmed)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return data ? rowToArea(data as AreaRow) : null;
}

async function findAreaByNameInDb(name: string): Promise<Area | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("areas")
    .select("id, name, code")
    .ilike("name", trimmed)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return data ? rowToArea(data as AreaRow) : null;
}

async function findAreaByNameAndCodeInDb(
  name: string,
  code: string
): Promise<Area | null> {
  const trimmedName = name.trim();
  const trimmedCode = code.trim();
  if (!trimmedName && !trimmedCode) return null;

  const supabase = createClient();
  let query = supabase.from("areas").select("id, name, code").limit(1);

  if (trimmedCode) {
    query = query.ilike("code", trimmedCode);
  }
  if (trimmedName) {
    query = query.ilike("name", trimmedName);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return data ? rowToArea(data as AreaRow) : null;
}

function assertCodeMatchesNameOrThrow(
  existing: Area,
  name: string,
  code: string
): Area {
  if (
    existing.name.trim().toLowerCase() !== name.trim().toLowerCase()
  ) {
    throw new Error(`Area code ${code} already belongs to ${existing.name}`);
  }
  return existing;
}

/** Insert area if missing; return existing row when code or name+code already exists. */
export async function findOrCreateArea(
  name: string,
  code: string
): Promise<Area> {
  const trimmedName = name.trim();
  const trimmedCode = code.trim();
  const finalName = trimmedName || trimmedCode;

  if (!finalName) {
    throw new Error("Area name is required.");
  }

  if (trimmedCode) {
    const byCode = await findAreaByCodeInDb(trimmedCode);
    if (byCode) {
      return assertCodeMatchesNameOrThrow(byCode, finalName, trimmedCode);
    }
  }

  const byName = await findAreaByNameInDb(finalName);
  if (byName) return byName;

  let finalCode = trimmedCode;
  if (!finalCode) {
    const existingCodes = await fetchAllAreaCodes();
    finalCode = generateAreaCode(finalName, existingCodes);
  }

  if (!finalCode) {
    throw new Error("Could not generate area code.");
  }

  const existingWithSameCode = await findAreaByCodeInDb(finalCode);
  if (existingWithSameCode) {
    return assertCodeMatchesNameOrThrow(
      existingWithSameCode,
      finalName,
      finalCode
    );
  }

  const byNameAndCode = await findAreaByNameAndCodeInDb(finalName, finalCode);
  if (byNameAndCode) return byNameAndCode;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("areas")
    .insert({ name: finalName, code: finalCode })
    .select("id, name, code")
    .single();

  if (error) {
    const duplicate =
      error.code === "23505"
        ? (await findAreaByCodeInDb(finalCode)) ??
          (await findAreaByNameAndCodeInDb(finalName, finalCode))
        : null;

    if (duplicate) {
      return assertCodeMatchesNameOrThrow(duplicate, finalName, finalCode);
    }
    throw new Error(supabaseErrorMessage(error));
  }

  return rowToArea(data as AreaRow);
}

export type ResolvedArea = {
  areaName: string;
  areaCode: string;
  newArea?: Area;
};

function findAreaInList(areaInput: string, areas: Area[]): Area | undefined {
  const trimmed = areaInput.trim();
  if (!trimmed) return undefined;

  return areas.find(
    (area) => area.code.trim().toLowerCase() === trimmed.toLowerCase()
  );
}

function findAreaInListByName(name: string, areas: Area[]): Area | undefined {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return undefined;

  return areas.find(
    (area) => area.name.trim().toLowerCase() === trimmed
  );
}

/** Resolve dropdown/custom input to task area_name + area_code. */
export async function resolveAreaForTask(
  areaInput: string,
  areas: Area[]
): Promise<ResolvedArea> {
  const trimmed = areaInput.trim();
  if (isNoAreaValue(trimmed)) {
    return { areaName: "", areaCode: "" };
  }

  const known = findAreaInList(trimmed, areas);
  if (known) {
    return { areaName: known.name, areaCode: known.code };
  }

  const knownByName = findAreaInListByName(trimmed, areas);
  if (knownByName) {
    return { areaName: knownByName.name, areaCode: knownByName.code };
  }

  const fromDb = await findAreaByCodeInDb(trimmed);
  if (fromDb) {
    const alreadyListed = areas.some((area) => area.id === fromDb.id);
    return {
      areaName: fromDb.name,
      areaCode: fromDb.code,
      newArea: alreadyListed ? undefined : fromDb,
    };
  }

  const fromDbByName = await findAreaByNameInDb(trimmed);
  if (fromDbByName) {
    const alreadyListed = areas.some((area) => area.id === fromDbByName.id);
    return {
      areaName: fromDbByName.name,
      areaCode: fromDbByName.code,
      newArea: alreadyListed ? undefined : fromDbByName,
    };
  }

  const created = await findOrCreateArea(trimmed, "");
  const alreadyListed = areas.some((area) => area.id === created.id);
  return {
    areaName: created.name,
    areaCode: created.code,
    newArea: alreadyListed ? undefined : created,
  };
}
