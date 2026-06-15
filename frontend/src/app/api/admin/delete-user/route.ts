import { NextResponse } from "next/server";
import {
  createServiceRoleClient,
  deleteAuthUserByEmail,
} from "@/lib/admin/delete-auth-user";
import { getAuthContextServer } from "@/lib/profiles-server";

/**
 * TEMPORARY admin-only endpoint to delete an auth user by email.
 * Requires signed-in admin + ADMIN_DELETE_SECRET header.
 *
 * POST /api/admin/delete-user
 * Headers: x-admin-delete-secret: <ADMIN_DELETE_SECRET>
 * Body: { "email": "user@example.com" }
 */
export async function POST(request: Request) {
  const secret = process.env.ADMIN_DELETE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "ADMIN_DELETE_SECRET is not configured on the server." },
      { status: 503 }
    );
  }

  if (request.headers.get("x-admin-delete-secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ctx = await getAuthContextServer();
  if (!ctx.user || !ctx.isAdmin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = body.email?.trim();
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  if (email.toLowerCase() === ctx.user.email?.toLowerCase()) {
    return NextResponse.json(
      { error: "You cannot delete your own account via this endpoint." },
      { status: 400 }
    );
  }

  try {
    const admin = createServiceRoleClient();
    const result = await deleteAuthUserByEmail(admin, email);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      email: result.email,
      userId: result.userId,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to delete user.",
      },
      { status: 500 }
    );
  }
}
