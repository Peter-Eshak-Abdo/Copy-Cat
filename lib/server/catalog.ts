/**
 * Reading the product list from Firestore, cached in Next's data cache so the customer page and the admin
 * pages don't read all ~370 product documents on every visit (Firestore's free tier is 50k reads a day).
 * Every product write calls invalidateProducts(), so the next read is fresh.
 */
import "server-only";
import { revalidateTag } from "next/cache";
import { cachedQuery } from "@/lib/server/cache";
import { COL, getDb } from "@/lib/server/db";
import { cleanProduct, type ProductRow } from "@/lib/server/products";

export const PRODUCTS_TAG = "inventory";

async function readAll(): Promise<ProductRow[]> {
  const db = getDb();
  // Throwing (instead of returning null) keeps "not configured" out of the cache
  if (!db) throw new Error("db_not_configured");
  const snap = await db.collection(COL.inventory).orderBy("id", "asc").limit(5000).get();
  return snap.docs.map((d) => cleanProduct(d.data())).filter((p): p is ProductRow => !!p);
}

export const getAllProducts = cachedQuery(readAll, "inventory-all-v1", { tags: [PRODUCTS_TAG], revalidate: 3600 });

export function invalidateProducts() {
  try {
    revalidateTag(PRODUCTS_TAG, { expire: 0 });
  } catch {
    // Outside a request (scripts): nothing cached to clear
  }
}

/** What the customer page may see: no cost or wholesale prices */
export function storefrontView(p: ProductRow) {
  return { id: p.id, name: p.name, category: p.category, price: p.price, stock_count: p.stock_count, notes: p.notes, image: p.image, images: p.images };
}
