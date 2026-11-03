/**
 * Shared settings (Firestore collection `settings`, doc id = the key). The value is stored as JSON text
 * because settings like the calculator prices can contain nested arrays, which Firestore can't hold.
 */
import "server-only";
import { revalidateTag } from "next/cache";
import { cachedQuery } from "@/lib/server/cache";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { COL, getDb } from "@/lib/server/db";

export const BANNER_KEY = "storefront.banner";
const BANNER_TAG = "storefront-banner";

export interface SettingRow {
  value: unknown;
  updated_at: string | null;
  updated_by: string | null;
}

export async function readSetting(db: Firestore, key: string): Promise<SettingRow | null> {
  const snap = await db.collection(COL.settings).doc(key).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  let value: unknown = null;
  try {
    value = JSON.parse(String(d.value_json));
  } catch {
    return null;
  }
  return {
    value,
    updated_at: d.updated_at instanceof Timestamp ? d.updated_at.toDate().toISOString() : null,
    updated_by: d.updated_by ?? null,
  };
}

export async function writeSetting(db: Firestore, key: string, value: unknown, by: string): Promise<void> {
  const ref = db.collection(COL.settings).doc(key);
  if (value === null) await ref.delete();
  else await ref.set({ key, value_json: JSON.stringify(value), updated_by: by, updated_at: Timestamp.now() });
  if (key === BANNER_KEY) {
    try {
      revalidateTag(BANNER_TAG, { expire: 0 });
    } catch {}
  }
}

/** The customer page's announcement line, cached until it changes */
export const getBannerText = cachedQuery(
  async (): Promise<string | null> => {
    const db = getDb();
    if (!db) throw new Error("db_not_configured");
    const row = await readSetting(db, BANNER_KEY);
    return typeof row?.value === "string" ? row.value.slice(0, 300) : null;
  },
  "storefront-banner-v1",
  { tags: [BANNER_TAG], revalidate: 3600 }
);
