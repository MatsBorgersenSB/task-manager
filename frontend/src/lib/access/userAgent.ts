export type ParsedUserAgent = {
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
  browser: string;
  platform: string;
  userAgent: string;
};

export function parseUserAgent(ua: string): ParsedUserAgent {
  const raw = ua.trim() || "Unknown";
  const lower = raw.toLowerCase();

  let deviceType: ParsedUserAgent["deviceType"] = "desktop";
  if (/ipad|tablet/.test(lower)) deviceType = "tablet";
  else if (/mobi|iphone|android/.test(lower)) deviceType = "mobile";

  let browser = "Unknown";
  if (lower.includes("edg/")) browser = "Edge";
  else if (lower.includes("chrome/") && !lower.includes("edg")) browser = "Chrome";
  else if (lower.includes("firefox/")) browser = "Firefox";
  else if (lower.includes("safari/") && !lower.includes("chrome")) browser = "Safari";

  let platform = "Unknown";
  if (lower.includes("windows")) platform = "Windows";
  else if (lower.includes("mac os") || lower.includes("macintosh")) platform = "macOS";
  else if (lower.includes("iphone") || lower.includes("ipad")) platform = "iOS";
  else if (lower.includes("android")) platform = "Android";
  else if (lower.includes("linux")) platform = "Linux";

  return { deviceType, browser, platform, userAgent: raw };
}
