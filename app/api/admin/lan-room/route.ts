import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/edge-auth";
import { getAdminAuth } from "@/lib/server/db";

/**
 * Gives a logged-in shop PC what it needs to find the other PCs for a direct WebRTC transfer:
 *   room  — an HMAC of the server secret, so nobody without a staff login can guess it
 *   token — a Firebase custom token (claims lan + lanRoom) that firestore.rules requires for
 *           lanRooms/{room}/peers and lanRooms/{room}/signals; nothing else in Firestore is readable
 * Only connection set-up messages go through Firestore; the file itself travels PC-to-PC, encrypted by
 * WebRTC (DTLS). `realtime: false` → the page uses the server relay instead.
 */
const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const secret = (process.env.SESSION_SECRET || process.env.MASTER_PASS || "").trim();
  const adminAuth = getAdminAuth();
  if (!secret || !adminAuth || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    return NextResponse.json({ realtime: false }, noStore);
  }

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("copycat-lan-room-v1"));
  const room = `lan-${Array.from(new Uint8Array(sig).slice(0, 16))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;

  try {
    // One Firebase user per role (not per visit), so Authentication doesn't fill up with users
    const token = await adminAuth.createCustomToken(`lan-${session.role}`, { lan: true, lanRoom: room });
    return NextResponse.json({ realtime: true, room, token, who: session.email }, noStore);
  } catch (err) {
    console.error("LAN custom token failed:", err);
    return NextResponse.json({ realtime: false }, noStore);
  }
}
