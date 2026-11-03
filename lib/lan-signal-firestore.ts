"use client";

/**
 * Firestore signaling for the LAN transfer (lib/lan-p2p.ts).
 *
 *   lanRooms/{room}/peers/{peerId}   one doc per open transfer page, rewritten as a heartbeat
 *   lanRooms/{room}/signals/{auto}   WebRTC offer / answer / ICE addressed to one peer; the receiver
 *                                    deletes it once handled
 *
 * The browser signs in with a custom token from /api/admin/lan-room whose claims (lan, lanRoom) are what
 * firestore.rules checks. Both collections also carry `expireAt` for a Firestore TTL policy, so leftovers
 * from a PC that was switched off disappear on their own.
 */
// The transfer page imports this file lazily, so Firebase Auth/Firestore only load there
import * as authMod from "firebase/auth";
import * as fs from "firebase/firestore";
import type { SignalMessage, SignalTransport } from "@/lib/lan-p2p";
import { getFirebaseApp } from "@/lib/firebase-client";

const STALE_MS = 60_000;
const TTL_MS = 60 * 60 * 1000;

export async function createFirestoreTransport(room: string, token: string): Promise<SignalTransport> {
  const app = getFirebaseApp();
  if (!app) throw new Error("firebase_not_configured");
  let auth;
  try {
    // Kept in memory only: the token is per page visit, nothing is left in the browser
    auth = authMod.initializeAuth(app, { persistence: authMod.inMemoryPersistence });
  } catch {
    auth = authMod.getAuth(app); // already initialised (page opened again without a reload)
  }
  await authMod.signInWithCustomToken(auth, token);

  const db = fs.getFirestore(app);
  const peersCol = fs.collection(db, "lanRooms", room, "peers");
  const signalsCol = fs.collection(db, "lanRooms", room, "signals");
  const unsubs: (() => void)[] = [];
  const expireAt = () => fs.Timestamp.fromMillis(Date.now() + TTL_MS);
  const warn = (what: string) => (err: unknown) => console.warn(`LAN ${what} failed`, err);

  return {
    connect(selfId, h) {
      let first = true;
      unsubs.push(
        fs.onSnapshot(
          peersCol,
          (snap) => {
            if (first) {
              first = false;
              h.onStatus(true);
            }
            for (const ch of snap.docChanges()) {
              if (ch.doc.id === selfId) continue;
              if (ch.type === "removed") {
                h.onPeerGone(ch.doc.id);
                continue;
              }
              const d = ch.doc.data();
              const seen = d.seenAt instanceof fs.Timestamp ? d.seenAt.toMillis() : 0;
              // A PC that was switched off without leaving: its last heartbeat is old
              if (Date.now() - seen > STALE_MS) continue;
              h.onPeer({ id: ch.doc.id, name: String(d.name || "جهاز") });
            }
          },
          (err) => {
            console.warn("LAN peers listener", err);
            h.onStatus(false);
          }
        )
      );
      unsubs.push(
        fs.onSnapshot(
          fs.query(signalsCol, fs.where("to", "==", selfId)),
          (snap) => {
            for (const ch of snap.docChanges()) {
              if (ch.type !== "added") continue;
              const d = ch.doc.data();
              let data: unknown = undefined;
              try {
                data = d.data_json ? JSON.parse(String(d.data_json)) : undefined;
              } catch {}
              h.onSignal({
                to: String(d.to),
                from: String(d.from),
                fromName: String(d.fromName || ""),
                sid: String(d.sid),
                kind: d.kind,
                data,
                meta: d.meta ?? undefined,
              });
              fs.deleteDoc(ch.doc.ref).catch(() => {});
            }
          },
          (err) => console.warn("LAN signals listener", err)
        )
      );
    },
    announce(self) {
      fs.setDoc(fs.doc(peersCol, self.id), { name: self.name, seenAt: fs.serverTimestamp(), expireAt: expireAt() }).catch(
        warn("announce")
      );
    },
    leave(selfId) {
      fs.deleteDoc(fs.doc(peersCol, selfId)).catch(() => {});
    },
    send(msg: SignalMessage) {
      fs.addDoc(signalsCol, {
        to: msg.to,
        from: msg.from,
        fromName: msg.fromName,
        sid: msg.sid,
        kind: msg.kind,
        data_json: msg.data === undefined ? null : JSON.stringify(msg.data),
        meta: msg.meta ?? null,
        createdAt: fs.serverTimestamp(),
        expireAt: expireAt(),
      }).catch(warn("signal"));
    },
    close() {
      // No signOut: the "leave" delete above may still be in flight; the session is in memory only anyway
      for (const u of unsubs.splice(0)) u();
    },
  };
}
