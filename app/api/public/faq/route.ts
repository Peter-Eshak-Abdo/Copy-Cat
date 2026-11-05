import { NextResponse } from "next/server";
import { getFaqList } from "@/lib/server/settings";

/**
 * The storefront's customer questions (FAQ). Public and read-only: only the "storefront.faq" setting is
 * exposed, kept in Next's data cache until it is edited and cached at the edge for a minute.
 * { items: null } means nothing was saved yet (or no database): the page shows its built-in list.
 */
export async function GET() {
  let items = null;
  try {
    items = await getFaqList();
  } catch {
    // Database not connected or unreachable
  }
  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
