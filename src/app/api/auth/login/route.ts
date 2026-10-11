import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/service";
import { rateLimit, clientKey } from "@/lib/auth/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(1, "Password is required."),
});

export async function POST(req: NextRequest) {
  // Rate limit login attempts: 10 per 5 minutes per IP.
  const rl = rateLimit(clientKey(req, "login"), 10, 5 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const admin = await prisma.admin.findUnique({ where: { email } });

  // Constant-ish response regardless of whether the account exists.
  const ok = admin ? await verifyPassword(parsed.data.password, admin.passwordHash) : false;

  if (!admin || !ok) {
    // Generic message — never reveal which part failed.
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  const token = await createSessionToken({
    sub: admin.id,
    email: admin.email,
    name: admin.name,
  });
  await setSessionCookie(token);

  await logAudit({
    action: "LOGIN",
    entityType: "auth",
    entityId: admin.id,
    summary: `Admin logged in: ${admin.email}`,
    actorId: admin.id,
  });

  return NextResponse.json({
    admin: { id: admin.id, email: admin.email, name: admin.name },
  });
}
