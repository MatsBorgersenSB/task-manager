"use client";

import { useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import TemplateLibrary from "@/components/templates/TemplateLibrary";
import TemplateEditor from "@/components/templates/TemplateEditor";
import { ui } from "@/lib/ui/classes";

export default function TemplatesClient() {
  const [editId, setEditId] = useState<string | null>(null);

  return (
    <AppShell
      pageTitle="Template Library"
      pageDescription="Standard Bio execution playbooks"
      fullWidth
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/dashboard" className={ui.btnSecondarySm}>
          Dashboard
        </Link>
        <Link href="/internal" className={ui.btnSecondarySm}>
          Task workspace
        </Link>
      </div>

      {editId ? (
        <TemplateEditor templateId={editId} onBack={() => setEditId(null)} />
      ) : (
        <TemplateLibrary onEditTemplate={setEditId} />
      )}
    </AppShell>
  );
}
