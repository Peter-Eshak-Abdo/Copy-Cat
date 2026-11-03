"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { saveAs } from "file-saver";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ChevronDown,
  Download,
  Laptop,
  Loader2,
  MonitorSmartphone,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { LanP2P, type LanPeer, type LanTransfer } from "@/lib/lan-p2p";

const NAME_KEY = "copycat_device_name";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} بايت`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} ك.ب`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1048576).toFixed(1)} م.ب`;
  return `${(n / 1073741824).toFixed(2)} ج.ب`;
}

function speedText(t: LanTransfer): string {
  const secs = (Date.now() - t.startedAt) / 1000;
  if (secs < 0.5 || t.bytes === 0) return "";
  return `${formatBytes(t.bytes / secs)}/ث`;
}

interface RelayedFile {
  id: string;
  name: string;
  size: number;
  sender: string;
  timestamp: number;
}

export default function LanTransferPage() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const relayInputRef = useRef<HTMLInputElement>(null);
  const p2pRef = useRef<LanP2P | null>(null);

  const [deviceName, setDeviceName] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const saved = localStorage.getItem(NAME_KEY);
      if (saved?.trim()) return saved;
      const fresh = `جهاز ${Math.floor(100 + Math.random() * 900)}`;
      localStorage.setItem(NAME_KEY, fresh);
      return fresh;
    } catch {
      return "جهاز";
    }
  });
  const nameRef = useRef(deviceName);
  useEffect(() => {
    nameRef.current = deviceName;
  }, [deviceName]);

  const [mode, setMode] = useState<"loading" | "p2p" | "relay-only">("loading");
  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState<LanPeer[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<LanTransfer[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const [showRelay, setShowRelay] = useState(false);
  const [relayFiles, setRelayFiles] = useState<RelayedFile[]>([]);
  const [relayProgress, setRelayProgress] = useState<number | null>(null);
  const [relayMax, setRelayMax] = useState(4 * 1024 * 1024);

  // Progress events arrive per 64 KB chunk: batch them into one render per frame
  const pending = useRef(new Map<string, LanTransfer>());
  const frame = useRef<number | null>(null);
  const onTransfer = useCallback(
    (t: LanTransfer) => {
      pending.current.set(t.id, t);
      if (t.direction === "in" && t.status === "done" && t.blob) {
        saveAs(t.blob, t.name);
        toast.success("الملف وصل", `${t.name} من ${t.peerName}`);
      }
      if (t.status === "error") toast.error("الملف موصلش", t.error || "");
      if (t.direction === "in" && t.status === "connecting") toast.info("ملف جاي", `${t.peerName} بيبعت ${t.name}`);
      if (frame.current == null) {
        frame.current = requestAnimationFrame(() => {
          frame.current = null;
          const batch = new Map(pending.current);
          pending.current.clear();
          setTransfers((prev) => {
            const map = new Map(prev.map((x) => [x.id, x]));
            for (const [id, x] of batch) map.set(id, x);
            return [...map.values()].sort((a, b) => b.startedAt - a.startedAt).slice(0, 30);
          });
        });
      }
    },
    [toast]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/lan-room", { cache: "no-store" });
        const cfg = await res.json();
        if (cancelled) return;
        if (!res.ok || !cfg.realtime) {
          setMode("relay-only");
          setShowRelay(true);
          return;
        }
        const { createFirestoreTransport } = await import("@/lib/lan-signal-firestore");
        const transport = await createFirestoreTransport(cfg.room, cfg.token);
        if (cancelled) return;
        const p2p = new LanP2P({
          transport,
          selfName: () => nameRef.current || "جهاز",
          onPeers: setPeers,
          onTransfer,
          onStatus: setConnected,
        });
        p2pRef.current = p2p;
        p2p.start();
        setMode("p2p");
      } catch {
        if (!cancelled) {
          setMode("relay-only");
          setShowRelay(true);
        }
      }
    })();
    const stop = () => p2pRef.current?.stop();
    window.addEventListener("beforeunload", stop);
    return () => {
      cancelled = true;
      window.removeEventListener("beforeunload", stop);
      stop();
      p2pRef.current = null;
    };
  }, [onTransfer]);

  // Signaling unreachable (no internet, Firebase down): after 10 s open the server relay so work goes on
  const [connectTimedOut, setConnectTimedOut] = useState(false);
  useEffect(() => {
    if (mode !== "p2p" || connected) return;
    const t = setTimeout(() => {
      setConnectTimedOut(true);
      setShowRelay(true);
    }, 10000);
    return () => clearTimeout(t);
  }, [mode, connected]);

  // Keep a valid target: the only PC when there is one, otherwise the one picked
  const target = peers.find((p) => p.id === targetId) || (peers.length === 1 ? peers[0] : null);

  const sendFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    if (!p2pRef.current || !target) {
      toast.error("اختار الجهاز الأول", "افتح الصفحة دي على الجهاز التاني واختاره من فوق.");
      return;
    }
    for (const f of list) p2pRef.current.sendFile(target.id, f);
  };

  const saveName = (name: string) => {
    setDeviceName(name);
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {}
  };

  // ---- server relay (fallback) ----
  const loadRelay = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/lan-transfer", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setRelayFiles(data.files);
        if (data.maxBytes) setRelayMax(data.maxBytes);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!showRelay) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch when the section opens
    loadRelay();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") loadRelay();
    }, 5000);
    return () => clearInterval(timer);
  }, [showRelay, loadRelay]);

  const relayUpload = (file: File) => {
    if (file.size > relayMax) {
      toast.error("الملف كبير", `عن طريق السيرفر الحد ${formatBytes(relayMax)}. استخدم الإرسال المباشر.`);
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("sender", deviceName);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/lan-transfer");
    xhr.upload.onprogress = (e) => e.lengthComputable && setRelayProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setRelayProgress(null);
      if (xhr.status === 200) {
        toast.success("اترفع", file.name);
        loadRelay();
      } else {
        toast.error("مترفعش", (() => { try { return JSON.parse(xhr.responseText).error; } catch { return ""; } })());
      }
    };
    xhr.onerror = () => {
      setRelayProgress(null);
      toast.error("مترفعش", "مفيش اتصال.");
    };
    setRelayProgress(0);
    xhr.send(form);
  };

  const relayDelete = async (id: string) => {
    await fetch(`/api/admin/lan-transfer?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    loadRelay();
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* Status + this PC's name */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              connected ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
            }`}
          >
            {mode === "loading" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : connected ? (
              <Wifi className="w-5 h-5" />
            ) : (
              <WifiOff className="w-5 h-5" />
            )}
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">
              {mode === "loading"
                ? "بنجهز الاتصال..."
                : mode === "relay-only"
                ? "الإرسال المباشر مش متاح دلوقتي"
                : connected
                ? "جاهز: الملفات بتروح من جهاز لجهاز على طول"
                : connectTimedOut
                ? "مقدرناش نوصل للأجهزة التانية، استخدم الإرسال عن طريق السيرفر تحت"
                : "بنحاول نتصل..."}
            </p>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              متشفر، ومن غير ما يعدّي على النت أو يصرف من الباقة
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Laptop className="w-4 h-4 text-blue-600" />
          اسم الجهاز ده:
          <input
            value={deviceName}
            onChange={(e) => saveName(e.target.value.slice(0, 40))}
            onBlur={() => p2pRef.current?.announce()}
            className="w-44 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900"
            placeholder="مثلاً: كمبيوتر الكاونتر"
          />
        </label>
      </div>

      {mode === "p2p" && (
        <>
          {/* Other PCs */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <MonitorSmartphone className="w-4 h-4 text-blue-600" />
                الأجهزة اللي فاتحة الصفحة دي ({peers.length})
              </h2>
            </div>
            {peers.length === 0 ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm font-bold">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                افتح صفحة &quot;نقل ملفات&quot; على الجهاز التاني (بنفس الحساب) وهيظهر هنا لوحده.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <AnimatePresence>
                  {peers.map((p) => {
                    const selected = target?.id === p.id;
                    return (
                      <motion.button
                        key={p.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        type="button"
                        onClick={() => setTargetId(p.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-black cursor-pointer ${
                          selected
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <Laptop className="w-4 h-4" />
                        {p.name}
                        {selected && <CheckCircle2 className="w-4 h-4" />}
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Drop zone */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) sendFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <motion.div
            onClick={() => target && fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              sendFiles(e.dataTransfer.files);
            }}
            animate={{ scale: isDragOver ? 1.01 : 1 }}
            className={`rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
              !target
                ? "border-slate-200 bg-slate-50 cursor-not-allowed opacity-70"
                : isDragOver
                ? "border-blue-500 bg-blue-50 cursor-copy"
                : "border-slate-300 bg-white hover:border-blue-400 cursor-pointer"
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <Upload className={`w-7 h-7 ${isDragOver ? "animate-bounce" : ""}`} />
            </div>
            <p className="text-base font-black text-slate-900">
              {target ? `اسحب الملفات هنا أو دوس واختارها: هتروح لـ "${target.name}"` : "اختار الجهاز اللي هتبعتله الأول"}
            </p>
            <p className="text-xs text-slate-500 font-medium mt-1">أي نوع وأي حجم. الملف بيتنزل على الجهاز التاني لوحده أول ما يوصل.</p>
          </motion.div>

          {/* Transfers */}
          {transfers.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2.5">
              <h2 className="text-sm font-black text-slate-900">الملفات اللي اتبعتت واتسلمت</h2>
              <AnimatePresence initial={false}>
                {transfers.map((t) => {
                  const pct = t.size ? Math.min(100, Math.round((t.bytes / t.size) * 100)) : 0;
                  return (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            t.direction === "in" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {t.direction === "in" ? <ArrowDownToLine className="w-4 h-4" /> : <ArrowUpFromLine className="w-4 h-4" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate" dir="auto">{t.name}</p>
                          <p className="text-xs text-slate-500 font-medium">
                            {t.direction === "in" ? `من ${t.peerName}` : `لـ ${t.peerName}`} · {formatBytes(t.bytes)} من {formatBytes(t.size)}
                            {t.status === "transferring" && ` · ${speedText(t)}`}
                          </p>
                        </div>
                        {t.status === "done" ? (
                          t.direction === "in" && t.blob ? (
                            <button
                              type="button"
                              onClick={() => saveAs(t.blob!, t.name)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" /> نزّله تاني
                            </button>
                          ) : (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          )
                        ) : t.status === "error" ? (
                          <XCircle className="w-5 h-5 text-red-500" />
                        ) : (
                          <span className="text-xs font-black text-blue-700 tabular-nums">{t.status === "connecting" ? "بيتصل..." : `${pct}%`}</span>
                        )}
                      </div>
                      {(t.status === "transferring" || t.status === "connecting") && (
                        <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${t.direction === "in" ? "bg-emerald-500" : "bg-blue-600"}`}
                            animate={{ width: `${t.status === "connecting" ? 4 : pct}%` }}
                            transition={{ ease: "linear", duration: 0.2 }}
                          />
                        </div>
                      )}
                      {t.status === "error" && <p className="mt-1.5 text-xs font-bold text-red-600">{t.error}</p>}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* Server relay fallback */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs">
        <button
          type="button"
          onClick={() => setShowRelay((s) => !s)}
          className="w-full flex items-center justify-between gap-2 p-4 text-right cursor-pointer"
        >
          <span className="flex items-center gap-2 text-sm font-black text-slate-800">
            <Server className="w-4 h-4 text-slate-500" />
            ابعت عن طريق السيرفر (لو الإرسال المباشر مش شغال)
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showRelay ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence initial={false}>
          {showRelay && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3">
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 font-medium">
                  الطريقة دي بتعدّي على النت (بتصرف من الباقة)، والحد {formatBytes(relayMax)} للملف، والملفات بتتمسح بعد 4 ساعات.
                </p>
                <input
                  ref={relayInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) relayUpload(f);
                    e.target.value = "";
                  }}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={relayProgress !== null}
                    onClick={() => relayInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {relayProgress !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {relayProgress !== null ? `بيترفع ${relayProgress}%` : "ارفع ملف"}
                  </button>
                  <button
                    type="button"
                    onClick={loadRelay}
                    className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                    title="حدّث"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                {relayFiles.length === 0 ? (
                  <p className="text-xs text-slate-400 font-bold py-3 text-center">مفيش ملفات على السيرفر</p>
                ) : (
                  <ul className="space-y-1.5">
                    {relayFiles.map((f) => (
                      <li key={f.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="flex-1 min-w-0 text-sm font-bold text-slate-800 truncate" dir="auto">{f.name}</span>
                        <span className="text-xs text-slate-500">{formatBytes(f.size)} · {f.sender}</span>
                        <a
                          href={`/api/admin/lan-transfer?download=${encodeURIComponent(f.id)}`}
                          className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50"
                          title="نزّل"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => relayDelete(f.id)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                          title="امسح"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
