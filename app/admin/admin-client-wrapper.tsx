"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth";
import {
  Loader2,
  LogOut,
  QrCode,
  X,
  ExternalLink,
  Download,
  Copy,
  Check,
  ChevronLeft,
  LayoutGrid,
  Search,
} from "lucide-react";
import QRCode from "qrcode";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { findToolByPath } from "@/lib/admin-tools";
import { ToolSwitcher } from "@/components/admin/tool-switcher";

const emptySubscribe = () => () => {};

export function AdminClientWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const WHATSAPP_LINK = "https://wa.me/qr/MA4E2HELDOY7F1";

  const isMainAdminHome = pathname === "/admin";
  const currentTool = findToolByPath(pathname);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  // Ctrl+K / Cmd+K opens the tool switcher from any admin page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K" || e.code === "KeyK")) {
        e.preventDefault();
        setSwitcherOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (mounted && !loading && !user) {
      router.push("/login");
    }
  }, [mounted, user, loading, router]);

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

  if (!mounted || (loading && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-semibold text-slate-500">بنتأكد إنك مسجل دخول...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    // reducedMotion="user": people who turn animations off in Windows get none here either
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans">
      {/* Sleek Minimalist Top Bar (Replaces Full Sidebar) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="w-[96%] max-w-[96vw] xl:max-w-[95%] mx-auto px-2 sm:px-4 py-2.5 flex items-center justify-between gap-3">
          {/* Right Section: Branding & Navigation */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/admin"
              className="flex items-center gap-2.5 group transition-transform hover:scale-102"
              title="الرئيسية"
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
                <p className="text-[11px] text-slate-500 font-bold">أدوات المكتبة</p>
              </div>
            </Link>

            {/* Breadcrumb: all tools > current tool (sub-pages only) */}
            {!isMainAdminHome && (
              <nav aria-label="مكانك" className="flex items-center gap-1.5 min-w-0">
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-black shadow-xs shadow-blue-600/30 transition-all cursor-pointer shrink-0"
                  title="ارجع لكل الأدوات"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden sm:inline">كل الأدوات</span>
                </Link>
                {currentTool && (
                  <>
                    <ChevronLeft className="w-4 h-4 text-slate-300 shrink-0" />
                    <motion.span
                      key={currentTool.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="inline-flex items-center gap-2 min-w-0"
                    >
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${currentTool.solidTile}`}>
                        <currentTool.icon className="w-4 h-4" />
                      </span>
                      <span className="text-sm sm:text-base font-black text-slate-900 truncate">{currentTool.short}</span>
                    </motion.span>
                  </>
                )}
              </nav>
            )}
          </div>

          {/* Left Section: User & Quick Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Tool switcher (Ctrl+K) */}
            <button
              type="button"
              onClick={() => setSwitcherOpen(true)}
              className="p-2 sm:px-3 rounded-xl text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 transition-all cursor-pointer flex items-center gap-2 text-xs font-bold"
              title="دوّر على أداة (Ctrl + K)"
            >
              <Search className="w-4 h-4 text-blue-600" />
              <span className="hidden lg:inline">دوّر على أداة</span>
              <kbd dir="ltr" className="hidden lg:inline px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-500">
                Ctrl K
              </kbd>
            </button>

            {/* WhatsApp QR Modal Button */}
            <button
              type="button"
              onClick={handleOpenQrModal}
              className="p-2 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="كود واتساب المكتبة"
            >
              <QrCode className="w-4 h-4 text-emerald-600" />
              <span className="hidden md:inline">كود واتساب</span>
            </button>

            {/* Link to Public Store */}
            {/* <Link
              href="/"
              target="_blank"
              className="p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="افتح صفحة الزباين"
            >
              <Home className="w-4 h-4 text-blue-500" />
              <span className="hidden md:inline">صفحة الزباين</span>
            </Link> */}

            {/* User Indicator */}
            {/* <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="truncate max-w-[120px]">{user.name}</span>
            </div> */}

            {/* Logout Button */}
            <button
              type="button"
              onClick={() => logout()}
              className="p-2 rounded-xl text-red-600 hover:bg-red-50 border border-red-200/60 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
              title="اخرج من حساب الأدمن"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">اخرج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area: 95% Screen Width for Maximum Utility */}
      <main className="admin-shell w-[96%] max-w-[96vw] xl:max-w-[95%] mx-auto py-5 flex-1 transition-all">
        {/* Keyed by route so every admin page slides in */}
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </main>

      <ToolSwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} />

      {/* Large High-Resolution QR Code Modal */}
      <AnimatePresence>
      {showQrModal && (
        <motion.div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowQrModal(false);
          }}
        >
          <motion.div
            className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative text-center flex flex-col items-center"
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
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
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}
