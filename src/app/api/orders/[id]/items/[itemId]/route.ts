import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/session";
import { updateOrderItem, deleteOrderItem } from "@/lib/orders/service";

export const runtime = "nodejs";

const patchSchema = z.object({
  itemName: z.string().min(1).optional(),
  quantity: z.number().int().min(1).optional(),
  unitPrice: z.number().min(0).optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update data" }, { status: 400 });
  }

  try {
    const updated = await updateOrderItem(id, itemId, parsed.data, admin.id);
    return NextResponse.json({ order: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not update item" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await context.params;

  try {
    const updated = await deleteOrderItem(id, itemId, admin.id);
    return NextResponse.json({ order: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not delete item" },
      { status: 400 }
    );
  }
}
