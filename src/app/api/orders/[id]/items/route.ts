import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/session";
import { addOrderItem } from "@/lib/orders/service";

export const runtime = "nodejs";

const itemSchema = z.object({
  itemName: z.string().min(1, "Item name is required"),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().min(0).default(0),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid item data", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const updated = await addOrderItem(id, parsed.data, admin.id);
    return NextResponse.json({ order: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not add item" },
      { status: 400 }
    );
  }
}
