import { createClient } from "@/lib/supabase/client";
import { supabaseErrorMessage } from "@/lib/tasks/db-mapper";
import type { EquipmentType } from "@/lib/tasks/equipmentTypes";

type EquipmentTypeRow = {
  id: string;
  name: string;
  code: string;
};

function rowToEquipmentType(row: EquipmentTypeRow): EquipmentType {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
  };
}

function sortEquipmentTypes(items: EquipmentType[]): EquipmentType[] {
  return [...items].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

export async function fetchEquipmentTypes(): Promise<EquipmentType[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("equipment_types")
    .select("id, name, code")
    .order("name", { ascending: true });

  if (error) {
    console.error("fetchEquipmentTypes error:", error);
    throw new Error(supabaseErrorMessage(error));
  }

  const rows = (data ?? []) as EquipmentTypeRow[];
  return sortEquipmentTypes(rows.map(rowToEquipmentType));
}

async function findEquipmentTypeByCodeInDb(
  code: string
): Promise<EquipmentType | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("equipment_types")
    .select("id, name, code")
    .ilike("code", trimmed)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(supabaseErrorMessage(error));
  }

  return data ? rowToEquipmentType(data as EquipmentTypeRow) : null;
}

async function findEquipmentTypeByNameAndCodeInDb(
  name: string,
  code: string
): Promise<EquipmentType | null> {
  const trimmedName = name.trim();
  const trimmedCode = code.trim();
  if (!trimmedName && !trimmedCode) return null;

  const supabase = createClient();
  let query = supabase
    .from("equipment_types")
    .select("id, name, code")
    .limit(1);

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

  return data ? rowToEquipmentType(data as EquipmentTypeRow) : null;
}

/** Insert equipment type if missing; return existing row when code or name+code already exists. */
export async function findOrCreateEquipmentType(
  name: string,
  code: string
): Promise<EquipmentType> {
  const trimmedName = name.trim();
  const trimmedCode = code.trim();
  const finalName = trimmedName || trimmedCode;
  const finalCode = trimmedCode || trimmedName;

  if (!finalName || !finalCode) {
    throw new Error("Equipment type name is required.");
  }

  const byCode = await findEquipmentTypeByCodeInDb(finalCode);
  if (byCode) return byCode;

  const byNameAndCode = await findEquipmentTypeByNameAndCodeInDb(
    finalName,
    finalCode
  );
  if (byNameAndCode) return byNameAndCode;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("equipment_types")
    .insert({ name: finalName, code: finalCode })
    .select("id, name, code")
    .single();

  if (error) {
    const duplicate =
      error.code === "23505"
        ? (await findEquipmentTypeByCodeInDb(finalCode)) ??
          (await findEquipmentTypeByNameAndCodeInDb(finalName, finalCode))
        : null;

    if (duplicate) return duplicate;
    throw new Error(supabaseErrorMessage(error));
  }

  return rowToEquipmentType(data as EquipmentTypeRow);
}

export type ResolvedEquipmentType = {
  equipmentTypeName: string;
  equipmentTypeCode: string;
  newEquipmentType?: EquipmentType;
};

function findEquipmentTypeInList(
  equipmentTypeInput: string,
  equipmentTypes: EquipmentType[]
): EquipmentType | undefined {
  const trimmed = equipmentTypeInput.trim();
  if (!trimmed) return undefined;

  return equipmentTypes.find(
    (item) => item.code.trim().toLowerCase() === trimmed.toLowerCase()
  );
}

/** Resolve dropdown/custom input to task equipment_type_name + equipment_type_code. */
export async function resolveEquipmentTypeForTask(
  equipmentTypeInput: string,
  equipmentTypes: EquipmentType[]
): Promise<ResolvedEquipmentType> {
  const trimmed = equipmentTypeInput.trim();
  if (!trimmed) {
    return { equipmentTypeName: "", equipmentTypeCode: "" };
  }

  const known = findEquipmentTypeInList(trimmed, equipmentTypes);
  if (known) {
    return {
      equipmentTypeName: known.name,
      equipmentTypeCode: known.code,
    };
  }

  const fromDb = await findEquipmentTypeByCodeInDb(trimmed);
  if (fromDb) {
    const alreadyListed = equipmentTypes.some((item) => item.id === fromDb.id);
    return {
      equipmentTypeName: fromDb.name,
      equipmentTypeCode: fromDb.code,
      newEquipmentType: alreadyListed ? undefined : fromDb,
    };
  }

  const created = await findOrCreateEquipmentType(trimmed, "");
  const alreadyListed = equipmentTypes.some((item) => item.id === created.id);
  return {
    equipmentTypeName: created.name,
    equipmentTypeCode: created.code,
    newEquipmentType: alreadyListed ? undefined : created,
  };
}
