import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/session";
import { restoreOrder } from "@/lib/orders/service";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const order = await restoreOrder(id, admin.id);
    return NextResponse.json({ order });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Restore failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
