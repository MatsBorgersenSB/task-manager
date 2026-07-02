"use client";

import { ui } from "@/lib/ui/classes";

export type TaskViewTab = "table" | "calendar" | "gantt" | "blueprint";

type ViewModeTabsProps = {
  value: TaskViewTab;
  onChange: (view: TaskViewTab) => void;
  showBlueprint?: boolean;
};

const TABS: { id: TaskViewTab; label: string }[] = [
  { id: "table", label: "Table" },
  { id: "calendar", label: "Calendar" },
  { id: "gantt", label: "Gantt" },
];

export default function ViewModeTabs({
  value,
  onChange,
  showBlueprint = false,
}: ViewModeTabsProps) {
  const tabs = showBlueprint
    ? [...TABS, { id: "blueprint" as const, label: "Blueprint" }]
    : TABS;

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
          className={value === tab.id ? ui.segmentBtnActive : ui.segmentBtn}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
