import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/session";
import { bulkCreate, type BulkRow } from "@/lib/orders/service";

export const runtime = "nodejs";

// Short-lived guard so a retried import (same importId) cannot duplicate rows.
const recentImports = new Map<string, { at: number; created: number }>();
const IMPORT_TTL = 60 * 1000;

function remember(id: string, created: number) {
  const now = Date.now();
  for (const [k, v] of recentImports) if (now - v.at > IMPORT_TTL) recentImports.delete(k);
  recentImports.set(id, { at: now, created });
}

const rowSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fullName: z.string().max(120).default(""),
  phoneNumber: z.string().max(40).default(""),
  address: z.string().max(500).default(""),
  orderType: z.string().max(80).default(""),
  docketNumber: z.string().max(60).default(""),
  quantity: z.coerce.number().int().min(0).max(1_000_000).default(0),
  unitPrice: z.coerce.number().min(0).max(100_000_000).default(0),
});

const schema = z.object({
  importId: z.string().min(8).max(64),
  rows: z.array(rowSchema).min(1).max(1000),
});

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid import." },
      { status: 400 }
    );
  }

  // Idempotency: if we just processed this importId, return the prior result.
  const prior = recentImports.get(parsed.data.importId);
  if (prior) {
    return NextResponse.json({
      created: prior.created,
      idempotent: true,
    });
  }

  const result = await bulkCreate(parsed.data.rows as BulkRow[], admin.id);
  remember(parsed.data.importId, result.created);
  return NextResponse.json(result, { status: 201 });
}
