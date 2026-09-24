/** Last-resort actor email from the signed-in server page (TaskManager). */
let actorEmailFallback: string | null = null;

export function setTaskActorEmail(email: string | null | undefined): void {
  const trimmed = email?.trim() || "";
  actorEmailFallback = trimmed || null;
}

export function getTaskActorEmailFallback(): string | null {
  return actorEmailFallback;
}
