import { NextRequest, NextResponse } from "next/server";
import { verifySessionTokenEdge } from "@/lib/edge-auth";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect Admin dashboard and Admin API routes
  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");

  if (isAdminPage || isAdminApi) {
    const urlToken = req.nextUrl.searchParams.get("token");
    const token =
      req.cookies.get("copycat_session_token")?.value ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      urlToken;

    const auth = await verifySessionTokenEdge(token);

    if (!auth.isValid) {
      if (isAdminApi) {
        return NextResponse.json(
          {
            success: false,
            error: "وصول أمني غير مصرح به. جلسة الدخول مفقودة أو غير صالحة.",
          },
          { status: 401 }
        );
      }

      // Redirect browser to login page
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (urlToken && auth.isValid) {
      const response = NextResponse.next();
      response.cookies.set("copycat_session_token", urlToken, {
        path: "/",
        httpOnly: false,
        maxAge: 7 * 24 * 60 * 60,
      });
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
