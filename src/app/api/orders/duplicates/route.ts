import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/session";
import { findByDocket } from "@/lib/orders/service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const docket = req.nextUrl.searchParams.get("docket") ?? "";
  const excludeId = req.nextUrl.searchParams.get("excludeId") ?? undefined;
  const matches = await findByDocket(docket, excludeId);
  return NextResponse.json({ matches });
}
