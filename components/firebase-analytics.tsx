"use client";

import { useEffect } from "react";

/**
 * Firebase (Google) Analytics: page views and visitors. Loaded after the page is interactive, only on the
 * real site (not localhost) and only in browsers that support it.
 */
export function FirebaseAnalytics() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) return;
    if (/^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname)) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ getFirebaseApp }, { getAnalytics, isSupported }] = await Promise.all([
          import("@/lib/firebase-client"),
          import("firebase/analytics"),
        ]);
        const app = getFirebaseApp();
        if (!cancelled && app && (await isSupported())) getAnalytics(app);
      } catch {
        // Blocked by an ad blocker or offline: the site works the same
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
