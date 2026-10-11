import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/session";
import { getSettings, updateSettings } from "@/lib/settings/service";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getSettings();
  return NextResponse.json({ settings });
}

const MAX_LOGO_CHARS = 700_000; // ~500KB image as data URL

const schema = z.object({
  businessName: z.string().min(1).max(120).optional(),
  contactPerson: z.string().max(120).optional(),
  phoneNumber: z.string().max(40).optional(),
  address: z.string().max(500).optional(),
  mapsQuery: z.string().max(300).optional(),
  logoDataUrl: z
    .string()
    .max(MAX_LOGO_CHARS, "Logo image is too large (max ~500KB).")
    .refine(
      (v) => v === "" || /^data:image\/(png|jpeg|jpg|svg\+xml|webp);base64,/.test(v),
      "Logo must be a PNG, JPEG, WEBP, or SVG image."
    )
    .optional(),
  orderTypes: z.array(z.string().max(80)).max(100).optional(),
  defaultDateToday: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
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
      { error: parsed.error.issues[0]?.message ?? "Invalid settings." },
      { status: 400 }
    );
  }
  const settings = await updateSettings(parsed.data, admin.id);
  return NextResponse.json({ settings });
}
