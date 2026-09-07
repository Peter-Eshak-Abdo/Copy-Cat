"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogIn, Lock, Mail, AlertCircle, ArrowRight, ShieldCheck, KeyRound } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-provider";
import { getFriendlyErrorMessage } from "@/lib/utils";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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

  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // Cyber security check: Rate limiting & brute force lockout
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
        router.push("/admin");
      } else {
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        if (nextAttempts >= 5) {
          // Lock for 30 seconds
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

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      await loginWithGoogle();
    } catch (err: unknown) {
      setErrorMsg(getFriendlyErrorMessage(err, "فشل الاتصال بخدمة جوجل للمصادقة."));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleQuickFill = () => {
    if (process.env.NEXT_PUBLIC_MASTER_EMAIL) {
      setEmail(process.env.NEXT_PUBLIC_MASTER_EMAIL);
      setErrorMsg("تم ملء بريد المسؤول تلقائياً. يرجى كتابة كلمة المرور للمتابعة.");
    } else {
      setErrorMsg("يرجى إدخال البريد الإلكتروني للمسؤول.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 transition-colors duration-300">
      {/* Top Bar */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between py-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>العودة لمتجر كوبي كات</span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Main Card */}
      <div className="max-w-md w-full mx-auto my-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-1/2 translate-x-1/2 w-48 h-2 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 rounded-full blur-sm" />

        <div className="text-center space-y-3 mb-6">
          <div className="w-20 h-20 rounded-2xl bg-white mx-auto flex items-center justify-center p-2 shadow-xl shadow-blue-500/20 border border-slate-700/50 hover:scale-105 transition-transform">
            <Image
              src="/logo.jpg"
              alt="كوبي كات - Copy Cat"
              width={72}
              height={72}
              priority
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-black text-white">تسجيل دخول المسؤول والموظفين</h1>
          <p className="text-xs text-slate-400">
            بوابة إدارة حلول كوبي كات الرقمية واسكربتات العمل السريعة
          </p>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Google Sign-In */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm shadow-md transition flex items-center justify-center gap-3 mb-4 cursor-pointer disabled:opacity-50"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span>{googleLoading ? "جاري الاتصال بجوجل..." : "تسجيل الدخول بحساب Google"}</span>
        </button>

        <div className="relative flex py-2 items-center mb-4">
          <div className="flex-grow border-t border-slate-800"></div>
          <span className="flex-shrink mx-4 text-xs text-slate-500 font-semibold">أو بالبريد وكلمة المرور</span>
          <div className="flex-grow border-t border-slate-800"></div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 block mb-1">البريد الإلكتروني:</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={process.env.NEXT_PUBLIC_MASTER_EMAIL || "admin@example.com"}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 block mb-1">كلمة المرور:</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-4 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
          </div>

          {/* Quick autofill helper for the owner */}
          <button
            type="button"
            onClick={handleQuickFill}
            className="w-full py-2 px-3 rounded-lg bg-blue-950/40 hover:bg-blue-900/40 border border-blue-800/40 text-blue-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>تعبئة بريد المسؤول تلقائياً</span>
          </button>

          <button
            type="submit"
            disabled={loading || lockedUntil !== null}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            <span>{loading ? "جاري التحقق الأمني..." : "دخول للوحة التحكم"}</span>
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>اتصال مشفر وآمن (SSL 256-bit)</span>
          </span>
          <span>Copy-Cat v1.2</span>
        </div>
      </div>

      {/* Footer copyright */}
      <div className="text-center text-xs text-slate-600 py-2">
        جميع الحقوق محفوظة © مكتبة كوبي كات  {new Date().getFullYear()}
      </div>
    </div>
  );
}
