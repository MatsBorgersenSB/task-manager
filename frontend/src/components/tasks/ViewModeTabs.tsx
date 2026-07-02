"use client";

import { ui } from "@/lib/ui/classes";

export type TaskViewTab = "table" | "calendar" | "gantt" | "blueprint";

type ViewModeTabsProps = {
  value: TaskViewTab;
  onChange: (view: TaskViewTab) => void;
  showBlueprint?: boolean;
};

const TABS: { id: TaskViewTab; label: string; icon: string }[] = [
  { id: "table", label: "Table", icon: "☷" },
  { id: "calendar", label: "Calendar", icon: "📅" },
  { id: "gantt", label: "Gantt", icon: "📊" },
];

const BLUEPRINT_TAB = {
  id: "blueprint" as const,
  label: "Blueprint",
  icon: "🗂",
};

export default function ViewModeTabs({
  value,
  onChange,
  showBlueprint = false,
}: ViewModeTabsProps) {
  const tabs = showBlueprint ? [...TABS, BLUEPRINT_TAB] : TABS;

  return (
    <div
      className={ui.segmentGroup}
      role="tablist"
      aria-label="Task view"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={`inline-flex items-center gap-1.5 ${
            value === tab.id ? ui.segmentBtnActive : ui.segmentBtn
          }`}
        >
          <span aria-hidden className="text-[0.8125rem] leading-none">
            {tab.icon}
          </span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
