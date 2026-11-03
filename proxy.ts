import { NextRequest, NextResponse } from "next/server";
import { verifySessionTokenEdge, SESSION_COOKIE } from "@/lib/edge-auth";

/**
 * Login gate for the staff side. Admin pages redirect to /login; admin APIs answer 401.
 * The AI routes (OCR, research, photo enhancement, product images) spend paid/free-quota API
 * keys, so they are staff-only too even though they live outside /api/admin.
 */
const PROTECTED_API_PREFIXES = [
  "/api/admin",
  "/api/ocr",
  "/api/research",
  "/api/enhance-portrait",
  "/api/ai",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const isProtectedApi = PROTECTED_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!isAdminPage && !isProtectedApi) return NextResponse.next();

  const token =
    req.cookies.get(SESSION_COOKIE)?.value ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    null;
  const auth = await verifySessionTokenEdge(token);

  if (!auth.isValid) {
    if (isProtectedApi) {
      return NextResponse.json({ success: false, error: "لازم تسجل دخول الأول." }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/ocr/:path*",
    "/api/research/:path*",
    "/api/enhance-portrait/:path*",
    "/api/ai/:path*",
  ],
};
