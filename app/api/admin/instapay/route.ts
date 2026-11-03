import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { COL, getDb, toPlain, DB_NOT_CONFIGURED } from "@/lib/server/db";
import { writeAudit } from "@/lib/server/audit";
import { bad, noStore, readJson, requireSession, str } from "@/lib/server/route-helpers";

/**
 * InstaPay transfers, shared by every shop device (Firestore collection `instapay`, doc id = uuid).
 *   GET    → list (staff + admin)
 *   POST   → record a transfer (staff + admin)
 *   PATCH  → { id } confirm the money arrived (admin only)
 *   DELETE → ?id= remove a record (admin only)
 */
const UUID = /^[0-9a-f-]{36}$/;

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof NextResponse) return session;
  const db = getDb();
  if (!db) return NextResponse.json(DB_NOT_CONFIGURED, { status: 503 });

  try {
    const snap = await db.collection(COL.instapay).orderBy("created_at", "desc").limit(500).get();
    return NextResponse.json({ records: snap.docs.map((d) => toPlain(d.data())) }, noStore);
  } catch (err) {
    console.error("instapay list failed:", err);
    return bad("مقدرناش نجيب التحويلات.", 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof NextResponse) return session;
  const db = getDb();
  if (!db) return NextResponse.json(DB_NOT_CONFIGURED, { status: 503 });

  const body = await readJson<Record<string, unknown>>(req);
  const customerName = str(body?.customerName, 120);
  const amount = Number(body?.amount);
  if (!customerName) return bad("اكتب اسم الزبون.");
  if (!Number.isFinite(amount) || amount <= 0 || amount >= 1_000_000) return bad("المبلغ غلط.");

  const id = crypto.randomUUID();
  const row = {
    id,
    customer_name: customerName,
    phone: str(body?.phone, 30) || null,
    amount: Math.round(amount * 100) / 100,
    sender_account: str(body?.senderAccount, 120) || null,
    notes: str(body?.notes, 1000) || null,
    status: "pending",
    created_by: session.email,
    created_at: Timestamp.now(),
    confirmed_by: null,
    confirmed_at: null,
  };
  try {
    await db.collection(COL.instapay).doc(id).set(row);
  } catch (err) {
    console.error("instapay create failed:", err);
    return bad("التحويل متسجلش.", 500);
  }
  const record = toPlain(row);
  await writeAudit({ actor: session.email, role: session.role, action: "create", entity: "instapay", entityId: id, after: record });
  return NextResponse.json({ record });
}

export async function PATCH(req: NextRequest) {
  const session = await requireSession(req, "admin");
  if (session instanceof NextResponse) return session;
  const db = getDb();
  if (!db) return NextResponse.json(DB_NOT_CONFIGURED, { status: 503 });

  const body = await readJson<{ id?: string }>(req);
  const id = str(body?.id, 64);
  if (!UUID.test(id)) return bad("رقم التحويل غلط.");

  const ref = db.collection(COL.instapay).doc(id);
  let record: Record<string, unknown> | null = null;
  try {
    record = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.get("status") !== "pending") return null;
      const patch = { status: "confirmed", confirmed_by: session.email, confirmed_at: Timestamp.now() };
      tx.update(ref, patch);
      return toPlain({ ...snap.data(), ...patch });
    });
  } catch (err) {
    console.error("instapay confirm failed:", err);
    return bad("التحويل متأكدش.", 500);
  }
  if (!record) return bad("التحويل مش موجود أو اتأكد قبل كده.", 404);
  await writeAudit({ actor: session.email, role: session.role, action: "confirm", entity: "instapay", entityId: id, after: record });
  return NextResponse.json({ record });
}

export async function DELETE(req: NextRequest) {
  const session = await requireSession(req, "admin");
  if (session instanceof NextResponse) return session;
  const db = getDb();
  if (!db) return NextResponse.json(DB_NOT_CONFIGURED, { status: 503 });

  const id = req.nextUrl.searchParams.get("id") || "";
  if (!UUID.test(id)) return bad("رقم التحويل غلط.");
  const ref = db.collection(COL.instapay).doc(id);
  try {
    const before = toPlain((await ref.get()).data());
    await ref.delete();
    await writeAudit({ actor: session.email, role: session.role, action: "delete", entity: "instapay", entityId: id, before });
  } catch (err) {
    console.error("instapay delete failed:", err);
    return bad("متمسحش.", 500);
  }
  return NextResponse.json({ success: true });
}
