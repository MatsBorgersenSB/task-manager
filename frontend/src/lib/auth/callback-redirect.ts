import { isInternal, type UserRole } from "@/lib/roles";

type RedirectOptions = {
  next?: string | null;
  type?: string | null;
  isRecovery?: boolean;
};

/** Choose post-auth destination after email confirm, OAuth, or recovery. */
export function resolveAuthCallbackRedirect(
  role: UserRole | null,
  options: RedirectOptions
): string {
  if (options.isRecovery || options.type === "recovery") {
    console.debug("[auth/callback] recovery redirect → /reset-password");
    return "/reset-password";
  }

  const next = options.next?.trim();
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }

  if (role && isInternal(role)) {
    return "/today";
  }

  if (role === "external") {
    return "/client";
  }

  return "/dashboard";
}

/** Where to send a signed-in user (honours ?next= for share links). */
export function resolvePostLoginPath(
  role: UserRole | null | undefined,
  next?: string | null
): string {
  const safeNext = next?.trim();
  if (safeNext && safeNext.startsWith("/") && !safeNext.startsWith("//")) {
    return safeNext;
  }

  if (role && isInternal(role)) {
    return "/today";
  }

  if (role === "external") {
    return "/client";
  }

  return "/dashboard";
}

export function authCallbackErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case "auth":
      return "Sign-in was cancelled or failed. Please try again.";
    case "confirmation":
      return "Email confirmation failed or the link expired. Try signing in or sign up again.";
    case "recovery":
      return "Password recovery link is invalid or expired. Request a new reset email.";
    default:
      return "Authentication failed. Please try again.";
  }
}
