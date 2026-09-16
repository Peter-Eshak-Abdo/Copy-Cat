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

  return (
    <>
      <aside className="w-64 bg-white border-l border-slate-200 flex flex-col justify-between p-4 min-h-screen shrink-0 shadow-xs">
        <div className="space-y-4">
          {/* Branding */}
          <div className="flex items-center justify-between px-1 py-2 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center p-0.5 border border-slate-200 shadow-xs shrink-0">
                <Image
                  src="/logo.jpg"
                  alt="Copy Cat"
                  width={36}
                  height={36}
                  priority
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="font-extrabold text-slate-900 text-sm leading-tight">كوبي كات</h1>
                <p className="text-[11px] text-blue-600 font-bold">Copy-Cat ERP</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenQrModal}
              className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 transition-all cursor-pointer"
              title="كيو آر واتساب المكتبة"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>

          {/* User Info */}
          {user && (
            <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <div className="truncate">
                <span className="text-slate-800 font-bold block truncate">{user.name}</span>
                <span className="text-slate-500 text-[10px] block truncate">{user.email}</span>
              </div>
            </div>
          )}

          {/* Grouped Navigation */}
          <nav className="space-y-4 overflow-y-auto max-h-[calc(100vh-230px)] pr-0.5">
            {navGroups.map((group, gIdx) => (
              <div key={gIdx} className="space-y-1">
                <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
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
                        "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150",
                        isActive
                          ? "bg-blue-50 text-blue-700 border-r-2 border-blue-600 shadow-2xs font-bold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      )}
                    >
                      <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-blue-600" : "text-slate-400")} />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="pt-3 border-t border-slate-100 space-y-1">
          <Link
            href="/"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
          >
            <Home className="w-4 h-4 text-slate-400" />
            <span>المتجر العام للزبائن</span>
          </Link>
          <button
            type="button"
            onClick={() => logout()}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition text-right cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Large High-Resolution QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-xl relative text-center flex flex-col items-center">
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
    </>
  );
}
