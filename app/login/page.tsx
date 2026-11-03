"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogIn, Lock, Mail, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  useEffect(() => {
    if (!lockedUntil) return;

    const remainingMs = Math.max(0, lockedUntil - Date.now());
    const timer = setTimeout(() => {
      setLockedUntil(null);
    }, remainingMs);

    return () => clearTimeout(timer);
  }, [lockedUntil]);

  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const now = Date.now();
    if (lockedUntil && now < lockedUntil) {
      const waitSeconds = Math.ceil((lockedUntil - now) / 1000);
      setErrorMsg(`تم قفل المحاولات مؤقتاً لأسباب أمنية. يرجى الانتظار ${waitSeconds} ثانية.`);
      return;
    }

    if (!email.trim() || !password.trim()) {
      setErrorMsg("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
      return;
    }

    setLoading(true);

    try {
      const res = await login(email, password);
      if (res.success) {
        setAttempts(0);
        // Back to the admin page that sent us here; only same-site /admin paths (no open redirect)
        const from = new URLSearchParams(window.location.search).get("from") || "";
        router.push(/^\/admin(\/[\w-]+)*$/.test(from) ? from : "/admin");
      } else {
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        if (nextAttempts >= 5) {
          setLockedUntil(Date.now() + 30000);
          setErrorMsg("محاولات فاشلة متكررة! تم حظر الإدخال لمدة 30 ثانية حمايةً للحساب.");
        } else {
          setErrorMsg(res.error || "فشل تسجيل الدخول. تحقق من البيانات وحاول مجدداً.");
        }
      }
    } catch {
      setErrorMsg("حدث خطأ غير متوقع أثناء المصادقة.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Bar */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between py-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition px-3 py-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>العودة لمتجر كوبي كات</span>
        </Link>
      </div>

      {/* Main Card */}
      <div className="max-w-md w-full mx-auto my-auto bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden">
        <div className="text-center space-y-3 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 mx-auto flex items-center justify-center p-2 border border-slate-200 shadow-xs">
            <Image
              src="/logo.jpg"
              alt="كوبي كات"
              width={56}
              height={56}
              priority
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">تسجيل الدخول</h1>
          <p className="text-xs text-slate-500">
            لوحة تحكم وإدارة مكتبة ومطبعة كوبي كات
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">البريد الإلكتروني:</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">كلمة المرور:</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || lockedUntil !== null}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            <span>{loading ? "جاري التحقق..." : "دخول للوحة التحكم"}</span>
          </button>
        </form>

        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1 text-emerald-600 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>اتصال مشفر وآمن</span>
          </span>
          <span>Copy-Cat v1.2</span>
        </div>
      </div>

      {/* Footer copyright */}
      <div className="text-center text-xs text-slate-400 py-2">
        جميع الحقوق محفوظة © مكتبة كوبي كات {new Date().getFullYear()}
      </div>
    </div>
  );
}
