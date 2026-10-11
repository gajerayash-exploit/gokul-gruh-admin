import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "ggu_session";

// Routes that do NOT require authentication.
const PUBLIC_PATHS = ["/login"];
// API routes that do NOT require authentication.
const PUBLIC_API = ["/api/auth/login"];

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "");
}

async function hasValidSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow Next.js internals and static assets straight through.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/assets") ||
    pathname === "/robots.txt"
  ) {
    return NextResponse.next();
  }

  const authed = await hasValidSession(req);
  const isPublicPage = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isPublicApi = PUBLIC_API.some((p) => pathname === p);

  // API protection: reject unauthenticated API calls with 401 (no redirect).
  if (pathname.startsWith("/api")) {
    if (isPublicApi || authed) return NextResponse.next();
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Signed-in users should not see the login page.
  if (authed && isPublicPage) {
    return NextResponse.redirect(new URL("/notebook", req.url));
  }

  // Unauthenticated users may only see public pages.
  if (!authed && !isPublicPage) {
    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/") loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
