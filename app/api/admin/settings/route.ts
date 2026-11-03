import { NextRequest, NextResponse } from "next/server";
import { getDb, DB_NOT_CONFIGURED } from "@/lib/server/db";
import { writeAudit } from "@/lib/server/audit";
import { readSetting, writeSetting } from "@/lib/server/settings";
import { bad, noStore, readJson, requireSession } from "@/lib/server/route-helpers";

/**
 * Shared settings, one JSON value per key, the same on every shop device.
 *   GET ?key=calculator.prices → { value }  (404 when never saved: the page uses its defaults)
 *   PUT { key, value }          → save (staff + admin); the old value goes to the change log
 */
const ALLOWED_KEYS = new Set([
  "calculator.paper",
  "calculator.addons",
  "shortcuts.list",
  "storefront.banner",
  "dashboard.tools-order",
]);
const MAX_VALUE_BYTES = 200 * 1024;

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof NextResponse) return session;
  const db = getDb();
  if (!db) return NextResponse.json(DB_NOT_CONFIGURED, { status: 503 });

  const key = req.nextUrl.searchParams.get("key") || "";
  if (!ALLOWED_KEYS.has(key)) return bad("مفتاح غلط.");
  try {
    const row = await readSetting(db, key);
    if (!row) return NextResponse.json({ value: null }, { status: 404, ...noStore });
    return NextResponse.json(row, noStore);
  } catch (err) {
    console.error("settings read failed:", err);
    return bad("مقدرناش نجيب الإعدادات.", 500);
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof NextResponse) return session;
  const db = getDb();
  if (!db) return NextResponse.json(DB_NOT_CONFIGURED, { status: 503 });

  const body = await readJson<{ key?: string; value?: unknown }>(req, MAX_VALUE_BYTES + 1024);
  const key = body?.key || "";
  if (!ALLOWED_KEYS.has(key)) return bad("مفتاح غلط.");
  if (body?.value === undefined || body.value === null) return bad("مفيش قيمة.");
  if (JSON.stringify(body.value).length > MAX_VALUE_BYTES) return bad("البيانات كبيرة جداً.", 413);

  let before: unknown = null;
  try {
    before = (await readSetting(db, key))?.value ?? null;
    await writeSetting(db, key, body.value, session.email);
  } catch (err) {
    console.error("settings write failed:", err);
    return bad("متحفظش.", 500);
  }

  await writeAudit({
    actor: session.email,
    role: session.role,
    action: "update",
    entity: `settings:${key}`,
    entityId: key,
    before,
    after: body.value,
  });
  return NextResponse.json({ success: true });
}
