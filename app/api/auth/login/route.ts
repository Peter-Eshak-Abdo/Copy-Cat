import { NextRequest, NextResponse } from "next/server";
import { createSessionTokenEdge, SESSION_COOKIE, SESSION_MAX_AGE_S } from "@/lib/edge-auth";
import { checkRateLimit, clientIp } from "@/lib/security";
import { findAccount } from "@/lib/accounts";
import { writeAudit } from "@/lib/server/audit";

// Every failed attempt takes at least this long, so guessing is slow even across many server instances
const FAIL_DELAY_MS = 900;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const rate = checkRateLimit(`login_${ip}`, 6, 5 * 60 * 1000); // 6 attempts per 5 minutes per IP
  if (!rate.allowed) {
    return NextResponse.json(
      { success: false, error: `محاولات كتير. استنى ${Math.ceil(rate.retryAfterS / 60)} دقيقة وجرب تاني.` },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterS) } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.slice(0, 200) : "";
  const password = typeof body?.password === "string" ? body.password.slice(0, 200) : "";

  const started = Date.now();
  const account = email && password ? await findAccount(email, password) : null;

  if (!account) {
    await sleep(Math.max(0, FAIL_DELAY_MS - (Date.now() - started)));
    return NextResponse.json({ success: false, error: "الإيميل أو الباسورد غلط." }, { status: 401 });
  }

  let token: string;
  try {
    token = await createSessionTokenEdge(account.email, account.role);
  } catch {
    console.error("Login: SESSION_SECRET / MASTER_PASS is not configured");
    return NextResponse.json({ success: false, error: "السيرفر مش متظبط، كلم الباشمهندس." }, { status: 500 });
  }

  await writeAudit({ actor: account.email, role: account.role, action: "login", entity: "session" });

  // The token only travels in an httpOnly cookie: page scripts (and any injected script) cannot read it
  const response = NextResponse.json({ success: true, email: account.email, role: account.role, name: account.name });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  return response;
}
