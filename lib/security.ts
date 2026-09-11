import crypto from "crypto";

const MASTER_PASS = process.env.MASTER_PASS || "copycat_master_default_salt_2026";
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Creates a cryptographically signed HMAC-SHA256 session token.
 * Format: email:role:timestamp:signature
 */
export function createSessionToken(email: string, role: "admin" | "staff" = "admin"): string {
  const cleanEmail = email.trim().toLowerCase();
  const timestamp = Date.now().toString();
  const payload = `${cleanEmail}:${role}:${timestamp}`;
  const signature = crypto.createHmac("sha256", MASTER_PASS).update(payload).digest("hex");
  return `${payload}:${signature}`;
}

/**
 * Verifies the integrity, authenticity, and expiration of a session token.
 */
export function verifySessionToken(token?: string | null): {
  isValid: boolean;
  email?: string;
  role?: "admin" | "staff";
  error?: string;
} {
  if (!token || typeof token !== "string") {
    return { isValid: false, error: "التوكن مفقود أو غير صالح" };
  }

  const parts = token.split(":");
  if (parts.length !== 4) {
    return { isValid: false, error: "بنية التوكن غير صحيحة" };
  }

  const [email, role, timestampStr, providedSignature] = parts;
  const timestamp = parseInt(timestampStr, 10);

  if (isNaN(timestamp) || Date.now() - timestamp > TOKEN_MAX_AGE_MS) {
    return { isValid: false, error: "انتهت صلاحية جلسة الدخول" };
  }

  const payload = `${email}:${role}:${timestampStr}`;
  const expectedSignature = crypto.createHmac("sha256", MASTER_PASS).update(payload).digest("hex");

  // Constant-time comparison to prevent timing attacks
  const providedBuffer = Buffer.from(providedSignature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return { isValid: false, error: "توقيع الجلسة غير متطابق" };
  }

  return {
    isValid: true,
    email,
    role: role as "admin" | "staff",
  };
}

/**
 * In-memory IP Rate Limiter to protect endpoints like login from brute-force attacks.
 */
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup stale entries every 10 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 10 * 60 * 1000);
}

export function checkRateLimit(
  identifier: string,
  maxRequests = 10,
  windowMs = 60 * 1000
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: maxRequests - record.count };
}

/**
 * Validates that an external URL is strictly a legitimate Facebook domain
 * to prevent SSRF (Server-Side Request Forgery).
 */
export function isAllowedFacebookUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;

    const hostname = parsed.hostname.toLowerCase();
    const allowedHosts = [
      "facebook.com",
      "www.facebook.com",
      "m.facebook.com",
      "web.facebook.com",
      "fb.watch",
      "fb.com",
    ];

    return allowedHosts.some((h) => hostname === h || hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}
