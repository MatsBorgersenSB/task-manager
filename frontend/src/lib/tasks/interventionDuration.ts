export const INTERVENTION_HOURS_PER_DAY = 8;

export function splitInterventionHours(totalHours: number): {
  days: number;
  hours: number;
} {
  const total = Math.max(0, Math.floor(Number(totalHours) || 0));
  return {
    days: Math.floor(total / INTERVENTION_HOURS_PER_DAY),
    hours: total % INTERVENTION_HOURS_PER_DAY,
  };
}

export function combineInterventionHours(days: number, hours: number): number {
  const safeDays = Math.max(0, Math.floor(Number(days) || 0));
  const safeHours = Math.min(
    23,
    Math.max(0, Math.floor(Number(hours) || 0))
  );
  return safeDays * INTERVENTION_HOURS_PER_DAY + safeHours;
}

export function formatInterventionDuration(totalHours: number): string {
  const { days, hours } = splitInterventionHours(totalHours);
  if (days === 0 && hours === 0) return "";
  if (days === 0) return `${hours}h`;
  if (hours === 0) return `${days}d`;
  return `${days}d ${hours}h`;
}
