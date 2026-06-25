import { createClient } from "@/lib/supabase/client";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import type { Area } from "@/lib/tasks/areas";
import {
  generateAreaCode,
  isNoAreaValue,
  isSignificantNameChange,
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

async function getAreaById(areaId: string): Promise<Area | null> {
  const trimmed = areaId.trim();
  if (!trimmed) return null;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("areas")
    .select("id, name, code")
    .eq("id", trimmed)
    .maybeSingle();

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return data ? rowToArea(data as AreaRow) : null;
}

/** Rename an existing area; may regenerate code on significant name changes. */
export type AreaUpdateResult = {
  area: Area;
  updatedName: string;
  updatedCode: string;
  codeChanged: boolean;
  previousCode: string;
};

export const AREA_UPDATE_USER_MESSAGE =
  "Could not update area — code may already exist";

export class AreaUpdateError extends Error {
  constructor(message: string = AREA_UPDATE_USER_MESSAGE) {
    super(message);
    this.name = "AreaUpdateError";
  }
}

async function assertCodeAvailableForArea(
  code: string,
  areaId: string
): Promise<void> {
  const existing = await findAreaByCodeInDb(code);
  if (existing && existing.id !== areaId) {
    throw new AreaUpdateError();
  }
}

export async function updateAreaName(
  areaId: string,
  newName: string
): Promise<AreaUpdateResult> {
  const trimmed = newName.trim();
  if (!trimmed) {
    throw new Error("Area name is required.");
  }

  const area = await getAreaById(areaId);
  if (!area) {
    throw new Error("Area not found");
  }

  const previousCode = area.code.trim();
  const previousName = area.name.trim();

  const existingByName = await findAreaByNameInDb(trimmed);
  if (existingByName && existingByName.id !== areaId) {
    throw new Error(
      `Area name "${trimmed}" is already used by ${existingByName.name} (${existingByName.code})`
    );
  }

  let newCode = previousCode;

  if (isSignificantNameChange(previousName, trimmed)) {
    const allCodes = await fetchAllAreaCodes();
    const otherCodes = allCodes.filter(
      (code) => code.trim().toLowerCase() !== previousCode.toLowerCase()
    );
    const candidateCode = generateAreaCode(trimmed, otherCodes);

    if (!candidateCode) {
      throw new AreaUpdateError();
    }

    await assertCodeAvailableForArea(candidateCode, areaId);
    newCode = candidateCode;
  }

  if (
    trimmed === previousName &&
    newCode.toLowerCase() === previousCode.toLowerCase()
  ) {
    return {
      area,
      updatedName: trimmed,
      updatedCode: previousCode,
      codeChanged: false,
      previousCode,
    };
  }

  if (newCode.toLowerCase() !== previousCode.toLowerCase()) {
    await assertCodeAvailableForArea(newCode, areaId);
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("areas")
    .update({
      name: trimmed,
      code: newCode,
    })
    .eq("id", areaId)
    .select("id, name, code")
    .maybeSingle();

  if (error) {
    console.error("Area update failed:", error);
    if (error.code === "23505") {
      throw new AreaUpdateError();
    }
    throw new Error(supabaseErrorMessage(error));
  }

  if (!data) {
    console.error("Area update failed: no row returned for id", areaId);
    throw new Error("Area not found");
  }

  const updated = rowToArea(data as AreaRow);
  const updatedCode = updated.code.trim();

  return {
    area: updated,
    updatedName: trimmed,
    updatedCode,
    codeChanged: updatedCode.toLowerCase() !== previousCode.toLowerCase(),
    previousCode,
  };
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

export type AreaUpdateInfo = {
  updatedName: string;
  updatedCode: string;
  codeChanged: boolean;
  previousCode: string;
};

export type ResolvedArea = {
  areaName: string;
  areaCode: string;
  newArea?: Area;
  updatedArea?: Area;
  areaUpdate?: AreaUpdateInfo;
};

export function formatAreaCodeChangeMessage(info: AreaUpdateInfo): string {
  if (!info.codeChanged) return "";
  return `Area updated (${info.previousCode} → ${info.updatedCode})`;
}

export type ResolveAreaOptions = {
  areaId?: string;
  editName?: string;
  isCustom?: boolean;
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
  areas: Area[],
  options: ResolveAreaOptions = {}
): Promise<ResolvedArea> {
  const trimmed = areaInput.trim();
  const { areaId, editName, isCustom } = options;

  if (isNoAreaValue(trimmed) && !areaId) {
    return { areaName: "", areaCode: "" };
  }

  if (areaId && !isCustom) {
    const local = areas.find((area) => area.id === areaId);
    const area = local ?? (await getAreaById(areaId));
    if (!area) {
      throw new Error("Area not found");
    }

    const nameToUse = (editName ?? area.name).trim();
    if (!nameToUse) {
      throw new Error("Area name is required.");
    }

    if (nameToUse !== area.name.trim()) {
      const updateResult = await updateAreaName(areaId, nameToUse);
      return {
        areaName: updateResult.area.name,
        areaCode: updateResult.area.code,
        updatedArea: updateResult.area,
        areaUpdate: {
          updatedName: updateResult.updatedName,
          updatedCode: updateResult.updatedCode,
          codeChanged: updateResult.codeChanged,
          previousCode: updateResult.previousCode,
        },
      };
    }

    return { areaName: area.name, areaCode: area.code };
  }

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
