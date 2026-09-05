"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home, Sparkles } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log client-side error cleanly
    console.error("Copy-Cat App Error Captured:", error);
  }, [error]);

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white"
      dir="rtl"
    >
      <div className="relative max-w-lg w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 backdrop-blur-xl">
        {/* Glow decoration */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="font-black text-xl tracking-tight text-white">كوبي كات | Copy-Cat</span>
        </div>

        {/* Warning Icon */}
        <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center shadow-xl shadow-rose-500/10">
          <AlertTriangle className="w-10 h-10" />
        </div>

        {/* Main Message */}
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black text-white">
            حدث خطأ غير متوقع أثناء معالجة الصفحة
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
            نعتذر عن هذا الإزعاج المؤقت. تم تسجيل تفاصيل المشكلة تلقائياً لحلها بأسرع وقت. يمكنك
            إعادة المحاولة أو العودة للرئيسية.
          </p>
        </div>

        {/* Error Details (Friendly) */}
        {error?.message && (
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 text-right max-h-24 overflow-y-auto">
            <span className="text-[11px] font-bold text-slate-500 block mb-1">تفاصيل الخطأ:</span>
            <code className="text-xs text-rose-300 font-mono break-all">{error.message}</code>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-600/30 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>إعادة المحاولة</span>
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700 transition-all"
          >
            <Home className="w-4 h-4" />
            <span>العودة للرئيسية</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
