"use client";

/**
 * Client side of the shared admin data (/api/admin/settings, /api/admin/instapay, /api/admin/inventory).
 * Every value is also cached in localStorage: the page paints instantly from the cache, then the server
 * copy replaces it. When the database is not connected (503) the page keeps working on this device only
 * and says so.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type SyncState = "loading" | "cloud" | "local" | "error";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: init?.body ? { "Content-Type": "application/json", ...(init?.headers || {}) } : init?.headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.error || `HTTP ${res.status}`, res.status);
  return data as T;
}

function readLocal<T>(localKey: string): T | undefined {
  try {
    const raw = localStorage.getItem(localKey);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function writeLocal(localKey: string, value: unknown) {
  try {
    localStorage.setItem(localKey, JSON.stringify(value));
  } catch {}
}

/**
 * A setting shared by every shop device (calculator prices, shortcuts...).
 * `localKey` is the old per-device localStorage key: whatever a device already saved there is uploaded
 * the first time the server has nothing for this key, so nobody loses their custom prices.
 */
export function useSyncedSetting<T>(key: string, localKey: string, fallback: T, isValid: (v: unknown) => v is T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return fallback;
    const local = readLocal<unknown>(localKey);
    return isValid(local) ? local : fallback;
  });
  const [state, setState] = useState<SyncState>("loading");
  const validRef = useRef(isValid);
  const fallbackRef = useRef(fallback);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/settings?key=${encodeURIComponent(key)}`, { cache: "no-store" });
        if (!alive) return;
        if (res.status === 503) return setState("local");
        if (res.status === 404) {
          // First device to open this: upload its saved copy (or the defaults)
          const local = readLocal<unknown>(localKey);
          const seed = validRef.current(local) ? local : fallbackRef.current;
          await api("/api/admin/settings", { method: "PUT", body: JSON.stringify({ key, value: seed }) }).catch(() => {});
          return alive && setState("cloud");
        }
        if (!res.ok) return setState("error");
        const data = await res.json();
        if (validRef.current(data.value)) {
          setValue(data.value);
          writeLocal(localKey, data.value);
        }
        setState("cloud");
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [key, localKey]);

  /** Saves locally right away and to the server in the background; resolves false if the server refused */
  const save = useCallback(
    async (next: T): Promise<boolean> => {
      setValue(next);
      writeLocal(localKey, next);
      if (state === "local") return true;
      try {
        await api("/api/admin/settings", { method: "PUT", body: JSON.stringify({ key, value: next }) });
        setState("cloud");
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 503) {
          setState("local");
          return true;
        }
        setState("error");
        return false;
      }
    },
    [key, localKey, state]
  );

  return [value, save, state] as const;
}

/** Small "saved on every device / this device only" badge text */
export function syncLabel(state: SyncState): { text: string; tone: "ok" | "warn" | "muted" } {
  if (state === "cloud") return { text: "متزامن على كل الأجهزة", tone: "ok" };
  if (state === "local") return { text: "محفوظ على الجهاز ده بس", tone: "warn" };
  if (state === "error") return { text: "مشكلة في الحفظ على السيرفر", tone: "warn" };
  return { text: "بنحمّل...", tone: "muted" };
}
