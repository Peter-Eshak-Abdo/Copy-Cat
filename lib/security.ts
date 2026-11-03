/**
 * Server-side security helpers: rate limiting and outbound-URL allow lists (SSRF protection).
 * Session tokens live in lib/edge-auth.ts.
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Fixed-window rate limiter. In-memory, so on Vercel each warm instance counts separately: it slows
 * brute force down rather than stopping a distributed attack, which is why login also adds a delay.
 */
export function checkRateLimit(
  identifier: string,
  maxRequests = 10,
  windowMs = 60 * 1000
): { allowed: boolean; remaining: number; retryAfterS: number } {
  const now = Date.now();
  // Drop expired entries as we go (no setInterval: it keeps serverless instances busy)
  if (rateLimitStore.size > 5000) {
    for (const [key, record] of rateLimitStore) if (now > record.resetTime) rateLimitStore.delete(key);
  }
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, retryAfterS: 0 };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, retryAfterS: Math.ceil((record.resetTime - now) / 1000) };
  }

  record.count++;
  return { allowed: true, remaining: maxRequests - record.count, retryAfterS: 0 };
}

/** Client IP as Vercel reports it (first x-forwarded-for hop), for rate-limit keys only */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}

function hostMatches(rawUrl: string, hosts: string[]): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
    if (parsed.port && parsed.port !== "443") return false;
    const hostname = parsed.hostname.toLowerCase();
    return hosts.some((h) => hostname === h || hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** A Facebook post / album link the scraper may open */
export function isAllowedFacebookUrl(rawUrl: string): boolean {
  return hostMatches(rawUrl, ["facebook.com", "fb.watch", "fb.com"]);
}

/** A Facebook CDN image the server may download (scontent-*.xx.fbcdn.net) */
export function isAllowedFacebookImageUrl(rawUrl: string): boolean {
  return hostMatches(rawUrl, ["fbcdn.net", "fbsbx.com"]);
}
