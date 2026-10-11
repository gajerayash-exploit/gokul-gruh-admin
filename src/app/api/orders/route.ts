import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/session";
import { createDraft, listOrders, type ListFilters } from "@/lib/orders/service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const filters: ListFilters = {
    dateISO: sp.get("date") || undefined,
    fromISO: sp.get("from") || undefined,
    toISO: sp.get("to") || undefined,
    search: sp.get("q") || undefined,
    status: (sp.get("status") as "DRAFT" | "COMPLETE") || undefined,
    sortBy: (sp.get("sortBy") as ListFilters["sortBy"]) || undefined,
    sortDir: (sp.get("sortDir") as ListFilters["sortDir"]) || undefined,
    page: sp.get("page") ? Number(sp.get("page")) : undefined,
    pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : undefined,
  };
  const result = await listOrders(filters);
  return NextResponse.json(result);
}

const createSchema = z.object({
  businessDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* allow empty body */
  }
  const parsed = createSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }
  const order = await createDraft(admin.id, parsed.data.businessDate);
  return NextResponse.json({ order }, { status: 201 });
}
