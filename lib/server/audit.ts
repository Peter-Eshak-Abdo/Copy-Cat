/**
 * Change log ("سجل التعديلات"): every change made through the admin API is recorded with who made it
 * and the before/after values, so a staff mistake can be seen and undone.
 *
 * Firestore collection `audit`. Entries expire after 30 days: each has `expireAt`, which a Firestore TTL
 * policy deletes on its own; as a backup this file also deletes expired entries at most once an hour.
 *
 * Doc ids sort newest first (inverted time + random suffix), so the log can be listed, filtered by an
 * equality field and paged without any composite index.
 */
import "server-only";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { COL, getDb } from "@/lib/server/db";

export const AUDIT_RETENTION_DAYS = 30;
const DAY_MS = 86_400_000;
const MAX_TIME = 9_999_999_999_999;

export interface AuditEntry {
  actor: string;
  role: string;
  action: string;
  entity: string;
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
}

/** What /api/admin/audit returns per entry (same shape the activity page always used) */
export interface AuditRow {
  id: string;
  created_at: string;
  actor: string;
  role: string;
  action: string;
  entity: string;
  entity_id: string | null;
  before: unknown;
  after: unknown;
}

export const auditGroup = (entity: string) => entity.split(":")[0];

export function newAuditId(now = Date.now()): string {
  const inverted = String(MAX_TIME - now).padStart(13, "0");
  return `${inverted}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

/** Firestore can't hold nested arrays or `undefined`, so before/after are stored as JSON text */
const toJson = (v: unknown) => (v === undefined || v === null ? null : JSON.stringify(v));
const fromJson = (v: unknown) => {
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

export function auditRowFromDoc(id: string, d: DocumentData): AuditRow {
  const created = d.created_at instanceof Timestamp ? d.created_at.toDate().toISOString() : String(d.created_at ?? "");
  return {
    id,
    created_at: created,
    actor: String(d.actor ?? ""),
    role: String(d.role ?? ""),
    action: String(d.action ?? ""),
    entity: String(d.entity ?? ""),
    entity_id: d.entity_id == null ? null : String(d.entity_id),
    before: fromJson(d.before_json),
    after: fromJson(d.after_json),
  };
}

let lastPurge = 0;

export async function writeAudit(entry: AuditEntry): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const now = Date.now();
    await db
      .collection(COL.audit)
      .doc(newAuditId(now))
      .set({
        actor: entry.actor,
        role: entry.role,
        action: entry.action,
        entity: entry.entity,
        group: auditGroup(entry.entity),
        entity_id: entry.entityId == null ? null : String(entry.entityId),
        before_json: toJson(entry.before),
        after_json: toJson(entry.after),
        created_at: Timestamp.fromMillis(now),
        expireAt: Timestamp.fromMillis(now + AUDIT_RETENTION_DAYS * DAY_MS),
      });
    if (now - lastPurge > 60 * 60 * 1000) {
      lastPurge = now;
      const old = await db.collection(COL.audit).where("expireAt", "<", Timestamp.fromMillis(now)).limit(200).get();
      if (!old.empty) {
        const batch = db.batch();
        old.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
  } catch (err) {
    // The change itself already succeeded; a missing log line must not fail it
    console.error("audit log write failed:", err);
  }
}

