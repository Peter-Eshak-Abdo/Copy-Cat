"use client";

/**
 * Direct PC-to-PC file transfer for the shop ("نقل ملفات بين الأجهزة").
 *
 * The two PCs find each other through a small signaling channel (Firestore: `lanRooms/{room}/peers` for
 * "who is online" and `lanRooms/{room}/signals` for WebRTC offers/answers/ICE). Only logged-in staff get
 * the room name and a sign-in token for it (/api/admin/lan-room); the Firestore rules allow nothing else.
 * The file itself goes through an RTCDataChannel straight across the router, encrypted by WebRTC (DTLS),
 * without touching the internet connection or the server. Both sides see live progress.
 */

export interface LanPeer {
  id: string;
  name: string;
  lastSeen: number;
}

export type TransferStatus = "waiting" | "connecting" | "transferring" | "done" | "error";

export interface LanTransfer {
  id: string;
  direction: "in" | "out";
  peerId: string;
  peerName: string;
  name: string;
  size: number;
  type: string;
  bytes: number;
  status: TransferStatus;
  startedAt: number;
  error?: string;
  /** Received file (direction "in", status "done") */
  blob?: Blob;
}

export interface SignalMessage {
  to: string;
  from: string;
  fromName: string;
  sid: string;
  kind: "offer" | "answer" | "ice" | "cancel";
  data?: unknown;
  meta?: { name: string; size: number; type: string };
}

const CHUNK = 64 * 1024;
const HIGH_WATER = 8 * 1024 * 1024;
const LOW_WATER = 1 * 1024 * 1024;
// Every heartbeat is a database write, so it is slow; a PC that closed properly leaves at once ("bye")
const HELLO_MS = 20000;
const PEER_TIMEOUT_MS = 60000;
const CONNECT_TIMEOUT_MS = 20000;
// Same-router PCs connect on host candidates; STUN only helps when the browser hides local IPs (mDNS)
const RTC_CONFIG: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

/**
 * How the PCs reach each other before the direct connection exists. The Firestore one is below; tests
 * pass an in-memory stand-in.
 */
export interface SignalTransport {
  connect(selfId: string, handlers: {
    onPeer: (p: { id: string; name: string }) => void;
    onPeerGone: (id: string) => void;
    onSignal: (msg: SignalMessage) => void;
    onStatus: (connected: boolean) => void;
  }): void;
  /** "I'm here" (also the heartbeat) */
  announce(self: { id: string; name: string }): void;
  leave(selfId: string): void;
  send(msg: SignalMessage): void;
  close(): void;
}

