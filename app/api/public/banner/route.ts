import { NextResponse } from "next/server";
import { getBannerText } from "@/lib/server/settings";

/**
 * The announcement line on the customer page. Public and read-only: exactly one settings key is exposed,
 * kept in Next's data cache until it changes and cached at the edge for a minute.
 */
export async function GET() {
  let text: string | null = null;
  try {
    text = await getBannerText();
  } catch {
    // Database not connected or unreachable: no banner
  }
  return NextResponse.json(
    { text },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
