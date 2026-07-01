"use client";

import { parseUserAgent } from "@/lib/access/userAgent";
import { ACCESS_SESSION_STORAGE_KEY } from "@/lib/access/types";

type SessionPayload = {
  authProvider?: string;
  sessionId?: string;
};

async function postAccess(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Access tracking failed (${response.status})`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

export async function beginAccessSession(authProvider = "email"): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const existing = sessionStorage.getItem(ACCESS_SESSION_STORAGE_KEY);
  if (existing) {
    void sendActivityHeartbeat();
    return existing;
  }

  const parsed = parseUserAgent(navigator.userAgent);

  try {
    const result = await postAccess("/api/access/session", {
      action: "login",
      authProvider,
      userAgent: parsed.userAgent,
      deviceType: parsed.deviceType,
      browser: parsed.browser,
      platform: parsed.platform,
    });

    const sessionId = result.sessionId as string | undefined;
    if (sessionId) {
      sessionStorage.setItem(ACCESS_SESSION_STORAGE_KEY, sessionId);
    }
    return sessionId ?? null;
  } catch (err) {
    console.warn("[beginAccessSession]", err);
    return null;
  }
}

export async function sendActivityHeartbeat(): Promise<void> {
  const sessionId = sessionStorage.getItem(ACCESS_SESSION_STORAGE_KEY);
  if (!sessionId) return;

  try {
    await postAccess("/api/access/session", {
      action: "heartbeat",
      sessionId,
    });
  } catch {
    /* best-effort */
  }
}

export async function endAccessSession(): Promise<void> {
  const sessionId = sessionStorage.getItem(ACCESS_SESSION_STORAGE_KEY);
  if (!sessionId) return;

  try {
    await postAccess("/api/access/session", {
      action: "logout",
      sessionId,
    });
  } catch {
    /* best-effort */
  } finally {
    sessionStorage.removeItem(ACCESS_SESSION_STORAGE_KEY);
  }
}

export function detectAuthProvider(
  appMetadata?: Record<string, unknown> | null
): string {
  const provider = appMetadata?.provider;
  if (typeof provider === "string" && provider.trim()) return provider;
  return "email";
}