export class LanP2P {
  readonly selfId = newId();
  private started = false;
  private peers = new Map<string, LanPeer>();
  private transfers = new Map<string, LanTransfer>();
  private connections = new Map<string, RTCPeerConnection>();
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();
  private helloTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly opts: {
      transport: SignalTransport;
      selfName: () => string;
      onPeers: (peers: LanPeer[]) => void;
      onTransfer: (t: LanTransfer) => void;
      onStatus: (connected: boolean) => void;
    }
  ) {}

  start() {
    this.started = true;
    this.opts.transport.connect(this.selfId, {
      onPeer: (p) => this.onHello(p),
      onPeerGone: (id) => {
        if (this.peers.delete(id)) this.emitPeers();
      },
      onSignal: (msg) => this.onSignal(msg),
      onStatus: (ok) => {
        this.opts.onStatus(ok);
        if (ok) this.sayHello();
      },
    });
    this.helloTimer = setInterval(() => {
      this.sayHello();
      const now = Date.now();
      let changed = false;
      for (const [id, p] of this.peers) {
        if (now - p.lastSeen > PEER_TIMEOUT_MS) {
          this.peers.delete(id);
          changed = true;
        }
      }
      if (changed) this.emitPeers();
    }, HELLO_MS);
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    if (this.helloTimer) clearInterval(this.helloTimer);
    this.opts.transport.leave(this.selfId);
    for (const pc of this.connections.values()) pc.close();
    this.connections.clear();
    this.opts.transport.close();
  }

  /** Re-announce right away (e.g. after the device name changed) */
  announce() {
    this.sayHello();
  }

  async sendFile(peerId: string, file: File): Promise<void> {
    const peer = this.peers.get(peerId);
    const sid = newId();
    const t: LanTransfer = {
      id: sid,
      direction: "out",
      peerId,
      peerName: peer?.name || "جهاز",
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      bytes: 0,
      status: "connecting",
      startedAt: Date.now(),
    };
    this.update(t);

    const pc = this.newConnection(sid, peerId);
    const dc = pc.createDataChannel("file", { ordered: true });
    dc.binaryType = "arraybuffer";
    dc.bufferedAmountLowThreshold = LOW_WATER;

    const timeout = setTimeout(() => {
      if (t.status === "connecting") this.fail(t, "مقدرش يوصل للجهاز التاني مباشرة. اتأكد إنهم على نفس الراوتر.");
    }, CONNECT_TIMEOUT_MS);

    dc.onopen = async () => {
      clearTimeout(timeout);
      this.update({ ...t, status: "transferring" });
      try {
        let offset = 0;
        while (offset < file.size) {
          if (dc.readyState !== "open") throw new Error("closed");
          if (dc.bufferedAmount > HIGH_WATER) {
            await new Promise<void>((resolve) => {
              dc.onbufferedamountlow = () => {
                dc.onbufferedamountlow = null;
                resolve();
              };
            });
          }
          const buf = await file.slice(offset, offset + CHUNK).arrayBuffer();
          dc.send(buf);
          offset += buf.byteLength;
          t.bytes = offset;
          this.update({ ...t, status: "transferring" });
        }
      } catch {
        this.fail(t, "الاتصال اتقطع أثناء الإرسال.");
      }
    };
    dc.onmessage = (ev) => {
      if (ev.data === "ack") {
        this.update({ ...t, bytes: file.size, status: "done" });
        setTimeout(() => this.closeConnection(sid), 500);
      }
    };
    dc.onerror = () => this.fail(t, "حصلت مشكلة في الاتصال.");

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.signal({
      to: peerId,
      sid,
      kind: "offer",
      data: pc.localDescription?.toJSON(),
      meta: { name: file.name, size: file.size, type: t.type },
    });
  }

  // ---- internals ----

  private sayHello() {
    if (this.started) this.opts.transport.announce({ id: this.selfId, name: this.opts.selfName().slice(0, 60) });
  }

  private onHello(p: { id: string; name: string }) {
    if (!p?.id || p.id === this.selfId) return;
    this.peers.set(p.id, { id: p.id, name: String(p.name || "جهاز").slice(0, 60), lastSeen: Date.now() });
    this.emitPeers();
  }

  private emitPeers() {
    this.opts.onPeers([...this.peers.values()].sort((a, b) => a.name.localeCompare(b.name)));
  }

  private signal(msg: Omit<SignalMessage, "from" | "fromName">) {
    if (this.started) this.opts.transport.send({ ...msg, from: this.selfId, fromName: this.opts.selfName().slice(0, 60) });
  }

  private newConnection(sid: string, peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.connections.set(sid, pc);
    pc.onicecandidate = (ev) => {
      if (ev.candidate) this.signal({ to: peerId, sid, kind: "ice", data: ev.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      const t = this.transfers.get(sid);
      if (t && (pc.connectionState === "failed" || pc.connectionState === "disconnected") && t.status !== "done") {
        this.fail(t, "الاتصال بالجهاز التاني اتقطع.");
      }
    };
    return pc;
  }

  private closeConnection(sid: string) {
    this.connections.get(sid)?.close();
    this.connections.delete(sid);
    this.pendingIce.delete(sid);
  }

  private async onSignal(msg: SignalMessage) {
    if (!msg || msg.to !== this.selfId || !msg.sid) return;
    try {
      if (msg.kind === "offer" && msg.meta) {
        await this.acceptOffer(msg);
      } else if (msg.kind === "answer") {
        const pc = this.connections.get(msg.sid);
        if (pc) {
          await pc.setRemoteDescription(msg.data as RTCSessionDescriptionInit);
          await this.flushIce(msg.sid, pc);
        }
      } else if (msg.kind === "ice") {
        const pc = this.connections.get(msg.sid);
        if (pc?.remoteDescription) await pc.addIceCandidate(msg.data as RTCIceCandidateInit);
        else this.pendingIce.set(msg.sid, [...(this.pendingIce.get(msg.sid) || []), msg.data as RTCIceCandidateInit]);
      }
    } catch (err) {
      console.warn("LAN signal error", err);
    }
  }

  private async flushIce(sid: string, pc: RTCPeerConnection) {
    for (const c of this.pendingIce.get(sid) || []) await pc.addIceCandidate(c).catch(() => {});
    this.pendingIce.delete(sid);
  }

  private async acceptOffer(msg: SignalMessage) {
    const meta = msg.meta!;
    const t: LanTransfer = {
      id: msg.sid,
      direction: "in",
      peerId: msg.from,
      peerName: String(msg.fromName || "جهاز").slice(0, 60),
      name: String(meta.name).slice(0, 200),
      size: Number(meta.size) || 0,
      type: String(meta.type || "application/octet-stream").slice(0, 100),
      bytes: 0,
      status: "connecting",
      startedAt: Date.now(),
    };
    this.update(t);

    const pc = this.newConnection(msg.sid, msg.from);
    const parts: ArrayBuffer[] = [];
    pc.ondatachannel = (ev) => {
      const dc = ev.channel;
      dc.binaryType = "arraybuffer";
      dc.onopen = () => this.update({ ...t, status: "transferring" });
      dc.onmessage = (e) => {
        if (!(e.data instanceof ArrayBuffer)) return;
        parts.push(e.data);
        t.bytes += e.data.byteLength;
        if (t.bytes >= t.size) {
          const blob = new Blob(parts, { type: t.type });
          parts.length = 0;
          this.update({ ...t, status: "done", blob });
          try {
            dc.send("ack");
          } catch {}
          setTimeout(() => this.closeConnection(msg.sid), 1500);
        } else {
          this.update({ ...t, status: "transferring" });
        }
      };
    };

    await pc.setRemoteDescription(msg.data as RTCSessionDescriptionInit);
    await this.flushIce(msg.sid, pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.signal({ to: msg.from, sid: msg.sid, kind: "answer", data: pc.localDescription?.toJSON() });
  }

  private fail(t: LanTransfer, error: string) {
    const current = this.transfers.get(t.id);
    if (current?.status === "done" || current?.status === "error") return;
    this.update({ ...(current || t), status: "error", error });
    this.closeConnection(t.id);
  }

  private update(t: LanTransfer) {
    this.transfers.set(t.id, t);
    this.opts.onTransfer(t);
  }
}
