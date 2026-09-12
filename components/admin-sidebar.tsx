"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  Camera,
  FileText,
  ScanLine,
  Boxes,
  LayoutDashboard,
  Home,
  LogOut,
  Calculator,
  CheckSquare,
  Globe,
  Share2,
  GraduationCap,
  Sparkles,
  QrCode,
  X,
  ExternalLink,
  Download,
  Copy,
  Check,
} from "lucide-react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-provider";

interface NavGroup {
  title: string;
  items: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

const navGroups: NavGroup[] = [
  {
    title: "العمليات والمخزن",
    items: [
      { name: "الرئيسية والمتابعة", href: "/admin", icon: LayoutDashboard },
      { name: "المنتجات والأسعار", href: "/admin/inventory", icon: Boxes },
    ],
  },
  {
    title: "شغل المطبعة والتصوير",
    items: [
      { name: "أوردرات ومهام الشفت", href: "/admin/tasks", icon: CheckSquare },
      { name: "حاسبة تكلفة الملازم", href: "/admin/calculator", icon: Calculator },
      { name: "طباعة الكارنيهات والبطاقات", href: "/admin/id-cards", icon: CreditCard },
      { name: "صور 4×6 (شخصية وبطاقة)", href: "/admin/passport-photos", icon: Camera },
      { name: "سحب سكانر وتوفير الحبر", href: "/admin/scanner", icon: ScanLine },
    ],
  },
  {
    title: "أدوات وملفات سريعة",
    items: [
      { name: "تجهيز وتعديل PDF", href: "/admin/pdf-tools", icon: FileText },
      { name: "استخراج النص من الصور (OCR)", href: "/admin/ocr", icon: Sparkles },
      { name: "توليد الأبحاث المدرسية والجامعية", href: "/admin/research", icon: GraduationCap },
    ],
  },
  {
    title: "الروابط والنقل السريع",
    items: [
      { name: "مواقع وروابط يومية", href: "/admin/shortcuts", icon: Globe },
      { name: "نقل ملفات بالشبكة (LAN)", href: "/admin/lan-transfer", icon: Share2 },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const WHATSAPP_LINK = "https://wa.me/qr/MA4E2HELDOY7F1";

  // Generate high-resolution QR code whenever modal opens
  const handleOpenQrModal = async () => {
    setShowQrModal(true);
    try {
      const url = await QRCode.toDataURL(WHATSAPP_LINK, {
        width: 800,
        margin: 1,
        color: {
          dark: "#052e16",
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

  return (
    <>
      <aside className="w-64 bg-white dark:bg-slate-900/95 border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between p-4 min-h-screen shrink-0 transition-colors duration-300">
        <div className="space-y-4">
          {/* Branding */}
          <div className="flex items-center justify-between px-2 py-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-white flex items-center justify-center p-0.5 border border-slate-300 dark:border-slate-700/50 shadow-md shrink-0">
                <Image
                  src="/logo.jpg"
                  alt="Copy Cat"
                  width={40}
                  height={40}
                  priority
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="font-extrabold text-slate-900 dark:text-white text-base leading-tight">كوبي كات</h1>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Copy-Cat ERP</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleOpenQrModal}
                className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 border border-emerald-500/30 transition-all cursor-pointer"
                title="كيو آر واتساب المكتبة (عرض صورة كاملة كبيرة)"
              >
                <QrCode className="w-4 h-4" />
              </button>
              <ThemeToggle />
            </div>
          </div>

        {/* User Info pill */}
        {user && (
          <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="truncate">
              <span className="text-slate-800 dark:text-slate-200 font-bold block truncate">{user.name}</span>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block truncate">{user.email}</span>
            </div>
          </div>
        )}

        {/* Grouped Navigation */}
        <nav className="space-y-4 overflow-y-auto max-h-[calc(100vh-250px)] pr-1">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {group.title}
              </div>
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200",
                      isActive
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-white" : "text-slate-500 dark:text-slate-400")} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Actions */}
      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
        >
          <Home className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span>المتجر العام للزبائن</span>
        </Link>
        <button
          type="button"
          onClick={() => logout()}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-300 transition text-right cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج الآمن</span>
        </button>
      </div>
    </aside>

      {/* Large High-Resolution QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative text-center flex flex-col items-center">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 left-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-3">
              <QrCode className="w-3.5 h-3.5" /> كيو آر واتساب مكتبة كوبي كات الرسمي
            </div>

            <h3 className="text-lg font-black text-white mb-1">
              امسح الـ QR بكاميرا الموبايل
            </h3>
            <p className="text-xs text-slate-400 mb-5 max-w-xs leading-relaxed">
              افتح كاميرا الهاتف أو واتساب وسيبدأ العميل المحادثة ويرسل المذكرات فوراً
            </p>

            {/* Large High-Resolution QR Code Display */}
            <div className="w-72 h-72 sm:w-80 sm:h-80 bg-white rounded-3xl p-3 shadow-2xl border-4 border-emerald-500/40 flex items-center justify-center mb-4 transition-transform hover:scale-[1.02]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl || "/images/whatsapp-qr.jpg"}
                alt="WhatsApp QR Code Copy Cat High Resolution"
                className="w-full h-full object-contain rounded-2xl"
              />
            </div>

            {/* WhatsApp Link with One-Click Copy */}
            <div className="w-full p-2.5 rounded-2xl bg-slate-950 border border-slate-800 mb-4 flex items-center justify-between gap-2" dir="ltr">
              <span className="text-xs font-mono text-emerald-400 truncate select-all px-1">
                {WHATSAPP_LINK}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? "تم النسخ ✓" : "نسخ الرابط"}</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="w-full grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-300" />
                <span>تحميل كصورة (PNG)</span>
              </button>

              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <span>فتح في واتساب</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
