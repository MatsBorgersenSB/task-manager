import { isInternal, type UserRole } from "@/lib/roles";

function safeNextPath(next?: string | null): string | null {
  const value = next?.trim();
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

/** External accounts may only continue into the client portal or a share link. */
function nextForRole(
  role: UserRole | null | undefined,
  next?: string | null
): string | null {
  const safeNext = safeNextPath(next);
  if (!safeNext) return null;
  if (role === "external") {
    if (safeNext.startsWith("/client") || safeNext.startsWith("/share")) {
      return safeNext;
    }
    return null;
  }
  return safeNext;
}

function homeForRole(role: UserRole | null | undefined): string {
  if (role && isInternal(role)) return "/dashboard";
  if (role === "external") return "/client";
  return "/dashboard";
}

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

  const next = nextForRole(role, options.next);
  if (next) return next;

  return homeForRole(role);
}

/** Where to send a signed-in user (honours ?next= for share links). */
export function resolvePostLoginPath(
  role: UserRole | null | undefined,
  next?: string | null
): string {
  const destination = nextForRole(role, next);
  if (destination) return destination;
  return homeForRole(role);
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
