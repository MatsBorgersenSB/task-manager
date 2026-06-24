import { createClient } from "@/lib/supabase/client";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import type { Area } from "@/lib/tasks/areas";

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
    throw new Error(supabaseErrorMessage(error));
  }

  return sortAreas((data ?? []).map(rowToArea));
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

/** Insert area if missing; return existing row when code or name+code already exists. */
export async function findOrCreateArea(
  name: string,
  code: string
): Promise<Area> {
  const trimmedName = name.trim();
  const trimmedCode = code.trim();
  const finalName = trimmedName || trimmedCode;
  const finalCode = trimmedCode || trimmedName;

  if (!finalName || !finalCode) {
    throw new Error("Area name is required.");
  }

  const byCode = await findAreaByCodeInDb(finalCode);
  if (byCode) return byCode;

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

    if (duplicate) return duplicate;
    throw new Error(supabaseErrorMessage(error));
  }

  return rowToArea(data as AreaRow);
}

export type ResolvedArea = {
  areaName: string;
  areaCode: string;
  newArea?: Area;
};

export async function resolveAreaForTask(
  areaName: string,
  areaCode: string,
  areas: Area[]
): Promise<ResolvedArea> {
  const name = areaName.trim();
  const code = areaCode.trim();

  if (!name && !code) {
    return { areaName: "", areaCode: "" };
  }

  const known = areas.find(
    (area) =>
      area.name.trim().toLowerCase() === name.toLowerCase() &&
      area.code.trim().toLowerCase() === code.toLowerCase()
  );
  if (known) {
    return { areaName: known.name, areaCode: known.code };
  }

  if (code) {
    const byCode = areas.find(
      (area) => area.code.trim().toLowerCase() === code.toLowerCase()
    );
    if (byCode) {
      return { areaName: byCode.name, areaCode: byCode.code };
    }
  }

  const created = await findOrCreateArea(name, code);
  const alreadyListed = areas.some((area) => area.id === created.id);
  return {
    areaName: created.name,
    areaCode: created.code,
    newArea: alreadyListed ? undefined : created,
  };
}
