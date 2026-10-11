import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/session";
import { getTodaySummary } from "@/lib/orders/service";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const summary = await getTodaySummary();
  return NextResponse.json(summary);
}
