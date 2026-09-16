"use client";

import React, { useState, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/toast-provider";

interface PrintTask {
  id: string;
  title: string;
  customerName: string;
  phone?: string;
  deadline?: string;
  totalCopies: number;
  completedCopies: number;
  bindingType?: string;
  notes?: string;
  status: "pending" | "in_progress" | "ready" | "completed";
  createdAt: number;
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms?: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const STORAGE_KEY = "copycat_tasks_v1";

const DEFAULT_TASKS: PrintTask[] = [];

// Helper for InstaPay summary
function getPendingInstaPaySummary(): { count: number; total: number } {
  if (typeof window === "undefined") return { count: 0, total: 0 };
  try {
    const raw = localStorage.getItem("copycat_instapay_v1");
    if (!raw) return { count: 0, total: 0 };
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return { count: 0, total: 0 };
    const pending = list.filter((r: { status?: string }) => r.status === "pending");
    const total = pending.reduce((sum: number, r: { amount?: number }) => sum + (Number(r.amount) || 0), 0);
    return { count: pending.length, total };
  } catch {
    return { count: 0, total: 0 };
  }
}

// Cache for useSyncExternalStore snapshot to avoid infinite render loops
let cachedRaw: string | null = null;
let cachedTasks: PrintTask[] = DEFAULT_TASKS;
const taskListeners = new Set<() => void>();

function getTasksSnapshot(): PrintTask[] {
  if (typeof window === "undefined") return DEFAULT_TASKS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== cachedRaw) {
      cachedRaw = saved;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedTasks = parsed;
          return cachedTasks;
        }
      }
      cachedTasks = DEFAULT_TASKS;
    }
  } catch {
    cachedTasks = DEFAULT_TASKS;
  }
  return cachedTasks;
}

function getTasksServerSnapshot(): PrintTask[] {
  return DEFAULT_TASKS;
}

