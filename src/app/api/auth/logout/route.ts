import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentAdmin } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/service";

export const runtime = "nodejs";

export async function POST() {
  const admin = await getCurrentAdmin();
  await clearSessionCookie();
  if (admin) {
    await logAudit({
      action: "LOGOUT",
      entityType: "auth",
      entityId: admin.id,
      summary: `Admin logged out: ${admin.email}`,
      actorId: admin.id,
    });
  }
  return NextResponse.json({ ok: true });
}
