"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

export function PwaAndErrorGuard() {
  const [mounted, setMounted] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof navigator !== "undefined") {
      setIsOffline(!navigator.onLine);
    }

    const handleOnline = () => {
      setIsOffline(false);
      setShowRestored(true);
      const timer = setTimeout(() => setShowRestored(false), 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowRestored(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 1. Suppress benign Chrome extension listener disconnect errors
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message || String(event.reason || "");
      if (
        msg.includes("A listener indicated an asynchronous response") ||
        msg.includes("message channel closed before a response was received")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // 2. Service Worker handling: unregister on localhost to avoid stale cache hydration errors
    if ("serviceWorker" in navigator && typeof window !== "undefined") {
      const isLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname.includes("192.168.");

      if ("caches" in window) {
        caches.keys().then((keys) => {
          for (const key of keys) {
            if (key !== "copycat-cache-v5.0") {
              caches.delete(key);
            }
          }
        });
      }

      if (isLocalhost) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            reg.unregister();
          }
        });
      } else if (window.location.protocol.startsWith("http")) {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            reg.update();
            console.log("Copy-Cat PWA Service Worker active", reg.scope);
          })
          .catch(() => {
            // SW registration failed silently
          });
      }
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return (
    <>
      {/* Offline Alert Bar */}
      {mounted && isOffline && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-2 inset-x-4 max-w-xl mx-auto z-[99999] bg-amber-500/95 text-slate-950 px-4 py-2 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 text-xs font-black border border-amber-400/50 animate-in slide-in-from-top-3 duration-300"
          dir="rtl"
        >
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0 text-slate-950 animate-pulse" />
            <span>
              وضع عدم الاتصال (Offline) — كافة أدوات تجهيز البطاقات والصور والماسح والمخزن تعمل
              محلياً بدون إنترنت!
            </span>
          </div>
        </div>
      )}

      {/* Online Restored Toast */}
      {mounted && showRestored && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-2 inset-x-4 max-w-md mx-auto z-[99999] bg-emerald-600/95 text-white px-4 py-2 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-center gap-2 text-xs font-black border border-emerald-400/50 animate-in slide-in-from-top-3 duration-300"
          dir="rtl"
        >
          <Wifi className="w-4 h-4 shrink-0" />
          <span>تمت استعادة الاتصال بالإنترنت بنجاح</span>
        </div>
      )}
    </>
  );
}
