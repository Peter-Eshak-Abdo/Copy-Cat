import { NextRequest, NextResponse } from "next/server";
import { FieldPath, Timestamp } from "firebase-admin/firestore";
import { COL, getDb, DB_NOT_CONFIGURED } from "@/lib/server/db";
import { auditRowFromDoc, writeAudit } from "@/lib/server/audit";
import { bad, noStore, readJson, requireSession } from "@/lib/server/route-helpers";
import { cleanProduct, productTooBig } from "@/lib/server/products";
import { invalidateProducts } from "@/lib/server/catalog";
import { writeSetting } from "@/lib/server/settings";

/**
 * Change log for the engineer (admin only).
 *   GET  ?entity=inventory&actor=...&before=<id>  → newest first, 50 per page, last 30 days
 *   POST { id } → undo that change (products and settings): puts the "before" value back
 */
const PAGE = 50;
const AUDIT_ID = /^[0-9]{13}-[0-9a-f]{8}$/;

export async function GET(req: NextRequest) {
  const session = await requireSession(req, "admin");
  if (session instanceof NextResponse) return session;
  const db = getDb();
  if (!db) return NextResponse.json(DB_NOT_CONFIGURED, { status: 503 });

  const sp = req.nextUrl.searchParams;
  // Doc ids sort newest first, so ordering by id needs no composite index next to equality filters
  let q = db.collection(COL.audit).orderBy(FieldPath.documentId());
  const entity = sp.get("entity");
  if (entity && /^[a-z._-]{1,64}$/.test(entity)) q = q.where("group", "==", entity.split(":")[0]);
  const actor = sp.get("actor");
  if (actor && actor.length < 200) q = q.where("actor", "==", actor);
  const beforeId = sp.get("before");
  if (beforeId && AUDIT_ID.test(beforeId)) q = q.startAfter(beforeId);

  try {
    const snap = await q.limit(PAGE).get();
    const now = Date.now();
    const entries = snap.docs
      .filter((d) => { const exp = d.get("expireAt"); return !(exp instanceof Timestamp) || exp.toMillis() > now; })
      .map((d) => auditRowFromDoc(d.id, d.data()));
    // `next`: cursor for the following page (null on the last one)
    return NextResponse.json({ entries, next: snap.size === PAGE ? snap.docs[snap.size - 1].id : null }, noStore);
  } catch (err) {
    console.error("audit list failed:", err);
    return bad("مقدرناش نجيب السجل.", 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req, "admin");
  if (session instanceof NextResponse) return session;
  const db = getDb();
  if (!db) return NextResponse.json(DB_NOT_CONFIGURED, { status: 503 });

  const body = await readJson<{ id?: string }>(req);
  const id = String(body?.id ?? "");
  if (!AUDIT_ID.test(id)) return bad("رقم التعديل غلط.");

  try {
    const snap = await db.collection(COL.audit).doc(id).get();
    if (!snap.exists) return bad("التعديل مش موجود (ممكن يكون عدى عليه 30 يوم).", 404);
    const entry = auditRowFromDoc(snap.id, snap.data()!);

    if (entry.entity === "inventory") {
      const ref = db.collection(COL.inventory).doc(String(Number(entry.entity_id)));
      if (entry.action === "create") {
        await ref.delete();
      } else if (entry.before) {
        const restored = cleanProduct(entry.before as Record<string, unknown>);
        if (!restored || productTooBig(restored)) return bad("مقدرناش نرجّع التعديل ده.");
        await ref.set({ ...restored, updated_at: Timestamp.now(), updated_by: session.email });
      } else {
        return bad("مفيش قيمة قديمة نرجعلها.");
      }
      invalidateProducts();
    } else if (entry.entity.startsWith("settings:")) {
      await writeSetting(db, String(entry.entity_id), entry.before ?? null, session.email);
    } else {
      return bad("التعديل ده مينفعش يترجع من هنا.");
    }

    await writeAudit({
      actor: session.email,
      role: session.role,
      action: "revert",
      entity: entry.entity,
      entityId: entry.entity_id,
      before: entry.after,
      after: entry.before,
    });
  } catch (err) {
    console.error("audit revert failed:", err);
    return bad("مرجعش.", 500);
  }
  return NextResponse.json({ success: true });
}
