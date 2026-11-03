/**
 * Server-only login accounts, configured through environment variables (never NEXT_PUBLIC_):
 *   MASTER_EMAIL / MASTER_PASS  → admin (the engineer: confirms InstaPay, reviews the change log)
 *   STAFF_EMAIL  / STAFF_PASS   → staff (every tool; records InstaPay transfers but cannot confirm them)
 */
import "server-only";
import { safeEqual, type SessionRole } from "@/lib/edge-auth";

interface Account {
  email: string;
  password: string;
  role: SessionRole;
  name: string;
}

function configuredAccounts(): Account[] {
  const list: Account[] = [];
  const adminEmail = (process.env.MASTER_EMAIL || process.env.NEXT_PUBLIC_MASTER_EMAIL || "").trim().toLowerCase();
  const adminPass = (process.env.MASTER_PASS || "").trim();
  if (adminEmail && adminPass) list.push({ email: adminEmail, password: adminPass, role: "admin", name: "الباشمهندس" });

  const staffEmail = (process.env.STAFF_EMAIL || "").trim().toLowerCase();
  const staffPass = (process.env.STAFF_PASS || "").trim();
  if (staffEmail && staffPass) list.push({ email: staffEmail, password: staffPass, role: "staff", name: "الموظف" });
  return list;
}

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Checks every account (no early exit) and compares hashes in constant time */
export async function findAccount(email: string, password: string): Promise<Omit<Account, "password"> | null> {
  const cleanEmail = email.trim().toLowerCase();
  const passHash = await sha256Hex(password.trim());
  let match: Omit<Account, "password"> | null = null;
  for (const acc of configuredAccounts()) {
    const emailOk = safeEqual(await sha256Hex(acc.email), await sha256Hex(cleanEmail));
    const passOk = safeEqual(await sha256Hex(acc.password), passHash);
    if (emailOk && passOk && !match) match = { email: acc.email, role: acc.role, name: acc.name };
  }
  return match;
}

export function displayName(role: SessionRole): string {
  return role === "admin" ? "الباشمهندس" : "الموظف";
}
