import Link from "next/link";
import { Sparkles, Home, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white"
      dir="rtl"
    >
      <div className="relative max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl backdrop-blur-xl">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 mx-auto flex items-center justify-center">
          <Sparkles className="w-6 h-6" />
        </div>

        <div className="space-y-3">
          <span className="text-6xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent block">
            404
          </span>
          <h1 className="text-xl font-black text-white">الصفحة المطلوبة غير موجودة</h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            يبدو أن الرابط الذي اتبعته غير صحيح أو تم نقله لمكان آخر داخل نظام كوبي كات.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-600/30 transition-all"
          >
            <Home className="w-4 h-4" />
            <span>الرئيسية</span>
          </Link>
          <Link
            href="/admin"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700 transition-all"
          >
            <Compass className="w-4 h-4" />
            <span>لوحة التحكم</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
