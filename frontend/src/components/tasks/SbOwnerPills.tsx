"use client";

import type { MouseEvent } from "react";
import { ui } from "@/lib/ui/classes";

type SbOwnerPillsProps = {
  owners: string[];
  selectedOwners: string[];
  onToggle: (owner: string) => void;
  onHoverOwner?: (owner: string, event: MouseEvent) => void;
  onHoverEnd?: () => void;
};

export default function SbOwnerPills({
  owners,
  selectedOwners,
  onToggle,
  onHoverOwner,
  onHoverEnd,
}: SbOwnerPillsProps) {
  if (owners.length === 0) {
    return <span className="text-muted">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {owners.map((owner) => {
        const active = selectedOwners.includes(owner);
        return (
          <button
            key={owner}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggle(owner);
            }}
            onMouseEnter={(event) => onHoverOwner?.(owner, event)}
            onMouseLeave={() => onHoverEnd?.()}
            className={
              active ? ui.ownerPillActive : ui.ownerPill
            }
            aria-pressed={active}
            title={active ? `Remove ${owner} from filter` : `Filter by ${owner}`}
          >
            {owner}
          </button>
        );
      })}
    </div>
  );
}
