import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/edge-auth";
import { displayName } from "@/lib/accounts";

/** Who is logged in, from the httpOnly session cookie. The admin UI trusts only this. */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  return NextResponse.json(
    { email: session.email, role: session.role, name: displayName(session.role) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
