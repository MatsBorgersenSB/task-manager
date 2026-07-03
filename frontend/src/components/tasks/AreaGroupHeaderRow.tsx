"use client";

type AreaGroupHeaderRowProps = {
  label: string;
  count: number;
  collapsed: boolean;
  colSpan: number;
  onToggle: () => void;
};

export default function AreaGroupHeaderRow({
  label,
  count,
  collapsed,
  colSpan,
  onToggle,
}: AreaGroupHeaderRowProps) {
  return (
    <tr className="border-b border-border/70 bg-slate-100/95">
      <td colSpan={colSpan} className="!py-1 px-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-2 text-left text-xs font-semibold text-primary hover:text-accent"
          aria-expanded={!collapsed}
        >
          <span aria-hidden className="w-3 shrink-0 text-[10px] text-muted">
            {collapsed ? "▶" : "▼"}
          </span>
          <span>{label}</span>
          <span className="font-medium text-muted">({count})</span>
        </button>
      </td>
    </tr>
  );
}
