"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth";
import {
  Loader2,
  Home,
  LogOut,
  QrCode,
  X,
  ExternalLink,
  Download,
  Copy,
  Check,
  ArrowRight,
  LayoutGrid,
} from "lucide-react";
import QRCode from "qrcode";

export function AdminClientWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const WHATSAPP_LINK = "https://wa.me/qr/MA4E2HELDOY7F1";

  const isMainAdminHome = pathname === "/admin";

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const handleOpenQrModal = async () => {
    setShowQrModal(true);
    try {
      const url = await QRCode.toDataURL(WHATSAPP_LINK, {
        width: 800,
        margin: 1,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
        errorCorrectionLevel: "H",
      });
      setQrDataUrl(url);
    } catch {
      setQrDataUrl("/images/whatsapp-qr.jpg");
    }
  };

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(WHATSAPP_LINK);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = "CopyCat_WhatsApp_QR.png";
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-semibold text-slate-500">جاري التحقق من الصلاحيات...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans">
      {/* Sleek Minimalist Top Bar (Replaces Full Sidebar) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="w-[96%] max-w-[96vw] xl:max-w-[95%] mx-auto px-2 sm:px-4 py-2.5 flex items-center justify-between gap-3">
          {/* Right Section: Branding & Navigation */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/admin"
              className="flex items-center gap-2.5 group transition-transform hover:scale-102"
              title="لوحة تحكم كوبي كات الرئيسية"
            >
              <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center p-0.5 border border-slate-200 shadow-2xs shrink-0">
                <Image
                  src="/logo.jpg"
                  alt="Copy Cat"
                  width={36}
                  height={36}
                  priority
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-black text-slate-900 text-sm leading-tight">كوبي كات</h1>
                  <span className="px-1.5 py-0.2 rounded-md bg-blue-50 text-blue-600 text-[10px] font-black border border-blue-200">
                    أدمن
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-bold">مركز العمليات السريع</p>
              </div>
            </Link>

            {/* Back to Tools Button (shown on sub-pages) */}
            {!isMainAdminHome && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-black shadow-xs shadow-blue-600/30 transition-all cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>لوحة الأدوات الرئيسية</span>
              </Link>
            )}
          </div>

          {/* Left Section: User & Quick Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* WhatsApp QR Modal Button */}
            <button
              type="button"
              onClick={handleOpenQrModal}
              className="p-2 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="كيو آر واتساب المكتبة للزبائن"
            >
              <QrCode className="w-4 h-4 text-emerald-600" />
              <span className="hidden md:inline">كيو آر واتساب</span>
            </button>

            {/* Link to Public Store */}
            <Link
              href="/"
              target="_blank"
              className="p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="معاينة المتجر العام للزبائن"
            >
              <Home className="w-4 h-4 text-blue-500" />
              <span className="hidden md:inline">متجر الزبائن</span>
            </Link>

            {/* User Indicator */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="truncate max-w-[120px]">{user.name}</span>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={() => logout()}
              className="p-2 rounded-xl text-red-600 hover:bg-red-50 border border-red-200/60 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
              title="تسجيل الخروج من لوحة التحكم"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area: 95% Screen Width for Maximum Utility */}
      <main className="w-[96%] max-w-[96vw] xl:max-w-[95%] mx-auto py-5 flex-1 transition-all">
        {children}
      </main>

      {/* Large High-Resolution QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative text-center flex flex-col items-center">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 left-4 p-1.5 rounded-xl bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-black text-slate-900 mb-1">
              كيو آر واتساب كوبي كات
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              امسح الكود بكاميرا الموبايل لفتح المحادثة فوراً
            </p>

            <div className="w-64 h-64 bg-slate-50 rounded-2xl p-2 border border-slate-200 flex items-center justify-center mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl || "/images/whatsapp-qr.jpg"}
                alt="WhatsApp QR Code"
                className="w-full h-full object-contain rounded-xl"
              />
            </div>

            <div className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 mb-3 flex items-center justify-between gap-2" dir="ltr">
              <span className="text-[11px] font-mono text-slate-700 truncate select-all px-1">
                {WHATSAPP_LINK}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="py-1 px-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1 shrink-0 transition cursor-pointer shadow-xs"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? "تم" : "نسخ"}</span>
              </button>
            </div>

            <div className="w-full grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل الصورة</span>
              </button>

              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <span>فتح واتساب</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
