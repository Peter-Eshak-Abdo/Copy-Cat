import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSession, type SessionRole } from "@/lib/edge-auth";

export type Session = { email: string; role: SessionRole };

/**
 * proxy.ts already rejects requests without a login; this re-checks inside the handler (defence in depth)
 * and enforces the role. Returns the session, or a ready 401/403 response.
 */
export async function requireSession(req: NextRequest, role?: SessionRole): Promise<Session | NextResponse> {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "لازم تسجل دخول الأول." }, { status: 401 });
  if (role === "admin" && session.role !== "admin") {
    return NextResponse.json({ error: "الحاجة دي للباشمهندس بس." }, { status: 403 });
  }
  return session;
}

/** Parses a JSON body with a size cap (default 256 KB) */
export async function readJson<T = unknown>(req: NextRequest, maxBytes = 256 * 1024): Promise<T | null> {
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > maxBytes) return null;
  const text = await req.text().catch(() => "");
  if (!text || text.length > maxBytes) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export const noStore = { headers: { "Cache-Control": "no-store" } };

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
