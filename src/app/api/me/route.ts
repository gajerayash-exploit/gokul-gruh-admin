import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ admin: null }, { status: 401 });
  return NextResponse.json({ admin });
}
