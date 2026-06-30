"use client";

import Link from "next/link";
import AppShell from "@/components/AppShell";
import TemplateEditor from "@/components/templates/TemplateEditor";
import { ui } from "@/lib/ui/classes";

type TemplateEditorClientProps = {
  templateId: string;
};

export default function TemplateEditorClient({ templateId }: TemplateEditorClientProps) {
  return (
    <AppShell
      pageTitle="Template Editor"
      pageDescription="Standard Bio knowledge capture"
      fullWidth
    >
      <Link href="/internal/templates" className={`${ui.btnSecondarySm} mb-4 inline-block`}>
        ← Template library
      </Link>
      <TemplateEditor
        templateId={templateId}
        onBack={() => {
          window.location.href = "/internal/templates";
        }}
      />
    </AppShell>
  );
}
