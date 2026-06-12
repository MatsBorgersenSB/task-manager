import { isInternal, type UserRole } from "@/lib/roles";

type RedirectOptions = {
  next?: string | null;
  type?: string | null;
};

/** Choose post-auth destination after email confirm, OAuth, or recovery. */
export function resolveAuthCallbackRedirect(
  role: UserRole | null,
  options: RedirectOptions
): string {
  const next = options.next?.trim();
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }

  if (options.type === "recovery") {
    return "/reset-password";
  }

  if (role && isInternal(role)) {
    return "/internal";
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
