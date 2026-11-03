import { NextResponse } from "next/server";
import { getAllProducts, storefrontView } from "@/lib/server/catalog";

/**
 * The product list for the customer page. Public and read-only, without cost or wholesale prices.
 * Served from Next's data cache (refreshed when a product changes) and cached at the edge for a minute.
 * `items: null` means the database isn't reachable: the page keeps the catalog built into the code.
 */
export async function GET() {
  let items: ReturnType<typeof storefrontView>[] | null = null;
  try {
    items = (await getAllProducts()).map(storefrontView);
  } catch {
    items = null;
  }
  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": items ? "public, s-maxage=60, stale-while-revalidate=600" : "no-store" } }
  );
}