function subscribeTasks(callback: () => void) {
  taskListeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === STORAGE_KEY) {
      cachedRaw = null;
      callback();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    taskListeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function notifyTasksChanged() {
  cachedRaw = null;
  taskListeners.forEach((listener) => listener());
}

// حساب الوردية الحالية بدقة بناءً على التوقيت الفعلي
function getCurrentShift(date: Date = new Date()): {
  id: "morning" | "evening";
  label: string;
  timeRange: string;
} {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // من 8:30 صباحاً (510 دقيقة) حتى 4:00 عصراً (960 دقيقة) = شفت صباحي
  if (totalMinutes >= 510 && totalMinutes < 960) {
    return {
      id: "morning",
      label: "شفت صباحي",
      timeRange: "08:30 ص - 04:00 م",
    };
  }

  // من 4:00 عصراً حتى 11:30 مساءً = شفت مسائي
  return {
    id: "evening",
    label: "شفت مسائي",
    timeRange: "04:00 م - 11:30 م",
  };
}

interface WorkstationTool {
  id: string;
  title: string;
  desc: string;
  badge: string;
  footerTag: string;
  icon: string;
  href: string;
  colorClass: string;
  borderHoverClass: string;
  iconBgClass: string;
}

const WORKSTATION_TOOLS: WorkstationTool[] = [
  {
    id: "calculator",
    title: "حاسبة المطبعة والملازم الذكية",
    desc: "حساب دقيق لورق الملازم (وش وضهر)، أزرار تسعير الورقة، وإضافات التجليد والسلوفان مع حاسبة عامة سريعة بنظام Numpad.",
    badge: "حساب وش وظهر دقيق",
    footerTag: "تسعير مخصص للمكتبة",
    icon: "calculate",
    href: "/admin/calculator",
    colorClass: "text-blue-600",
    borderHoverClass: "hover:border-blue-400 hover:shadow-md",
    iconBgClass: "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white",
  },
  {
    id: "tasks",
    title: "أوردرات الطباعة وتسليم الشفت",
    desc: "متابعة أوردرات وملازم المدرسين، عداد النسخ المطبوعة الحي، مراسلة واتساب فورية، وتوليد تقرير تسليم الشفت بضغطة واحدة.",
    badge: "مراسلة واتساب فورية",
    footerTag: "تقرير شفت متكامل",
    icon: "task_alt",
    href: "/admin/tasks",
    colorClass: "text-indigo-600",
    borderHoverClass: "hover:border-indigo-400 hover:shadow-md",
    iconBgClass: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white",
  },
  {
    id: "pdf-tools",
    title: "استوديو وأدوات الـ PDF المتقدمة",
    desc: "حذف صفحات الملازم من المنتصف والأطراف، تجميع الصور في ملف PDF، وتحويل المستندات العربية إلى Word بمسافات ضيقة وخط 18pt.",
    badge: "تعديل PDF أوفلاين",
    footerTag: "حذف صفحات & صور لـ PDF",
    icon: "picture_as_pdf",
    href: "/admin/pdf-tools",
    colorClass: "text-rose-600",
    borderHoverClass: "hover:border-rose-400 hover:shadow-md",
    iconBgClass: "bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white",
  },
  {
    id: "ocr",
    title: "الماسح الضوئي الذكي (Multi-Page OCR)",
    desc: "استخراج نصوص الأوراق والملازم وتدقيقها لغوياً ونحوياً بدقة عالية وتصدير ملف Word جاهز للطباعة والتحرير.",
    badge: "تدقيق لغوي ذكي",
    footerTag: "تصدير Word بخط 18pt",
    icon: "psychology",
    href: "/admin/ocr",
    colorClass: "text-amber-600",
    borderHoverClass: "hover:border-amber-400 hover:shadow-md",
    iconBgClass: "bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white",
  },
  {
    id: "lan-transfer",
    title: "مركز النقل السريع الداخلي (LAN Transfer)",
    desc: "نقل فوري للملفات والملازم الكبيرة بين أجهزة المكتبة عبر كابل الشبكة المحلية أو الراوتر بدون استهلاك باقة الإنترنت وبسرعات خيالية.",
    badge: "0 استهلاك نت",
    footerTag: "سرعة كابل الشبكة القصوى",
    icon: "share",
    href: "/admin/lan-transfer",
    colorClass: "text-cyan-600",
    borderHoverClass: "hover:border-cyan-400 hover:shadow-md",
    iconBgClass: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white",
  },
  {
    id: "id-cards",
    title: "مصنع البطاقات والمستندات (A5)",
    desc: "قص وتجهيز بطاقات الرقم القومي، رخص القيادة، وشهادات الميلاد وش وظهر على ورقة A5 فورية بالألوان الطبيعية الأصلية 100%.",
    badge: "تصدير Word A5",
    footerTag: "ألوان طبيعية 100%",
    icon: "badge",
    href: "/admin/id-cards",
    colorClass: "text-emerald-600",
    borderHoverClass: "hover:border-emerald-400 hover:shadow-md",
    iconBgClass: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white",
  },
  {
    id: "passport-photos",
    title: "استوديو الصور الشخصية (4x6)",
    desc: "عزل الخلفية تلقائياً، ضبط الرأس والكتفين بيومترياً، إزالة الظلال، ورص 8 صور بجودة عالية جاهزة للطابعة الملونة.",
    badge: "معيار بيومتري 4x6",
    footerTag: "رص 8 صور 4x6",
    icon: "photo_camera",
    href: "/admin/passport-photos",
    colorClass: "text-sky-600",
    borderHoverClass: "hover:border-sky-400 hover:shadow-md",
    iconBgClass: "bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white",
  },
  {
    id: "scanner",
    title: "ماسح المستندات وتوفير الحبر",
    desc: "قلب ألوان لقطات الشاشة الداكنة (Dark Mode Invert) وتبييض خلفية الورق الأصفر والظلال لتوفير الحبر الأسود مع نصوص عالية الحدة.",
    badge: "توفير 70% حبر",
    footerTag: "تبييض فوري ونقي",
    icon: "invert_colors",
    href: "/admin/scanner",
    colorClass: "text-teal-600",
    borderHoverClass: "hover:border-teal-400 hover:shadow-md",
    iconBgClass: "bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white",
  },
  {
    id: "research",
    title: "مولد الأبحاث المدرسية والجامعية",
    desc: "صياغة وتنسيق الأبحاث A4 بهوامش ضيقة، فهارس ومراجع أكاديمية موثقة، غلاف رسمي للمدرسة أو الجامعة وتصدير Word جاهز فوراً.",
    badge: "أكاديمي معتمد",
    footerTag: "تنسيق Word A4 قياسي",
    icon: "auto_stories",
    href: "/admin/research",
    colorClass: "text-purple-600",
    borderHoverClass: "hover:border-purple-400 hover:shadow-md",
    iconBgClass: "bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white",
  },
  {
    id: "shortcuts",
    title: "روابط وسيرفرات العمل اليومية",
    desc: "دليل الخدمات الحكومية، بوابات التنسيق والجامعات، منصات التقديم لوظائف المعلمين، ومواقع فحص وحساب التكلفة السريعة.",
    badge: "وصول سريع بضغطة زر",
    footerTag: "24 بوابة حكومية",
    icon: "language",
    href: "/admin/shortcuts",
    colorClass: "text-slate-600",
    borderHoverClass: "hover:border-slate-400 hover:shadow-md",
    iconBgClass: "bg-slate-100 text-slate-700 group-hover:bg-slate-800 group-hover:text-white",
  },
  {
    id: "inventory",
    title: "إدارة المخزن والكتالوج (حصر)",
    desc: "متابعة رصيد باكتات الورق 70g و 80g، خراطيش الحبر، السلك الحلزوني، وتحديث فوري لأسعار التوريد والبيع للزبائن.",
    badge: "حصر المنتجات والمخزون",
    footerTag: "تحديث الأسعار والموردين",
    icon: "inventory",
    href: "/admin/inventory",
    colorClass: "text-emerald-700",
    borderHoverClass: "hover:border-emerald-500 hover:shadow-md",
    iconBgClass: "bg-emerald-50 text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white",
  },
  {
    id: "photos",
    title: "بنك ومكتبة صور المنتجات (Photo Pool)",
    desc: "مستودع يجمع صور صفحة فيسبوك والصور الملتقطة بكاميرا الهاتف لربط وتخصيص صور المنتجات والكتالوج في أي وقت بضغطة واحدة.",
    badge: "مكتبة صور متجددة",
    footerTag: "تصوير & ربط بالكتالوج",
    icon: "photo_library",
    href: "/admin/photos",
    colorClass: "text-emerald-600",
    borderHoverClass: "hover:border-emerald-400 hover:shadow-md",
    iconBgClass: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white",
  },
  {
    id: "instapay",
    title: "سجل وتحويلات إنستا باي (InstaPay)",
    desc: "تسجيل تحويلات الزبائن بالاسم والهاتف والمبلغ لحين وصول الباشمهندس للمكتبة وتأكيد استلام المبالغ بحساب البنك بنقرة واحدة.",
    badge: "تأكيد فوري للتحويلات",
    footerTag: "تسجيل وتأكيد",
    icon: "credit_card",
    href: "/admin/instapay",
    colorClass: "text-violet-600",
    borderHoverClass: "hover:border-violet-400 hover:shadow-md",
    iconBgClass: "bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white",
  },
  {
    id: "fb-post-tools",
    title: "سحب بوستات وملازم فيسبوك PDF",
    desc: "ضع رابط أي منشور فيسبوك (مثلاً 80 صورة ملزمة أو مذكرة) لسحب كافة الصور بالترتيب ودمجها فوراً في ملف PDF عالي الدقة جاهز للطباعة.",
    badge: "سحب بوستات كاملة",
    footerTag: "دمج صفحات بالترتيب",
    icon: "picture_as_pdf",
    href: "/admin/fb-post-tools",
    colorClass: "text-blue-600",
    borderHoverClass: "hover:border-blue-400 hover:shadow-md",
    iconBgClass: "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white",
  },
];

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const tasks = useSyncExternalStore(subscribeTasks, getTasksSnapshot, getTasksServerSnapshot);

  // Customer storefront preview modal
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  const handleRefresh = () => {
    notifyTasksChanged();
    toast.success("تم تحديث البيانات", "تمت مزامنة قائمة أوردرات الشفت والعدادات الحية بنجاح");
  };

  // Shift & Real metrics calculations
  const currentShift = getCurrentShift();
  const activeOrdersCount = tasks.filter((t) => t.status === "in_progress" || t.status === "pending").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const readyCount = tasks.filter((t) => t.status === "ready").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;

  // إجمالي النسخ المطبوعة الفعلي من مهام اليوم الحقيقية
  const totalCopiesToday = tasks.reduce(
    (sum, t) => sum + (Number(t.completedCopies) || Number(t.totalCopies) || 0),
    0
  );

  const [bannerText, setBannerText] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("copycat_announcement_banner");
        if (saved && saved.trim()) return saved.trim();
      } catch {}
    }
    return "خصم خاص وتجهيز فوري لكروت الرقم القومي والشهادات وطباعة الأبحاث وسحب المستندات";
  });
  const [isEditingBanner, setIsEditingBanner] = useState(false);
  const [bannerInput, setBannerInput] = useState("");

  // WhatsApp QR Stand & Direct Contact
  const WHATSAPP_LINK = "https://wa.me/qr/MA4E2HELDOY7F1";
  const [printQrModal, setPrintQrModal] = useState<"stand" | "poster" | null>(null);

  // Desktop PWA Installation Hook for Library PC
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
        toast.success("تم تثبيت التطبيق بنجاح!", "لوحة إدارة مكتبة كوبي كات تعمل الآن كتطبيق مستقل على سطح المكتب.");
        setPwaPrompt(null);
        setIsPwaInstalled(true);
      }
    } else {
      toast.info(
        "تثبيت نسخة الأدمن PWA على كمبيوتر المكتبة",
        "يمكنك الضغط على أيقونة التثبيت (⊕ في شريط عنوان المتصفح Chrome/Edge) لتثبيت لوحة الإدارة مباشرة وتفتح تلقائياً على /admin."
      );
    }
  };

  const handleSaveBanner = () => {
    if (!bannerInput.trim()) return;
    localStorage.setItem("copycat_announcement_banner", bannerInput.trim());
    setBannerText(bannerInput.trim());
    setIsEditingBanner(false);
    toast.success("تم تحديث إعلان المتجر", "تم حفظ النص الجديد وسيطبق فوراً على شريط المتجر العلوي.");
  };

  return (
    <div className="flex flex-col w-full space-y-6" dir="rtl">
      {/* Top Welcome Operations Banner */}
      <div className="rounded-2xl bg-white p-6 shadow-xs border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200/60">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                مكتبة ومطبعة كوبي كات
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs border border-slate-200">
                <span className="material-symbols-outlined text-sm text-slate-500">location_on</span>
                فرع الإسماعيلية — شارع الدقهلية
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              مركز العمليات ومطبعة كوبي كات
            </h1>
            <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
              منصة إدارة أوردرات الطباعة وتسليم الشفت، استخراج النصوص، حاسبة الملازم، وأدوات المستندات الذكية.
            </p>
          </div>

          {/* Quick Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
            {/* Direct PWA Install */}
            <button
              onClick={handleInstallPwa}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs transition cursor-pointer"
              title="تثبيت لوحة الأدمن كتطبيق مستقل على كمبيوتر المكتبة (PWA)"
            >
              <span className="material-symbols-outlined text-lg text-emerald-600">desktop_windows</span>
              <span>{isPwaInstalled ? "تطبيق الأدمن مثبت ✓" : "تثبيت أدمن المكتبة PWA"}</span>
            </button>

            <Link
              href="/admin/calculator"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-xs"
            >
              <span className="material-symbols-outlined text-lg">calculate</span>
              <span>حاسبة الملازم والطباعة</span>
            </Link>
            <Link
              href="/admin/tasks"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition border border-slate-200"
            >
              <span className="material-symbols-outlined text-lg text-slate-600">assignment_turned_in</span>
              <span>مهام وأوردرات الشفت</span>
            </Link>
            <button
              onClick={() => setIsPreviewModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs transition cursor-pointer"
              title="معاينة واجهة المتجر كما يراها العميل"
            >
              <span className="material-symbols-outlined text-lg text-slate-600">preview</span>
              <span>معاينة متجر الزبائن</span>
            </button>
          </div>
        </div>
      </div>

      {/* Announcement Banner Management Card */}
      <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 w-full">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <span className="material-symbols-outlined text-xl">campaign</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">شريط إعلان وخصم المتجر العلوي:</span>
              <span className="text-[11px] text-slate-400">يظهر أعلى متجر الزبائن مباشرة</span>
            </div>
            {isEditingBanner ? (
              <div className="flex items-center gap-2 mt-2 w-full">
                <input
                  type="text"
                  value={bannerInput}
                  onChange={(e) => setBannerInput(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
                <button
                  onClick={handleSaveBanner}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0 cursor-pointer"
                >
                  حفظ التعديل ✓
                </button>
                <button
                  onClick={() => setIsEditingBanner(false)}
                  className="px-2.5 py-1.5 rounded-xl text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-600 font-medium truncate mt-0.5">
                {bannerText}
              </p>
            )}
          </div>
        </div>
        {!isEditingBanner && (
          <button
            onClick={() => {
              setBannerInput(bannerText);
              setIsEditingBanner(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold shrink-0 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
            <span>تعديل الإعلان</span>
          </button>
        )}
      </div>

      {/* KPI Operational Metrics Grid (4 Clean White Metric Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Active Orders */}
        <div className="flex flex-col justify-between p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">أوردرات اليوم النشطة</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
              <span className="material-symbols-outlined text-xl">receipt_long</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {activeOrdersCount}
            </span>
            <span className="text-xs font-bold text-blue-600">أوردر مسجل</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              {inProgressCount > 0 ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span>
                  {inProgressCount} جاري تنفيذها بالماكينات
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm text-emerald-600">done_all</span>
                  جميع الأوردرات مسجلة وجاهزة
                </>
              )}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
              {currentShift.label}
            </span>
          </div>
        </div>

        {/* Card 2: Printed Sheets Total */}
        <div className="flex flex-col justify-between p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">إجمالي النسخ المطبوعة اليوم</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
              <span className="material-symbols-outlined text-xl">print</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {totalCopiesToday.toLocaleString("ar-EG")}
            </span>
            <span className="text-xs font-bold text-indigo-600">ورقة A4/A5</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
              {readyCount > 0 ? `${readyCount} أوردر جاهز للتسليم` : `${completedCount} أوردر مكتمل`}
            </span>
            <span className="text-xs text-slate-400 font-medium">{currentShift.label}</span>
          </div>
        </div>

        {/* Card 3: InstaPay Pending Transfers */}
        <Link
          href="/admin/instapay"
          className="group flex flex-col justify-between p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-violet-300 hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">تحويلات إنستا باي المعلقة</span>
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors border border-violet-100">
              <span className="material-symbols-outlined text-xl">credit_card</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-extrabold text-violet-700 tracking-tight">
              {getPendingInstaPaySummary().total.toLocaleString("ar-EG")}
            </span>
            <span className="text-sm font-bold text-slate-600">ج.م</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-xs text-amber-600 font-bold">
              {getPendingInstaPaySummary().count > 0 ? `${getPendingInstaPaySummary().count} بانتظار التأكيد` : "لا توجد مبالغ معلقة"}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-bold flex items-center gap-0.5">
              <span>فتح السجل</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </span>
          </div>
        </Link>

        {/* Card 4: Shift Completion & Progress */}
        <div className="flex flex-col justify-between p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">معدل إنجاز أوردرات الشفت</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
              <span className="material-symbols-outlined text-xl">donut_large</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0}%
            </span>
            <span className="text-xs font-bold text-emerald-600">
              {tasks.length > 0 ? `${completedCount} من ${tasks.length}` : "0 أوردر"}
            </span>
          </div>
          <div className="flex flex-col gap-1 pt-2 border-t border-slate-100">
            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                style={{ width: `${tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0}%` }}
              ></div>
            </div>
            <span className="text-[11px] text-slate-400 mt-1">
              {tasks.length > 0
                ? `${inProgressCount} أوردر جاري تنفيذه حالياً`
                : "جاهز لبدء استقبال أوردرات الشفت الجديدة"}
            </span>
          </div>
        </div>
      </div>

      {/* Header for Workstations Section */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600 text-2xl">grid_view</span>
          <h2 className="text-lg font-bold text-slate-900">جميع أدوات وماكينات العمل اليومية</h2>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold border border-slate-200">
            {WORKSTATION_TOOLS.length} أداة جاهزة
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-slate-500 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          أدوات وماكينات الطباعة والتجهيز
        </div>
      </div>

      {/* The Dynamic Workstation Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {WORKSTATION_TOOLS.map((tool) => (
          <Link
            key={tool.id}
            href={tool.href}
            className={`group flex flex-col justify-between p-5 rounded-2xl bg-white hover:bg-slate-50/70 transition-all shadow-xs border border-slate-200 ${tool.borderHoverClass}`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${tool.iconBgClass}`}>
                  <span className="material-symbols-outlined text-2xl">{tool.icon}</span>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {tool.badge}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors mb-2">
                {tool.title}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {tool.desc}
              </p>
            </div>
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
              <span className={`text-xs font-bold ${tool.colorClass} flex items-center gap-1 group-hover:translate-x-[-3px] transition-transform`}>
                تشغيل الأداة
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium">{tool.footerTag}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Shift Activity & Active Print Queue Table */}
      <div className="rounded-2xl bg-white p-6 shadow-xs border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <span className="material-symbols-outlined text-xl">hourglass_top</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">أوردرات الشفت المباشرة وقائمة الانتظار</h3>
              <p className="text-xs text-slate-500">متابعة فورية للمهام قيد الطباعة والجاهزة للتسليم للزبائن والمدرسين</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer border border-slate-200"
              type="button"
            >
              <span className="material-symbols-outlined text-base">refresh</span>
              <span>تحديث القائمة</span>
            </button>
            <Link
              href="/admin/tasks"
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>أوردر جديد</span>
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs font-bold border-y border-slate-200">
                <th className="p-3 rounded-r-xl">رقم الأوردر</th>
                <th className="p-3">اسم العميل / المدرس</th>
                <th className="p-3">تفاصيل المهمة</th>
                <th className="p-3 text-left">الكمية</th>
                <th className="p-3 text-left">الحالة</th>
                <th className="p-3 text-center rounded-l-xl">إجراءات سريعة</th>
              </tr>
            </thead>
            <tbody className="text-slate-800 text-xs divide-y divide-slate-100">
              {tasks.slice(0, 5).map((task) => (
                <tr key={task.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3 font-mono font-bold text-blue-600">
                    #{task.id}
                  </td>
                  <td className="p-3 font-semibold text-slate-900">{task.customerName}</td>
                  <td className="p-3 text-slate-500 max-w-xs truncate">{task.title}</td>
                  <td className="p-3 text-left font-mono">
                    {task.completedCopies ? `${task.completedCopies} / ` : ""}{task.totalCopies} نسخة
                  </td>
                  <td className="p-3 text-left">
                    {task.status === "in_progress" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span>
                        جاري التنفيذ
                      </span>
                    ) : task.status === "ready" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                        جاهز للتسليم
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                        تم التسليم
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {task.phone && (
                        <a
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition cursor-pointer"
                          href={`https://wa.me/2${task.phone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="مراسلة واتساب"
                        >
                          <span className="material-symbols-outlined text-base">chat</span>
                        </a>
                      )}
                      <Link
                        href="/admin/tasks"
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
                        title="إدارة الأوردر"
                      >
                        <span className="material-symbols-outlined text-base">edit_document</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between p-4 rounded-2xl bg-white text-slate-500 text-xs gap-3 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-800 font-bold">حالة النظام:</span>
            <span className="text-emerald-700 font-bold">جاهز ومستعد للعمل</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-blue-600 text-base">schedule</span>
            <span>الوردية: {currentShift.label} ({currentShift.timeRange})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-slate-500 text-base">person</span>
            <span>المسؤول: {user?.name || "مشرف الشفت"}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
          <span className="material-symbols-outlined text-sm">location_on</span>
          <span>شارع الدقهلية بالقرب من مسجد المطافي أمام مركز نور الحياة - عرايشية مصر - الإسماعيلية</span>
        </div>
      </div>

      {/* Modal: Printable WhatsApp QR Stand / Wall Poster */}
      {printQrModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-2xl my-auto flex flex-col items-center">
            {/* Control Bar (Screen Only) */}
            <div className="w-full flex items-center justify-between p-3 mb-3 bg-white border border-slate-200 rounded-2xl text-slate-800 shadow-xl print:hidden">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-xl">print</span>
                <span className="font-bold text-xs text-slate-900">
                  {printQrModal === "stand" ? "معاينة استند طاولة الكاشير (A5)" : "معاينة بوستر حائط المحل (A4)"}
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
                  <span className="material-symbols-outlined text-sm">print</span>
                  <span>طباعة فورية (Ctrl+P)</span>
                </button>
                <button
                  onClick={() => setPrintQrModal(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer transition"
                >
                  <span className="material-symbols-outlined text-base">close</span>
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
                  https://wa.me/qr/MA4E2HELDOY7F1
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
                  <span>نستقبلكم يومياً حتى 11:30 مساءً</span>
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
                  <span className="material-symbols-outlined text-2xl">storefront</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">معاينة واجهة متجر الزبائن الحية</h3>
                  <p className="text-xs text-slate-500">شاهد كيف تبدو العروض والأسعار والمنتجات للعميل الآن</p>
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
                    <span className="material-symbols-outlined text-sm">laptop</span>
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
                    <span className="material-symbols-outlined text-sm">smartphone</span>
                    <span className="hidden sm:inline">موبايل</span>
                  </button>
                </div>

                <a
                  href="/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 flex items-center gap-1.5 transition border border-slate-200"
                  title="فتح في نافذة متصفح جديدة"
                >
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  <span className="hidden sm:inline">نافذة جديدة</span>
                </a>

                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 flex items-center justify-center transition cursor-pointer border border-slate-200"
                  title="إغلاق المعاينة"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
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
