"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/toast-provider";
import { AnimatePresence, motion } from "motion/react";
import {
  LayoutGrid,
  RotateCcw,
  Printer,
  Eye,
  Monitor,
  Megaphone,
  Edit2,
  CheckCircle2,
  CreditCard,
  ArrowLeft,
  GripVertical,
  Store,
  Laptop,
  Smartphone,
  ExternalLink,
  X,
  Search,
  SearchX,
} from "lucide-react";
import { ADMIN_TOOLS, type AdminTool } from "@/lib/admin-tools";
import { api, useSyncedSetting } from "@/lib/admin-data";
import { toolMatches } from "@/components/admin/tool-switcher";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms?: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DEFAULT_BANNER = "خصم خاص وتجهيز فوري لكروت الرقم القومي والشهادات وطباعة الأبحاث وسحب المستندات";
const isBanner = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 300;

type WorkstationTool = AdminTool;
const WORKSTATION_TOOLS: WorkstationTool[] = ADMIN_TOOLS.filter((t) => !t.hidden);

export default function AdminDashboardPage() {
  const toast = useToast();
  const router = useRouter();

  // Tools state with persistent Drag & Drop ordering
  const [tools, setTools] = useState<WorkstationTool[]>(() => {
    if (typeof window === "undefined") return WORKSTATION_TOOLS;
    try {
      const savedOrder = localStorage.getItem("copycat_workstation_tools_order_v2");
      if (savedOrder) {
        const orderIds: string[] = JSON.parse(savedOrder);
        const reordered: WorkstationTool[] = [];
        orderIds.forEach((id) => {
          const found = WORKSTATION_TOOLS.find((t) => t.id === id);
          if (found) reordered.push(found);
        });
        WORKSTATION_TOOLS.forEach((t) => {
          if (!reordered.find((x) => x.id === t.id)) {
            reordered.push(t);
          }
        });
        if (reordered.length === WORKSTATION_TOOLS.length) {
          return reordered;
        }
      }
    } catch {}
    return WORKSTATION_TOOLS;
  });
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [toolQuery, setToolQuery] = useState("");
  const { isAdmin } = useAuth();
  const roleTools = tools.filter((t) => !t.adminOnly || isAdmin);
  const visibleTools = toolQuery.trim() ? roleTools.filter((t) => toolMatches(t, toolQuery)) : roleTools;
  const canDrag = !toolQuery.trim();
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);


  // Customer storefront preview modal
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newTools = [...tools];
    const [moved] = newTools.splice(draggedIndex, 1);
    newTools.splice(targetIndex, 0, moved);
    setTools(newTools);
    try {
      localStorage.setItem(
        "copycat_workstation_tools_order_v2",
        JSON.stringify(newTools.map((t) => t.id))
      );
    } catch {}
    setDraggedIndex(null);
    setDragOverIndex(null);
    toast.success("الترتيب اتحفظ", "ترتيب الأدوات اتحفظ على الجهاز ده.");
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleResetOrder = () => {
    setTools(WORKSTATION_TOOLS);
    try {
      localStorage.removeItem("copycat_workstation_tools_order_v2");
    } catch {}
    toast.info("الترتيب رجع", "الأدوات رجعت لترتيبها الأصلي.");
  };

  // Pending InstaPay transfers (shared list on the server)
  const [instaPay, setInstaPay] = useState<{ count: number; total: number } | null>(null);
  useEffect(() => {
    api<{ records: { status: string; amount: number | string }[] }>("/api/admin/instapay")
      .then(({ records }) => {
        const pending = records.filter((r) => r.status === "pending");
        setInstaPay({ count: pending.length, total: pending.reduce((sum, r) => sum + Number(r.amount || 0), 0) });
      })
      .catch(() => setInstaPay(null));
  }, []);

  // The line at the top of the customer page (read by the storefront through /api/public/banner)
  const [bannerText, saveBanner, bannerSync] = useSyncedSetting<string>(
    "storefront.banner",
    "copycat_announcement_banner_v2",
    DEFAULT_BANNER,
    isBanner
  );
  const [isEditingBanner, setIsEditingBanner] = useState(false);
  const [bannerInput, setBannerInput] = useState("");

  const WHATSAPP_LINK = "https://wa.me/qr/MA4E2HELDOY7F1";
  const [printQrModal, setPrintQrModal] = useState<"stand" | "poster" | null>(null);

  const [pwaPrompt, setPwaPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(display-mode: standalone)").matches;
    }
    return false;
  });

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPwaPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallPwa = async () => {
    if (pwaPrompt) {
      pwaPrompt.prompt();
      const choice = await pwaPrompt.userChoice;
      if (choice.outcome === "accepted") {
        toast.success("البرنامج اتثبت", "صفحة الأدمن بقت برنامج على سطح المكتب.");
        setPwaPrompt(null);
        setIsPwaInstalled(true);
      }
    } else {
      toast.info(
        "تثبيت صفحة الأدمن على الكمبيوتر",
        "دوس على علامة التثبيت (⊕) في شريط العنوان في Chrome أو Edge، وصفحة الأدمن هتبقى برنامج على سطح المكتب."
      );
    }
  };

  const handleSaveBanner = async () => {
    const text = bannerInput.trim().slice(0, 300);
    if (!text) return;
    setIsEditingBanner(false);
    const ok = await saveBanner(text);
    if (!ok) toast.error("الإعلان متحفظش", "جرب تاني.");
    else if (bannerSync === "local") toast.info("اتحفظ على الجهاز ده بس", "قاعدة البيانات مش متوصلة، فالزباين مش هيشوفوه.");
    else toast.success("الإعلان اتغير", "الكلام الجديد هيظهر فوق في صفحة الزباين.");
  };

  return (
    <div className="flex flex-col w-full space-y-6" dir="rtl">
      {/* Top Simple Action Bar & Tools Control */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl sm:rounded-3xl border-2 border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
            <LayoutGrid className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              أدوات الشغل
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-semibold mt-0.5 flex items-center gap-1.5">
              <GripVertical className="w-4 h-4 text-slate-400" />
              اسحب أي أداة وحطها في المكان اللي يريحك
            </p>
          </div>
        </div>

        {/* Quick filter: type part of a tool name and press Enter to open the first match */}
        <div className="relative w-full md:max-w-xs md:flex-1">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={toolQuery}
            onChange={(e) => setToolQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && visibleTools[0]) router.push(visibleTools[0].href);
              if (e.key === "Escape") setToolQuery("");
            }}
            placeholder="دوّر على أداة..."
            aria-label="دوّر على أداة"
            className="w-full pr-10 pl-3 py-2.5 rounded-xl border-2 border-slate-200 bg-slate-50 focus:bg-white text-sm font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-semibold outline-none transition"
          />
        </div>

        {/* Header Controls: Collapsible Overview Toggle & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleInstallPwa}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm border border-slate-200 transition cursor-pointer"
            title="ثبّت صفحة الأدمن كبرنامج على الكمبيوتر"
          >
            <Monitor className="w-4 h-4" />
            <span className="hidden sm:inline">{isPwaInstalled ? "البرنامج متثبت" : "ثبّت كبرنامج"}</span>
          </button>

          <button
            onClick={handleResetOrder}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm border border-slate-200 transition cursor-pointer"
            title="رجّع الأدوات لترتيبها الأصلي"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">رجّع الترتيب</span>
          </button>

          <button
            onClick={() => setPrintQrModal("stand")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs sm:text-sm border border-emerald-200 transition cursor-pointer"
            title="اطبع بوستر كود واتساب المكتبة"
          >
            <Printer className="w-4 h-4 text-emerald-600" />
            <span>بوستر واتساب</span>
          </button>

          <button
            onClick={() => setIsPreviewModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs sm:text-sm border border-blue-200 transition cursor-pointer"
            title="افتح صفحة الزباين"
          >
            <Eye className="w-4 h-4 text-blue-600" />
            <span>صفحة الزباين</span>
          </button>
        </div>
      </div>

      {/* Collapsible Section: Operations Welcome + Announcement Banner + KPI Metrics */}
      {/* Quick strip: pending InstaPay + the storefront banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 no-stagger">
        <Link
          href="/admin/instapay"
          className="group flex items-center gap-4 p-4 rounded-2xl bg-white border-2 border-slate-200/90 hover:border-violet-300 hover:shadow-md transition"
        >
          <span className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 group-hover:bg-violet-600 group-hover:text-white transition-colors">
            <CreditCard className="w-6 h-6" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-xs font-bold text-slate-500">تحويلات إنستا باي مستنية تأكيد</span>
            <span className="block text-lg font-black text-slate-900">
              {instaPay === null
                ? "—"
                : instaPay.count === 0
                ? "مفيش حاجة مستنية"
                : `${instaPay.count} تحويل · ${instaPay.total.toLocaleString("en-US")} ج.م`}
            </span>
          </span>
          <ArrowLeft className="w-5 h-5 text-violet-500 transition-transform group-hover:-translate-x-1" />
        </Link>

        <div className="lg:col-span-2 flex items-center gap-3 p-4 rounded-2xl bg-white border-2 border-slate-200/90">
          <span className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Megaphone className="w-6 h-6" />
          </span>
          <div className="flex-1 min-w-0">
            <span className="block text-xs font-bold text-slate-500">الإعلان اللي فوق في صفحة الزباين</span>
            {isEditingBanner ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={bannerInput}
                  maxLength={300}
                  autoFocus
                  onChange={(e) => setBannerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveBanner();
                    if (e.key === "Escape") setIsEditingBanner(false);
                  }}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:bg-white"
                />
                <button
                  onClick={handleSaveBanner}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shrink-0 cursor-pointer flex items-center gap-1"
                >
                  <CheckCircle2 className="w-4 h-4" /> احفظ
                </button>
                <button
                  onClick={() => setIsEditingBanner(false)}
                  className="px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            ) : (
              <p className="text-sm font-bold text-slate-800 truncate">{bannerText}</p>
            )}
          </div>
          {!isEditingBanner && (
            <button
              onClick={() => {
                setBannerInput(bannerText);
                setIsEditingBanner(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold shrink-0 transition cursor-pointer"
            >
              <Edit2 className="w-4 h-4" />
              <span>غيّر</span>
            </button>
          )}
        </div>
      </div>

      {/* The Dynamic Workstation Cards Grid with Drag & Drop Reordering (motion animates the reorder) */}
      {visibleTools.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center gap-2 py-16 rounded-3xl border-2 border-dashed border-slate-200 bg-white text-center"
        >
          <SearchX className="w-10 h-10 text-slate-300" />
          <p className="text-base font-black text-slate-700">مفيش أداة بالاسم ده</p>
          <button
            type="button"
            onClick={() => setToolQuery("")}
            className="text-sm font-bold text-blue-600 hover:underline cursor-pointer"
          >
            اعرض كل الأدوات
          </button>
        </motion.div>
      ) : (
        <motion.div layout className="no-stagger grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6">
          <AnimatePresence mode="popLayout">
            {visibleTools.map((tool, shownIndex) => {
              // Position in the full saved order (some tools can be hidden for this account)
              const index = tools.indexOf(tool);
              const isDragging = draggedIndex === index;
              const isOver = dragOverIndex === index && draggedIndex !== index;
              const Icon = tool.icon;

              return (
                <motion.div
                  key={tool.id}
                  layout
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: isDragging ? 0.4 : 1, y: 0, scale: isDragging ? 0.96 : 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 32,
                    delay: draggedIndex === null && !toolQuery ? Math.min(shownIndex, 8) * 0.03 : 0,
                  }}
                  className={`relative rounded-2xl sm:rounded-3xl ${isOver ? "ring-4 ring-blue-500/40" : ""}`}
                >
                  {/* Native HTML5 drag lives on a plain div: motion's own drag props would clash with it */}
                  <div
                    draggable={canDrag}
                    onDragStart={(e) => canDrag && handleDragStart(e, index)}
                    onDragOver={(e) => canDrag && handleDragOver(e, index)}
                    onDrop={(e) => canDrag && handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className="h-full"
                  >
                    <Link
                      href={tool.href}
                      draggable={false}
                      className={`group flex flex-col justify-between p-6 sm:p-7 rounded-2xl sm:rounded-3xl bg-white transition-all duration-200 shadow-xs border-2 border-slate-200/90 hover:shadow-xl hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 ${tool.hoverBorder} h-full`}
                    >
                      <div>
                        {/* Top Row: Icon, Badge, Drag Handle */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-xs group-hover:scale-105 group-hover:-rotate-3 ${tool.iconTile}`}
                            >
                              <Icon className="w-8 h-8 sm:w-9 sm:h-9" strokeWidth={1.9} />
                            </div>
                            <span className="text-xs sm:text-sm font-extrabold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                              {tool.badge}
                            </span>
                          </div>

                          {canDrag && (
                            <div
                              className="p-1.5 rounded-xl text-slate-300 group-hover:text-slate-500 hover:bg-slate-100 cursor-grab active:cursor-grabbing transition-colors"
                              title="اسحب الأداة عشان تغير مكانها"
                              onClick={(e) => e.preventDefault()}
                            >
                              <GripVertical className="w-5 h-5" />
                            </div>
                          )}
                        </div>

                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2.5 leading-snug">
                          {tool.title}
                        </h2>

                        <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
                          {tool.desc}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-4 mt-5 border-t border-slate-100">
                        <span className={`text-sm sm:text-base font-black ${tool.accent} flex items-center gap-1.5`}>
                          افتح
                          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1.5" />
                        </span>
                        <span className="text-xs sm:text-sm text-slate-400 font-bold">{tool.footerTag}</span>
                      </div>
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Modal: Printable WhatsApp QR Stand / Wall Poster */}
      {printQrModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-2xl my-auto flex flex-col items-center">
            {/* Control Bar (Screen Only) */}
            <div className="w-full flex items-center justify-between p-3 mb-3 bg-white border border-slate-200 rounded-2xl text-slate-800 shadow-xl print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-600" />
                <span className="font-bold text-xs text-slate-900">
                  {printQrModal === "stand" ? "استاند الكاشير (A5)" : "بوستر الحيطة (A4)"}
                </span>
                <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200 mr-2">
                  <button
                    onClick={() => setPrintQrModal("stand")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      printQrModal === "stand" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    استند طاولة (A5)
                  </button>
                  <button
                    onClick={() => setPrintQrModal("poster")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      printQrModal === "poster" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    بوستر حائط (A4)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>اطبع (Ctrl+P)</span>
                </button>
                <button
                  onClick={() => setPrintQrModal(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Paper Document */}
            <div
              id="printable-whatsapp-poster"
              className={`w-full bg-white text-slate-900 rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col justify-between items-center text-center border-4 border-emerald-600 relative overflow-hidden ${
                printQrModal === "stand" ? "max-w-md min-h-[580px]" : "max-w-xl min-h-[720px]"
              }`}
              dir="rtl"
            >
              {/* Header */}
              <div className="w-full flex flex-col items-center border-b-2 border-dashed border-emerald-500/40 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex gap-1 items-center">
                    <span className="w-3.5 h-3.5 rounded bg-cyan-500 inline-block"></span>
                    <span className="w-3.5 h-3.5 rounded bg-pink-500 inline-block"></span>
                    <span className="w-3.5 h-3.5 rounded bg-amber-400 inline-block"></span>
                    <span className="w-3.5 h-3.5 rounded bg-slate-900 inline-block"></span>
                  </div>
                  <span className="font-extrabold text-xl sm:text-2xl text-slate-900 tracking-tight">
                    مكتبة كوبي كات بالاسماعيلية
                  </span>
                </div>
                <div className="text-xs font-bold text-emerald-700 tracking-wide font-mono">
                  COPY CAT — PROFESSIONAL PRINTING & STATIONERY
                </div>
                <div className="mt-2 inline-block bg-emerald-100 text-emerald-900 px-3 py-1 rounded-full text-xs font-bold">
                  📱 أرسل ملفاتك ومذكراتك على واتساب لتجهيزها فوراً
                </div>
              </div>

              {/* Center: QR Code Display */}
              <div className="my-4 flex flex-col items-center">
                <div className="p-3 bg-white rounded-2xl border-4 border-slate-900 shadow-lg inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/whatsapp-qr.jpg"
                    alt="WhatsApp QR Code Copy Cat"
                    className={printQrModal === "stand" ? "w-48 h-48 object-contain" : "w-60 h-60 object-contain"}
                  />
                </div>
                <div className="mt-3 font-bold text-slate-900 text-sm flex items-center justify-center gap-1">
                  <span>امسح الكود بكاميرا الموبايل أو كاميرا واتساب</span>
                </div>
                <div className="text-xs text-slate-600 font-mono mt-0.5" dir="ltr">
                  {WHATSAPP_LINK}
                </div>
              </div>

              {/* Services List */}
              <div className="w-full grid grid-cols-2 gap-2 my-2 text-right text-xs">
                <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 flex items-center gap-1.5 font-bold text-slate-800">
                  <span className="text-emerald-600 text-sm">✓</span>
                  <span>طباعة أبحاث وملازم ليزر وألوان</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 flex items-center gap-1.5 font-bold text-slate-800">
                  <span className="text-emerald-600 text-sm">✓</span>
                  <span>تجليد وسلك وحماية المستندات</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 flex items-center gap-1.5 font-bold text-slate-800">
                  <span className="text-emerald-600 text-sm">✓</span>
                  <span>تصوير فوري للشهادات وبطاقات الرقم القومي</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 flex items-center gap-1.5 font-bold text-slate-800">
                  <span className="text-emerald-600 text-sm">✓</span>
                  <span>أرقى تشكيلة كشاكيل وأدوات مكتبية</span>
                </div>
              </div>

              {/* Footer Branch & Timing Info */}
              <div className="w-full pt-3 border-t-2 border-dashed border-emerald-500/40 text-[11px] text-slate-700 flex flex-col gap-1">
                <div className="font-bold text-slate-900 flex items-center justify-center gap-1">
                  <span>📍 الفرع:</span>
                  <span>عرايشية مصر - شارع الدقهلية بالقرب من مسجد المطافي أمام مركز نور الحياة - الإسماعيلية</span>
                </div>
                <div className="text-emerald-700 font-bold flex items-center justify-center gap-1">
                  <span>⏰ مواعيد العمل:</span>
                  <span>يومياً من 9 الصبح لحد 10 بالليل</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Store Preview Modal */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-6xl h-[92vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <Store className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">صفحة الزباين</h3>
                  <p className="text-xs text-slate-500">ده اللي الزبون بيشوفه دلوقتي</p>
                </div>
              </div>

              {/* View Controls & Close */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                  <button
                    onClick={() => setPreviewDevice("desktop")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      previewDevice === "desktop"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Laptop className="w-4 h-4" />
                    <span className="hidden sm:inline">كمبيوتر</span>
                  </button>
                  <button
                    onClick={() => setPreviewDevice("mobile")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      previewDevice === "mobile"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span className="hidden sm:inline">موبايل</span>
                  </button>
                </div>

                <a
                  href="/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 flex items-center gap-1.5 transition border border-slate-200"
                  title="افتحها في صفحة جديدة"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">نافذة جديدة</span>
                </a>

                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 flex items-center justify-center transition cursor-pointer border border-slate-200"
                  title="اقفل"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body / Iframe Container */}
            <div className="flex-1 bg-slate-100 p-2 sm:p-4 flex items-center justify-center overflow-auto">
              <div
                className={`transition-all duration-300 h-full shadow-lg overflow-hidden rounded-xl border border-slate-300 bg-white ${
                  previewDevice === "mobile"
                    ? "w-[390px] max-w-full rounded-3xl border-4 border-slate-700"
                    : "w-full"
                }`}
              >
                <iframe
                  src="/"
                  title="Customer Storefront Live Preview"
                  className="w-full h-full border-0"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for Clean Printing of Poster */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-whatsapp-poster,
          #printable-whatsapp-poster * {
            visibility: visible !important;
          }
          #printable-whatsapp-poster {
            position: fixed !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 92vw !important;
            max-width: 780px !important;
            margin: 0 !important;
            box-shadow: none !important;
            z-index: 999999 !important;
            background: white !important;
            color: #0f172a !important;
          }
        }
      `}</style>
    </div>
  );
}
