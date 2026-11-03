/**
 * Admin session tokens: `email:role:issuedAt:hmac`, signed with HMAC-SHA256 (Web Crypto, so the same code
 * runs in proxy.ts and in route handlers).
 *
 * The signing key is SESSION_SECRET (falls back to MASTER_PASS so existing deployments keep working).
 * There is deliberately no hard-coded default: with no secret configured every token is rejected, instead
 * of being signed with a value anyone can read in the source.
 */
import type { NextRequest } from "next/server";

export type SessionRole = "admin" | "staff";

export const SESSION_COOKIE = "copycat_session_token";
export const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60; // 7 days
const TOKEN_MAX_AGE_MS = SESSION_MAX_AGE_S * 1000;
// A token "issued" more than a minute in the future is forged or from a broken clock
const CLOCK_SKEW_MS = 60 * 1000;

function signingSecret(): string | null {
  const secret = (process.env.SESSION_SECRET || process.env.MASTER_PASS || "").trim();
  return secret.length >= 8 ? secret : null;
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison (length is not secret here: both sides are 64 hex chars) */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isRole(v: string): v is SessionRole {
  return v === "admin" || v === "staff";
}

export async function createSessionTokenEdge(email: string, role: SessionRole): Promise<string> {
  const secret = signingSecret();
  if (!secret) throw new Error("SESSION_SECRET (or MASTER_PASS) is not configured");
  const cleanEmail = email.trim().toLowerCase().replace(/:/g, "");
  const payload = `${cleanEmail}:${role}:${Date.now()}`;
  return `${payload}:${await hmacHex(secret, payload)}`;
}

export async function verifySessionTokenEdge(token?: string | null): Promise<{
  isValid: boolean;
  email?: string;
  role?: SessionRole;
}> {
  const secret = signingSecret();
  if (!secret || !token || typeof token !== "string" || token.length > 512) return { isValid: false };

  const parts = token.split(":");
  if (parts.length !== 4) return { isValid: false };

  const [email, role, issuedStr, providedSignature] = parts;
  if (!isRole(role) || !/^\d{10,16}$/.test(issuedStr) || !/^[0-9a-f]{64}$/.test(providedSignature)) {
    return { isValid: false };
  }
  const issued = Number(issuedStr);
  const age = Date.now() - issued;
  if (age > TOKEN_MAX_AGE_MS || age < -CLOCK_SKEW_MS) return { isValid: false };

  const expected = await hmacHex(secret, `${email}:${role}:${issuedStr}`);
  if (!safeEqual(expected, providedSignature)) return { isValid: false };

  return { isValid: true, email, role };
}

/** Reads and verifies the session from the httpOnly cookie (or an Authorization: Bearer header) */
export async function getSession(req: NextRequest): Promise<{ email: string; role: SessionRole } | null> {
  const token =
    req.cookies.get(SESSION_COOKIE)?.value ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    null;
  const auth = await verifySessionTokenEdge(token);
  return auth.isValid && auth.email && auth.role ? { email: auth.email, role: auth.role } : null;
}
