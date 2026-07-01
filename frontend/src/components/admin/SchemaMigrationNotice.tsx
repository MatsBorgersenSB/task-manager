"use client";

import { migrationHint } from "@/lib/supabase/schemaCapabilities";
import type { SchemaCapabilities } from "@/lib/supabase/schemaCapabilities";
import { ui } from "@/lib/ui/classes";

type SchemaMigrationNoticeProps = {
  capabilities: SchemaCapabilities | null;
  feature: keyof SchemaCapabilities;
  label: string;
};

export default function SchemaMigrationNotice({
  capabilities,
  feature,
  label,
}: SchemaMigrationNoticeProps) {
  if (!capabilities || capabilities[feature]) {
    return null;
  }

  return (
    <div className={`mb-4 p-4 text-sm text-amber-900 ${ui.alertError} border-amber-200 bg-amber-50`}>
      <p className="font-semibold">{label} is not available on this database yet.</p>
      <p className="mt-1">{migrationHint(feature)}</p>
    </div>
  );
}
