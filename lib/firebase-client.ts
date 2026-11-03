"use client";

/**
 * Firebase in the browser. Only two things use it: Analytics on every page, and the LAN-transfer
 * signaling (lib/lan-p2p.ts), which signs in with a short-lived custom token from /api/admin/lan-room.
 * All shop data goes through the API routes instead; the Firestore rules deny everything else.
 *
 * The web config isn't secret (it ends up in every page anyway); it comes from NEXT_PUBLIC_FIREBASE_* env.
 */
import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";

const config: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null;
  return getApps()[0] ?? initializeApp(config);
}
