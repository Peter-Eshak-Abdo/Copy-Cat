/**
 * Puts the product catalog into Firestore (collection `inventory`, doc id = product number).
 *
 *   npx tsx scripts/migrate_to_firestore.ts --dry-run       show what would be written
 *   npx tsx scripts/migrate_to_firestore.ts                 write products that aren't there yet
 *   npx tsx scripts/migrate_to_firestore.ts --overwrite     also replace products already in Firestore
 *
 * Source: the built-in catalog (lib/inventory.ts INITIAL_PRODUCTS, 358 products with photos, no repeated
 * names). The old Supabase backup matched it (same prices, stock and notes; cost prices were all 0); its 7
 * extra rows were test seeds that repeated existing products and were left out on the owner's request. Needs FIREBASE_SERVICE_ACCOUNT in .env.local. Without --overwrite, running it twice is
 * harmless and never undoes edits made from the admin pages.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { INITIAL_PRODUCTS, type InventoryItem } from "../lib/inventory";

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const OVERWRITE = args.has("--overwrite");

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    for (const line of readFileSync(join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
      if (!m) continue;
      const v = m[2].trim();
      // Strip quotes around a plain value, but not the quotes of a JSON value pasted without its { }
      env[m[1]] = /^(["']).*\1$/.test(v) && !v.includes('":') ? v.slice(1, -1) : v;
    }
  } catch {}
  return { ...env, ...(process.env as Record<string, string>) };
}

/** Same shape the API stores (lib/server/products.ts cleanProduct) */
function toDoc(p: InventoryItem) {
  return {
    id: p.id,
    name: p.name.trim(),
    category: p.category?.trim() || "عام",
    price: Number(p.price) || 0,
    cost_price: p.cost_price ? Number(p.cost_price) : null,
    wholesale_price: p.wholesale_price ? Number(p.wholesale_price) : null,
    wholesale_min_qty: p.wholesale_min_qty ? Number(p.wholesale_min_qty) : null,
    stock_count: Math.trunc(Number(p.stock_count) || 0),
    notes: p.notes?.trim() || null,
    image: p.image || null,
    images: (p.images || []).slice(0, 8),
    updated_at: Timestamp.now(),
    updated_by: "migration",
  };
}

async function main() {
  const products: InventoryItem[] = [...INITIAL_PRODUCTS];
  const ids = new Set(products.map((p) => p.id));
  if (ids.size !== products.length) throw new Error("duplicate product ids in the catalog");
  const names = new Set(products.map((p) => p.name.replace(/\s+/g, " ").trim()));
  if (names.size !== products.length) throw new Error("repeated product names in the catalog");
  console.log(`${products.length} products`);

  const raw = (loadEnv().FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (!raw) {
    if (DRY) return console.log("dry run: FIREBASE_SERVICE_ACCOUNT not set, nothing checked against Firestore");
    throw new Error("FIREBASE_SERVICE_ACCOUNT is missing in .env.local");
  }
  const sa = JSON.parse(
    raw.startsWith("{") ? raw : raw.startsWith('"') ? `{${raw}}` : Buffer.from(raw, "base64").toString("utf8")
  );
  const app = initializeApp({
    credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: String(sa.private_key).replace(/\\n/g, "\n") }),
    projectId: sa.project_id,
  });
  const db = getFirestore(app);
  const col = db.collection("inventory");

  const existing = new Set((await col.select().get()).docs.map((d) => d.id));
  const todo = products.filter((p) => OVERWRITE || !existing.has(String(p.id)));
  console.log(`Firestore project ${sa.project_id}: ${existing.size} already there, ${todo.length} to write${DRY ? " (dry run)" : ""}`);
  if (DRY || !todo.length) return;

  for (let i = 0; i < todo.length; i += 400) {
    const batch = db.batch();
    for (const p of todo.slice(i, i + 400)) batch.set(col.doc(String(p.id)), toDoc(p));
    await batch.commit();
    console.log(`  wrote ${Math.min(i + 400, todo.length)} / ${todo.length}`);
  }
  const after = (await col.count().get()).data().count;
  console.log(`done: ${after} products in Firestore`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
