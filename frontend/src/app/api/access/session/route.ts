import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

type SessionBody = {
  action?: "login" | "heartbeat" | "logout";
  sessionId?: string;
  authProvider?: string;
  userAgent?: string;
  deviceType?: string;
  browser?: string;
  platform?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: SessionBody;
  try {
    body = (await request.json()) as SessionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = body.action ?? "heartbeat";

  if (action === "login") {
    const { data, error } = await supabase.rpc("record_user_login", {
      p_auth_provider: body.authProvider ?? "email",
      p_ip_address: clientIp(request),
      p_user_agent: body.userAgent ?? null,
      p_device_type: body.deviceType ?? null,
      p_browser: body.browser ?? null,
      p_platform: body.platform ?? null,
    });

    if (error) {
      const message = (error.message ?? "").toLowerCase();
      const missingRpc =
        message.includes("could not find the function") ||
        message.includes("schema cache");
      if (missingRpc) {
        return NextResponse.json({ success: true, skipped: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sessionId: data });
  }

  if (action === "logout") {
    if (body.sessionId) {
      const { error } = await supabase.rpc("end_user_login_session", {
        p_session_id: body.sessionId,
      });
      if (error) {
        const message = (error.message ?? "").toLowerCase();
        const missingRpc =
          message.includes("could not find the function") ||
          message.includes("schema cache");
        if (!missingRpc) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
    }
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase.rpc("record_user_activity");
  if (error) {
    const message = (error.message ?? "").toLowerCase();
    const missingRpc =
      message.includes("could not find the function") ||
      message.includes("schema cache");
    if (missingRpc) {
      return NextResponse.json({ success: true, skipped: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
