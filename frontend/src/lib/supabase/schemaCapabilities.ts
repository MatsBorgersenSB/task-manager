import { createClient } from "@/lib/supabase/client";
import {
  isMissingColumnError,
  isMissingTableError,
  type SelectQueryResult,
} from "@/lib/supabase/schemaFallback";

export type SchemaCapabilities = {
  projectLifecycle: boolean;
  projectUsers: boolean;
  taskHierarchy: boolean;
  templatePlatform: boolean;
  accessCenter: boolean;
};

let cached: SchemaCapabilities | null = null;
let probePromise: Promise<SchemaCapabilities> | null = null;

async function probeColumn(table: string, column: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = (await supabase
    .from(table)
    .select(column)
    .limit(0)) as SelectQueryResult;
  return !error;
}

async function probeTable(table: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = (await supabase.from(table).select("*").limit(0)) as SelectQueryResult;
  return !error;
}

export async function getSchemaCapabilities(): Promise<SchemaCapabilities> {
  if (cached) return cached;
  if (probePromise) return probePromise;

  probePromise = (async () => {
    const [
      projectLifecycle,
      projectUsers,
      taskHierarchy,
      templateSlug,
      accessSessions,
    ] = await Promise.all([
      probeColumn("projects", "deleted_at"),
      probeTable("project_users"),
      probeColumn("tasks", "parent_task_id"),
      probeColumn("project_templates", "slug"),
      probeTable("user_login_sessions"),
    ]);

    cached = {
      projectLifecycle,
      projectUsers,
      taskHierarchy,
      templatePlatform: templateSlug,
      accessCenter: accessSessions,
    };
    return cached;
  })();

  return probePromise;
}

export function clearSchemaCapabilitiesCache(): void {
  cached = null;
  probePromise = null;
}

export function migrationHint(feature: keyof SchemaCapabilities): string {
  switch (feature) {
    case "projectLifecycle":
      return "Apply migration 051_project_lifecycle.sql in Supabase.";
    case "projectUsers":
      return "Apply migration 037_project_sharing.sql in Supabase.";
    case "taskHierarchy":
      return "Apply migrations 036_parent_task_id.sql and 046_task_hierarchy_protection.sql.";
    case "templatePlatform":
      return "Apply migrations 048_project_execution_platform.sql and 049_seed_standard_bio_templates.sql.";
    case "accessCenter":
      return "Apply migration 050_user_access_intelligence.sql in Supabase.";
    default:
      return "Apply pending Supabase migrations.";
  }
}

export function isMissingSchemaError(
  error: { message?: string; code?: string } | null
): boolean {
  if (!error?.message) return false;
  const message = error.message.toLowerCase();
  return (
    isMissingColumnError(error) ||
    isMissingTableError(error, "project_users") ||
    isMissingTableError(error, "user_login_sessions") ||
    message.includes("could not find the function") ||
    message.includes("pgrst202")
  );
}
