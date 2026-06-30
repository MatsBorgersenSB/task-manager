import type { TemplateCategory } from "@/lib/templates/types";

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  "Commissioning",
  "Installation",
  "FAT",
  "Service",
  "Biochar",
  "Internal",
  "Custom",
];

export const TEMPLATE_CATEGORY_ICONS: Record<TemplateCategory, string> = {
  Commissioning: "⚙️",
  Installation: "🏗️",
  FAT: "✅",
  Service: "🔧",
  Biochar: "🌱",
  Internal: "📋",
  Custom: "✨",
};

export const WIZARD_STEPS = [
  { id: "name", label: "Project name" },
  { id: "client", label: "Client" },
  { id: "template", label: "Template" },
  { id: "start", label: "Start date" },
  { id: "owner", label: "Project owner" },
  { id: "review", label: "Review" },
  { id: "create", label: "Create" },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];
