import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { COL, getDb, DB_NOT_CONFIGURED } from "@/lib/server/db";
import { writeAudit } from "@/lib/server/audit";
import { bad, noStore, readJson, requireSession } from "@/lib/server/route-helpers";
import { cleanProduct, productTooBig, type ProductRow } from "@/lib/server/products";
import { getAllProducts, invalidateProducts } from "@/lib/server/catalog";

/**
 * Products (with cost and wholesale prices, which the customer page never gets).
 * Firestore collection `inventory`, doc id = the product number.
 *   GET    → all products
 *   PUT    { item } → create or update one product (staff + admin; logged with before/after)
 *   DELETE ?id=     → remove one product (logged, so it can be restored from the change log)
 */
export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof NextResponse) return session;
  if (!getDb()) return NextResponse.json(DB_NOT_CONFIGURED, { status: 503 });
  try {
    return NextResponse.json({ items: await getAllProducts() }, noStore);
  } catch (err) {
    console.error("inventory list failed:", err);
    return bad("مقدرناش نجيب المنتجات.", 500);
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof NextResponse) return session;
  const db = getDb();
  if (!db) return NextResponse.json(DB_NOT_CONFIGURED, { status: 503 });

  // Up to 9 images; the total is checked below
  const body = await readJson<{ item?: Record<string, unknown> }>(req, 4 * 1024 * 1024);
  const item = body?.item ? cleanProduct(body.item) : null;
  if (!item) return bad("بيانات المنتج ناقصة أو غلط.");
  if (productTooBig(item)) return bad("صور المنتج كبيرة أوي. قلّل عدد الصور أو صغّرها.", 413);

  const ref = db.collection(COL.inventory).doc(String(item.id));
  let before: ProductRow | null = null;
  try {
    const snap = await ref.get();
    before = snap.exists ? cleanProduct(snap.data()!) : null;
    await ref.set({ ...item, updated_at: Timestamp.now(), updated_by: session.email });
  } catch (err) {
    console.error("inventory write failed:", err);
    return bad("المنتج متحفظش.", 500);
  }
  invalidateProducts();
  await writeAudit({
    actor: session.email,
    role: session.role,
    action: before ? "update" : "create",
    entity: "inventory",
    entityId: item.id,
    before,
    after: item,
  });
  return NextResponse.json({ item });
}

export async function DELETE(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof NextResponse) return session;
  const db = getDb();
  if (!db) return NextResponse.json(DB_NOT_CONFIGURED, { status: 503 });

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) return bad("رقم المنتج غلط.");
  const ref = db.collection(COL.inventory).doc(String(id));
  let before: ProductRow | null = null;
  try {
    const snap = await ref.get();
    if (!snap.exists) return bad("المنتج مش موجود.", 404);
    before = cleanProduct(snap.data()!);
    await ref.delete();
  } catch (err) {
    console.error("inventory delete failed:", err);
    return bad("متمسحش.", 500);
  }
  invalidateProducts();
  await writeAudit({ actor: session.email, role: session.role, action: "delete", entity: "inventory", entityId: id, before });
  return NextResponse.json({ success: true });
}
