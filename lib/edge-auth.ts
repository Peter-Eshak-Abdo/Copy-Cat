const MASTER_PASS = process.env.MASTER_PASS || "copycat_master_default_salt_2026";
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Creates an HMAC-SHA256 session token using the standard Web Crypto API.
 * 100% compatible with Node.js, Next.js Edge Runtime, and Vercel.
 */
export async function createSessionTokenEdge(
  email: string,
  role: "admin" | "staff" = "admin"
): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  const timestampStr = Date.now().toString();
  const payload = `${cleanEmail}:${role}:${timestampStr}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(MASTER_PASS),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const hexSignature = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${payload}:${hexSignature}`;
}

/**
 * Verifies the authenticity and expiration of an HMAC-SHA256 session token.
 */
export async function verifySessionTokenEdge(token?: string | null): Promise<{
  isValid: boolean;
  email?: string;
  role?: "admin" | "staff";
}> {
  if (!token || typeof token !== "string") {
    return { isValid: false };
  }

  const parts = token.split(":");
  if (parts.length !== 4) {
    return { isValid: false };
  }

  const [email, role, timestampStr, providedSignature] = parts;
  const timestamp = parseInt(timestampStr, 10);

  if (isNaN(timestamp) || Date.now() - timestamp > TOKEN_MAX_AGE_MS) {
    return { isValid: false };
  }

  const payload = `${email}:${role}:${timestampStr}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(MASTER_PASS),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const hexSignature = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (hexSignature !== providedSignature) {
    return { isValid: false };
  }

  return {
    isValid: true,
    email,
    role: role as "admin" | "staff",
  };
}
