import { NextRequest, NextResponse } from "next/server";
import { createSessionTokenEdge } from "@/lib/edge-auth";
import { checkRateLimit } from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    // 1. IP Rate Limiting to prevent brute-force attacks
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const rateCheck = checkRateLimit(`login_${ip}`, 6, 5 * 60 * 1000); // 6 attempts per 5 minutes

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          isMaster: false,
          error: "تم تجاوز الحد الأقصى لمحاولات الدخول. يرجى الانتظار 5 دقائق والمحاولة مجدداً.",
        },
        { status: 429 }
      );
    }

    // 2. Validate input
    const body = await req.json().catch(() => ({}));
    const { email, password } = body;

    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanPass = (password || "").trim();

    const masterEmail = (
      process.env.MASTER_EMAIL ||
      process.env.NEXT_PUBLIC_MASTER_EMAIL ||
      ""
    ).trim().toLowerCase();
    const masterPass = (process.env.MASTER_PASS || "").trim();

    if (
      masterPass &&
      masterEmail &&
      cleanEmail === masterEmail &&
      cleanPass === masterPass
    ) {
      // 3. Generate Cryptographically Signed HMAC Session Token
      const sessionToken = await createSessionTokenEdge(masterEmail, "admin");

      const response = NextResponse.json({
        isMaster: true,
        success: true,
        email: masterEmail,
        name: "مدير كوبي كات",
        token: sessionToken,
      });

      // 4. Set HttpOnly Secure Cookie (Protection against XSS token theft)
      response.cookies.set({
        name: "copycat_session_token",
        value: sessionToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      return response;
    }

    return NextResponse.json(
      { isMaster: false, success: false, error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" },
      { status: 401 }
    );
  } catch (error) {
    console.error("Auth verification failed:", error);
    return NextResponse.json(
      { isMaster: false, success: false, error: "حدث خطأ أثناء فحص البيانات" },
      { status: 500 }
    );
  }
}
