/**
 * Server-only Firestore (firebase-admin, full access; the security rules don't apply to it). Import only
 * from route handlers that already checked the login with requireSession — never from a client component.
 *
 * Env: FIREBASE_SERVICE_ACCOUNT = the service-account JSON from Firebase Console → Project settings →
 * Service accounts → Generate new private key, either pasted as-is or base64-encoded. Without it the
 * routes answer 503 and the pages fall back to this device's copy.
 */
import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

let app: App | null | undefined;

function parseServiceAccount(): ServiceAccount | null {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (!raw) return null;
  try {
    // Pasted as-is, without its outer { } (an easy copy slip), or base64-encoded
    const json = raw.startsWith("{")
      ? raw
      : raw.startsWith('"')
        ? `{${raw}}`
        : Buffer.from(raw, "base64").toString("utf8");
    const sa = JSON.parse(json) as Partial<ServiceAccount>;
    if (!sa.project_id || !sa.client_email || !sa.private_key) return null;
    // Env editors sometimes keep "\n" as two characters
    return { project_id: sa.project_id, client_email: sa.client_email, private_key: sa.private_key.replace(/\\n/g, "\n") };
  } catch {
    console.error("FIREBASE_SERVICE_ACCOUNT is not valid JSON (or base64 JSON)");
    return null;
  }
}

function getApp(): App | null {
  if (app !== undefined) return app;
  const sa = parseServiceAccount();
  if (!sa) return (app = null);
  app =
    getApps().find((a) => a.name === "copycat") ??
    initializeApp(
      { credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }), projectId: sa.project_id },
      "copycat"
    );
  return app;
}

let db: Firestore | null | undefined;

export function getDb(): Firestore | null {
  if (db !== undefined) return db;
  const a = getApp();
  if (!a) return (db = null);
  db = getFirestore(a);
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

/** For minting the LAN-transfer custom tokens */
export function getAdminAuth(): Auth | null {
  const a = getApp();
  return a ? getAuth(a) : null;
}

export const DB_NOT_CONFIGURED = {
  error: "قاعدة البيانات مش متوصلة (FIREBASE_SERVICE_ACCOUNT). البيانات محفوظة على الجهاز ده بس.",
  code: "db_not_configured",
};

/** Collection names, in one place */
export const COL = {
  inventory: "inventory",
  settings: "settings",
  instapay: "instapay",
  audit: "audit",
} as const;

/** Firestore Timestamps → ISO strings, so the JSON the pages get keeps the old shape */
export function toPlain<T = Record<string, unknown>>(data: DocumentData | undefined): T | null {
  if (!data) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v && typeof v === "object" && typeof (v as { toDate?: unknown }).toDate === "function" ? (v as { toDate: () => Date }).toDate().toISOString() : v;
  }
  return out as T;
}
