/** Parse auth callback params from query string and URL hash. */
export function parseAuthCallbackParams(searchParams: URLSearchParams) {
  const hashParams =
    typeof window !== "undefined" && window.location.hash.startsWith("#")
      ? new URLSearchParams(window.location.hash.slice(1))
      : new URLSearchParams();

  const params = {
    code: searchParams.get("code") ?? hashParams.get("code"),
    type: searchParams.get("type") ?? hashParams.get("type"),
    next: searchParams.get("next") ?? hashParams.get("next"),
    accessToken: hashParams.get("access_token"),
    refreshToken: hashParams.get("refresh_token"),
    error: searchParams.get("error") ?? hashParams.get("error"),
    errorDescription:
      searchParams.get("error_description") ?? hashParams.get("error_description"),
    rawSearch:
      typeof window !== "undefined" ? window.location.search : searchParams.toString(),
    rawHash: typeof window !== "undefined" ? window.location.hash : "",
  };

  console.debug("[auth/recovery] parsed callback params", params);
  return params;
}

export function isRecoveryFromParams(params: {
  type: string | null;
  next: string | null;
}): boolean {
  if (params.type === "recovery") return true;
  const next = params.next?.trim();
  return next === "/reset-password";
}
