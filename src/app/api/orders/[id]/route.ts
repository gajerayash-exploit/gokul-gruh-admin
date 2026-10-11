import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/session";
import {
  getOrder,
  updateOrder,
  softDeleteOrder,
  ConcurrencyError,
  type OrderPatch,
} from "@/lib/orders/service";

export const runtime = "nodejs";

const patchSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fullName: z.string().max(120).optional(),
  phoneNumber: z.string().max(40).optional(),
  address: z.string().max(500).optional(),
  orderType: z.string().max(80).optional(),
  docketNumber: z.string().max(60).optional(),
  quantity: z.coerce.number().int().min(0).max(1_000_000).optional(),
  unitPrice: z.coerce.number().min(0).max(100_000_000).optional(),
  finalize: z.boolean().optional(),
  expectedVersion: z.number().int().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ order });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { expectedVersion, ...patch } = parsed.data;
  try {
    const order = await updateOrder(
      id,
      patch as OrderPatch,
      admin.id,
      expectedVersion
    );
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof ConcurrencyError) {
      return NextResponse.json(
        { error: err.message, conflict: true, current: err.current },
        { status: 409 }
      );
    }
    const msg = err instanceof Error ? err.message : "Update failed.";
    const status = msg.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await softDeleteOrder(id, admin.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Delete failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
