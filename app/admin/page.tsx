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
    colorClass: "text-primary",
    borderHoverClass: "hover:border-primary/40",
    iconBgClass: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary",
  },
  {
    id: "tasks",
    title: "أوردرات الطباعة وتسليم الشفت",
    desc: "متابعة أوردرات وملازم المدرسين، عداد النسخ المطبوعة الحي، مراسلة واتساب فورية، وتوليد تقرير تسليم الشفت بضغطة واحدة.",
    badge: "مراسلة واتساب فورية",
    footerTag: "تقرير شفت متكامل",
    icon: "task_alt",
    href: "/admin/tasks",
    colorClass: "text-primary",
    borderHoverClass: "hover:border-primary/40",
    iconBgClass: "bg-primary-container/20 text-primary group-hover:bg-primary-container group-hover:text-on-primary-container",
  },
  {
    id: "pdf-tools",
    title: "استوديو وأدوات الـ PDF المتقدمة",
    desc: "حذف صفحات الملازم من المنتصف والأطراف، تجميع الصور في ملف PDF، وتحويل المستندات العربية إلى Word بمسافات ضيقة وخط 18pt.",
    badge: "تعديل PDF أوفلاين",
    footerTag: "حذف صفحات & صور لـ PDF",
    icon: "picture_as_pdf",
    href: "/admin/pdf-tools",
    colorClass: "text-secondary",
    borderHoverClass: "hover:border-secondary/40",
    iconBgClass: "bg-secondary-container/20 text-secondary group-hover:bg-secondary-container group-hover:text-on-secondary-container",
  },
  {
    id: "ocr",
    title: "الماسح الضوئي الذكي (Multi-Page OCR)",
    desc: "استخراج نصوص الأوراق والملازم وتدقيقها لغوياً ونحوياً بدقة عالية وتصدير ملف Word جاهز للطباعة والتحرير.",
    badge: "تدقيق لغوي ذكي",
    footerTag: "تصدير Word بخط 18pt",
    icon: "psychology",
    href: "/admin/ocr",
    colorClass: "text-tertiary",
    borderHoverClass: "hover:border-tertiary/40",
    iconBgClass: "bg-tertiary/10 text-tertiary group-hover:bg-tertiary group-hover:text-on-tertiary",
  },
  {
    id: "lan-transfer",
    title: "مركز النقل السريع الداخلي (LAN Transfer)",
    desc: "نقل فوري للملفات والملازم الكبيرة بين أجهزة المكتبة عبر كابل الشبكة المحلية أو الراوتر بدون استهلاك باقة الإنترنت وبسرعات خيالية.",
    badge: "0 استهلاك نت",
    footerTag: "سرعة كابل الشبكة القصوى",
    icon: "share",
    href: "/admin/lan-transfer",
    colorClass: "text-primary",
    borderHoverClass: "hover:border-primary/40",
    iconBgClass: "bg-surface-container-high text-on-surface group-hover:bg-surface-bright",
  },
  {
    id: "id-cards",
    title: "مصنع البطاقات والمستندات (A5)",
    desc: "قص وتجهيز بطاقات الرقم القومي، رخص القيادة، وشهادات الميلاد وش وظهر على ورقة A5 فورية بالألوان الطبيعية الأصلية 100%.",
    badge: "تصدير Word A5",
    footerTag: "ألوان طبيعية 100%",
    icon: "badge",
    href: "/admin/id-cards",
    colorClass: "text-primary",
    borderHoverClass: "hover:border-primary/40",
    iconBgClass: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary",
  },
  {
    id: "passport-photos",
    title: "استوديو الصور الشخصية (4x6)",
    desc: "عزل الخلفية تلقائياً، ضبط الرأس والكتفين بيومترياً، إزالة الظلال، ورص 8 صور بجودة عالية جاهزة للطابعة الملونة.",
    badge: "معيار بيومتري 4x6",
    footerTag: "رص 8 صور 4x6",
    icon: "photo_camera",
    href: "/admin/passport-photos",
    colorClass: "text-primary",
    borderHoverClass: "hover:border-primary/40",
    iconBgClass: "bg-surface-container-high text-primary group-hover:bg-primary group-hover:text-on-primary",
  },
  {
    id: "scanner",
    title: "ماسح المستندات وتوفير الحبر",
    desc: "قلب ألوان لقطات الشاشة الداكنة (Dark Mode Invert) وتبييض خلفية الورق الأصفر والظلال لتوفير الحبر الأسود مع نصوص عالية الحدة.",
    badge: "توفير 70% حبر",
    footerTag: "تبييض فوري ونقي",
    icon: "invert_colors",
    href: "/admin/scanner",
    colorClass: "text-primary",
    borderHoverClass: "hover:border-primary/40",
    iconBgClass: "bg-primary-container/20 text-primary group-hover:bg-primary-container group-hover:text-on-primary-container",
  },
  {
    id: "research",
    title: "مولد الأبحاث المدرسية والجامعية",
    desc: "صياغة وتنسيق الأبحاث A4 بهوامش ضيقة، فهارس ومراجع أكاديمية موثقة، غلاف رسمي للمدرسة أو الجامعة وتصدير Word جاهز فوراً.",
    badge: "أكاديمي معتمد",
    footerTag: "تنسيق Word A4 قياسي",
    icon: "auto_stories",
    href: "/admin/research",
    colorClass: "text-tertiary",
    borderHoverClass: "hover:border-tertiary/40",
    iconBgClass: "bg-tertiary/10 text-tertiary group-hover:bg-tertiary group-hover:text-on-tertiary",
  },
  {
    id: "shortcuts",
    title: "روابط وسيرفرات العمل اليومية",
    desc: "دليل الخدمات الحكومية، بوابات التنسيق والجامعات، منصات التقديم لوظائف المعلمين، ومواقع فحص وحساب التكلفة السريعة.",
    badge: "وصول سريع بضغطة زر",
    footerTag: "24 بوابة حكومية",
    icon: "language",
    href: "/admin/shortcuts",
    colorClass: "text-primary",
    borderHoverClass: "hover:border-primary/40",
    iconBgClass: "bg-surface-container-high text-on-surface group-hover:bg-surface-bright",
  },
  {
    id: "inventory",
    title: "إدارة المخزن والكتالوج (حصر)",
    desc: "متابعة رصيد باكتات الورق 70g و 80g، خراطيش الحبر، السلك الحلزوني، وتحديث فوري لأسعار التوريد والبيع للزبائن.",
    badge: "حصر المنتجات والمخزون",
    footerTag: "تحديث الأسعار والموردين",
    icon: "inventory",
    href: "/admin/inventory",
    colorClass: "text-primary",
    borderHoverClass: "hover:border-primary/40",
    iconBgClass: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary",
  },
  {
    id: "photos",
    title: "بنك ومكتبة صور المنتجات (Photo Pool)",
    desc: "مستودع يجمع صور صفحة فيسبوك والصور الملتقطة بكاميرا الهاتف لربط وتخصيص صور المنتجات والكتالوج في أي وقت بضغطة واحدة.",
    badge: "مكتبة صور متجددة",
    footerTag: "تصوير & ربط بالكتالوج",
    icon: "photo_library",
    href: "/admin/photos",
    colorClass: "text-emerald-500",
    borderHoverClass: "hover:border-emerald-500/40",
    iconBgClass: "bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white",
  },
  {
    id: "instapay",
    title: "سجل وتحويلات إنستا باي (InstaPay)",
    desc: "تسجيل تحويلات الزبائن بالاسم والهاتف والمبلغ لحين وصول الباشمهندس للمكتبة وتأكيد استلام المبالغ بحساب البنك بنقرة واحدة.",
    badge: "تأكيد فوري للتحويلات",
    footerTag: "تسجيل وتأكيد",
    icon: "credit_card",
    href: "/admin/instapay",
    colorClass: "text-purple-400",
    borderHoverClass: "hover:border-purple-500/40",
    iconBgClass: "bg-purple-500/10 text-purple-400 group-hover:bg-purple-600 group-hover:text-white",
  },
  {
    id: "fb-post-tools",
    title: "سحب بوستات وملازم فيسبوك PDF",
    desc: "ضع رابط أي منشور فيسبوك (مثلاً 80 صورة ملزمة أو مذكرة) لسحب كافة الصور بالترتيب ودمجها فوراً في ملف PDF عالي الدقة جاهز للطباعة.",
    badge: "سحب بوستات كاملة",
    footerTag: "دمج صفحات بالترتيب",
    icon: "picture_as_pdf",
    href: "/admin/fb-post-tools",
    colorClass: "text-blue-400",
    borderHoverClass: "hover:border-blue-500/40",
    iconBgClass: "bg-blue-500/10 text-blue-400 group-hover:bg-blue-600 group-hover:text-white",
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

  // إجمالي دخل الوردية الفعلي بدون إضافات وهمية
  const totalRevenueVal = tasks.reduce(
    (sum, t) => sum + ((Number(t.completedCopies) || Number(t.totalCopies) || 0) * 1.5),
    0
  );
  const shiftRevenue = totalRevenueVal.toLocaleString("ar-EG");
  const cashAmount = Math.round(totalRevenueVal * 0.75).toLocaleString("ar-EG");
  const walletAmount = Math.round(totalRevenueVal * 0.25).toLocaleString("ar-EG");

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

  const handleCopyWhatsappLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(WHATSAPP_LINK);
      toast.success("تم نسخ رابط الواتساب بنجاح!", WHATSAPP_LINK);
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
    <div className="flex flex-col w-full" dir="rtl">
      {/* Top Ambient Glow & Welcome Operations Banner */}
      <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-space-lg mb-space-md shadow-xl border border-surface-container-high/40">
        <div className="absolute -top-24 -left-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-20 right-1/4 w-72 h-72 bg-tertiary-container/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div className="flex flex-col gap-space-xs">
            <div className="flex flex-wrap items-center gap-space-xs">
              <span className="inline-flex items-center gap-1.5 px-space-sm py-space-2xs rounded-full bg-primary/10 text-primary font-label-tag text-label-tag tracking-wider border border-primary/20 font-bold">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                مكتبة ومطبعة كوبي كات
              </span>
              <span className="inline-flex items-center gap-1.5 px-space-sm py-space-2xs rounded-full bg-surface-container-high text-on-surface-variant font-body-xs text-xs border border-surface-container-highest">
                <span className="material-symbols-outlined text-sm text-primary">location_on</span>
                فرع الإسماعيلية — شارع الدقهلية
              </span>
            </div>
            <h1 className="font-display-sm text-display-sm text-on-surface font-extrabold tracking-tight">
              مركز العمليات ومطبعة كوبي كات
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl leading-relaxed">
              منصة إدارة أوردرات الطباعة وتسليم الشفت، استخراج النصوص، حاسبة الملازم، وأدوات المستندات الذكية.
            </p>
          </div>

          {/* Quick Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-space-sm self-start lg:self-center">
            {/* Direct PWA Install for Library Computer */}
            <button
              onClick={handleInstallPwa}
              className="flex items-center gap-space-xs px-space-md py-space-sm rounded-xl bg-linear-to-r from-emerald-600/20 to-teal-600/20 hover:from-emerald-600/30 hover:to-teal-600/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
              title="تثبيت لوحة الأدمن كتطبيق مستقل على كمبيوتر المكتبة (PWA) يفتح مباشرة على /admin"
            >
              <span className="material-symbols-outlined text-lg text-emerald-400">desktop_windows</span>
              <span>{isPwaInstalled ? "تطبيق الأدمن مثبت ✓" : "تثبيت أدمن المكتبة PWA 💻"}</span>
            </button>

            <Link
              href="/admin/calculator"
              className="flex items-center gap-space-xs px-space-md py-space-sm rounded-xl bg-primary-container text-on-primary-container font-headline-sm text-headline-sm hover:bg-primary transition-all shadow-md active:scale-95 font-bold"
            >
              <span className="material-symbols-outlined text-xl">calculate</span>
              <span>حاسبة الملازم والطباعة</span>
            </Link>
            <Link
              href="/admin/tasks"
              className="flex items-center gap-space-xs px-space-md py-space-sm rounded-xl bg-surface-container-highest text-primary font-headline-sm text-headline-sm hover:bg-surface-bright transition-all active:scale-95 font-bold"
            >
              <span className="material-symbols-outlined text-xl">assignment_turned_in</span>
              <span>مهام وأوردرات الشفت</span>
            </Link>
            <button
              onClick={() => setIsPreviewModalOpen(true)}
              className="flex items-center gap-space-xs px-space-md py-space-sm rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
              title="معاينة واجهة المتجر كما يراها العميل"
            >
              <span className="material-symbols-outlined text-lg text-cyan-400">preview</span>
              <span>معاينة واجهة الزبائن 👁️</span>
            </button>
          </div>
        </div>
      </div>

      {/* Announcement Banner Management Card */}
      <div className="rounded-xl bg-surface-container-low p-space-sm mb-space-lg border border-cyan-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-space-sm shadow-md">
        <div className="flex items-center gap-space-xs flex-1 w-full">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-lg">campaign</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-body-xs font-bold text-cyan-400">شريط إعلان وخصم المتجر العلوي (تحكم المدير):</span>
              <span className="text-[10px] text-on-surface-variant">يظهر أعلى متجر الزبائن مباشرة</span>
            </div>
            {isEditingBanner ? (
              <div className="flex items-center gap-2 mt-1 w-full">
                <input
                  type="text"
                  value={bannerInput}
                  onChange={(e) => setBannerInput(e.target.value)}
                  className="flex-1 bg-surface-container border border-surface-container-high rounded-lg px-2.5 py-1 text-xs text-on-surface focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={handleSaveBanner}
                  className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shrink-0 cursor-pointer"
                >
                  حفظ التعديل ✓
                </button>
                <button
                  onClick={() => setIsEditingBanner(false)}
                  className="px-2 py-1 rounded-lg text-xs text-on-surface-variant hover:text-on-surface cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            ) : (
              <p className="text-xs text-on-surface font-medium truncate mt-0.5">
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
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-cyan-400 text-xs font-bold shrink-0 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
            <span>تعديل جملة الخصم</span>
          </button>
        )}
      </div>

      {/* KPI Operational Metrics Grid (4 Top Metric Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md mb-space-lg">
        {/* Card 1: Active Orders */}
        <div className="flex flex-col justify-between p-space-md rounded-xl bg-surface-container-low shadow-md relative overflow-hidden border border-surface-container-high/40">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-body-sm text-body-sm text-on-surface-variant font-semibold">أوردرات اليوم النشطة</span>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-xl">receipt_long</span>
            </div>
          </div>
          <div className="flex items-baseline gap-space-xs mb-space-xs">
            <span className="font-display-hero text-display-hero text-on-surface font-extrabold tracking-tight">
              {activeOrdersCount}
            </span>
            <span className="font-label-code text-label-code text-primary">أوردر مسجل</span>
          </div>
          <div className="flex items-center justify-between pt-space-xs">
            <span className="inline-flex items-center gap-1 font-label-tag text-label-tag text-on-surface-variant">
              {inProgressCount > 0 ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
                  {inProgressCount} جاري تنفيذها بالماكينات
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm text-primary">done_all</span>
                  جميع الأوردرات مسجلة وجاهزة
                </>
              )}
            </span>
            <span className="font-label-code text-label-code px-space-xs py-space-2xs rounded bg-surface-container-high text-primary">
              {currentShift.label}
            </span>
          </div>
        </div>

        {/* Card 2: Printed Sheets Total */}
        <div className="flex flex-col justify-between p-space-md rounded-xl bg-surface-container-low shadow-md relative overflow-hidden border border-surface-container-high/40">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-body-sm text-body-sm text-on-surface-variant font-semibold">إجمالي النسخ المطبوعة اليوم</span>
            <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-xl">print</span>
            </div>
          </div>
          <div className="flex items-baseline gap-space-xs mb-space-xs">
            <span className="font-display-hero text-display-hero text-on-surface font-extrabold tracking-tight">
              {totalCopiesToday.toLocaleString("ar-EG")}
            </span>
            <span className="font-label-code text-label-code text-secondary">ورقة A4/A5</span>
          </div>
          <div className="flex items-center justify-between pt-space-xs">
            <span className="inline-flex items-center gap-1 font-label-tag text-label-tag text-secondary">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              {readyCount > 0 ? `${readyCount} أوردر جاهز للتسليم` : `${completedCount} أوردر مكتمل`}
            </span>
            <span className="font-label-code text-label-code text-on-surface-variant">{currentShift.label}</span>
          </div>
        </div>

        {/* Card 3: InstaPay Pending Transfers */}
        <Link
          href="/admin/instapay"
          className="group flex flex-col justify-between p-space-md rounded-xl bg-surface-container-low shadow-md relative overflow-hidden border border-surface-container-high/40 hover:border-purple-500/50 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-body-sm text-body-sm text-on-surface-variant font-semibold">تحويلات إنستا باي المعلقة</span>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <span className="material-symbols-outlined text-xl">credit_card</span>
            </div>
          </div>
          <div className="flex items-baseline gap-space-xs mb-space-xs">
            <span className="font-display-hero text-display-hero text-purple-400 font-extrabold tracking-tight">
              {getPendingInstaPaySummary().total.toLocaleString("ar-EG")}
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface">ج.م</span>
          </div>
          <div className="flex items-center justify-between pt-space-xs">
            <span className="font-label-tag text-label-tag text-amber-400 font-bold">
              {getPendingInstaPaySummary().count > 0 ? `${getPendingInstaPaySummary().count} بانتظار تأكيد الباشمهندس` : "لا توجد مبالغ معلقة"}
            </span>
            <span className="font-label-code text-label-code px-space-xs py-space-2xs rounded bg-surface-container-high text-purple-400 font-bold flex items-center gap-0.5">
              <span>فتح السجل</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </span>
          </div>
        </Link>

        {/* Card 4: Shift Completion & Progress */}
        <div className="flex flex-col justify-between p-space-md rounded-xl bg-surface-container-low shadow-md relative overflow-hidden border border-surface-container-high/40">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="font-body-sm text-body-sm text-on-surface-variant font-semibold">معدل إنجاز أوردرات الشفت</span>
            <div className="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-xl">donut_large</span>
            </div>
          </div>
          <div className="flex items-baseline gap-space-xs mb-space-xs">
            <span className="font-display-hero text-display-hero text-on-surface font-extrabold tracking-tight">
              {tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0}%
            </span>
            <span className="font-label-code text-label-code text-primary">
              {tasks.length > 0 ? `${completedCount} من ${tasks.length}` : "0 أوردر"}
            </span>
          </div>
          <div className="flex flex-col gap-1 pt-space-xs">
            <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 rounded-full"
                style={{ width: `${tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0}%` }}
              ></div>
            </div>
            <span className="font-label-code text-label-code text-on-surface-variant text-[10px]">
              {tasks.length > 0
                ? `${inProgressCount} أوردر جاري تنفيذه حالياً`
                : "جاهز لبدء استقبال أوردرات الشفت الجديدة"}
            </span>
          </div>
        </div>
      </div>

      {/* Header for Workstations Section */}
      <div className="flex items-center justify-between mb-space-md">
        <div className="flex items-center gap-space-xs">
          <span className="material-symbols-outlined text-primary text-2xl">grid_view</span>
          <h2 className="font-headline-md text-headline-md text-on-surface font-bold">جميع أدوات وماكينات العمل اليومية</h2>
          <span className="font-label-tag text-label-tag px-space-xs py-space-2xs rounded-lg bg-surface-container text-on-surface-variant font-bold">
            {WORKSTATION_TOOLS.length} أداة جاهزة للتشغيل الفوري
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-space-xs text-on-surface-variant font-body-xs text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          أدوات وماكينات الطباعة والتجهيز
        </div>
      </div>

      {/* The Dynamic Workstation Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-md mb-space-xl">
        {WORKSTATION_TOOLS.map((tool) => (
          <Link
            key={tool.id}
            href={tool.href}
            className={`group flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-low hover:bg-surface-container transition-all shadow-md border border-surface-container-high/40 ${tool.borderHoverClass}`}
          >
            <div>
              <div className="flex items-center justify-between mb-space-md">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${tool.iconBgClass}`}>
                  <span className="material-symbols-outlined text-2xl">{tool.icon}</span>
                </div>
                <span className={`font-label-code text-label-code px-space-xs py-space-2xs rounded-lg bg-surface-container-high ${tool.colorClass}`}>
                  {tool.badge}
                </span>
              </div>
              <h3 className={`font-headline-sm text-headline-sm text-on-surface group-hover:${tool.colorClass} transition-colors mb-space-xs font-bold`}>
                {tool.title}
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                {tool.desc}
              </p>
            </div>
            <div className="flex items-center justify-between pt-space-md mt-space-md border-t border-surface-container-high/40">
              <span className={`font-label-code text-label-code ${tool.colorClass} flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform font-bold`}>
                تشغيل الأداة
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </span>
              <span className="font-label-tag text-label-tag text-on-surface-variant">{tool.footerTag}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Shift Activity & Active Print Queue Table */}
      <div className="rounded-xl bg-surface-container-low p-space-lg shadow-xl mb-space-lg border border-surface-container-high/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm mb-space-md">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-primary text-2xl">hourglass_top</span>
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">أوردرات الشفت المباشرة وقائمة الانتظار</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">متابعة فورية للمهام قيد الطباعة والجاهزة للتسليم للزبائن والمدرسين</p>
            </div>
          </div>
          <div className="flex items-center gap-space-xs">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1 px-space-sm py-space-xs rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-body-sm text-body-sm transition-colors cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-base">refresh</span>
              <span>تحديث القائمة</span>
            </button>
            <Link
              href="/admin/tasks"
              className="flex items-center gap-1 px-space-sm py-space-xs rounded-xl bg-primary-container text-on-primary-container font-body-sm text-body-sm hover:bg-primary transition-colors font-bold"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>أوردر جديد</span>
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-surface-container text-on-surface-variant font-label-code text-label-code">
                <th className="p-space-sm rounded-r-xl">رقم الأوردر</th>
                <th className="p-space-sm">اسم العميل / المدرس</th>
                <th className="p-space-sm">تفاصيل المهمة</th>
                <th className="p-space-sm text-left">الكمية</th>
                <th className="p-space-sm text-left">الحالة</th>
                <th className="p-space-sm text-center rounded-l-xl">إجراءات سريعة</th>
              </tr>
            </thead>
            <tbody className="divide-y-0 text-on-surface font-body-sm text-body-sm">
              {tasks.slice(0, 5).map((task) => (
                <tr key={task.id} className="hover:bg-surface-container-high/40 transition-colors border-b border-surface-container/60">
                  <td className="p-space-sm font-label-code text-label-code text-primary font-bold">
                    #{task.id}
                  </td>
                  <td className="p-space-sm font-semibold">{task.customerName}</td>
                  <td className="p-space-sm text-on-surface-variant max-w-xs truncate">{task.title}</td>
                  <td className="p-space-sm text-left font-label-code text-label-code">
                    {task.completedCopies ? `${task.completedCopies} / ` : ""}{task.totalCopies} نسخة
                  </td>
                  <td className="p-space-sm text-left">
                    {task.status === "in_progress" ? (
                      <span className="inline-flex items-center gap-1 px-space-xs py-space-2xs rounded-full bg-primary/10 text-primary font-label-tag text-label-tag">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
                        جاري التنفيذ
                      </span>
                    ) : task.status === "ready" ? (
                      <span className="inline-flex items-center gap-1 px-space-xs py-space-2xs rounded-full bg-surface-container-highest text-secondary font-label-tag text-label-tag">
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                        جاهز للتسليم
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-space-xs py-space-2xs rounded-full bg-surface-container-highest text-on-surface-variant font-label-tag text-label-tag">
                        تم التسليم
                      </span>
                    )}
                  </td>
                  <td className="p-space-sm text-center">
                    <div className="flex items-center justify-center gap-space-2xs">
                      {task.phone && (
                        <a
                          className="p-space-xs rounded-lg bg-surface-container hover:bg-surface-bright text-primary transition-colors cursor-pointer"
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
                        className="p-space-xs rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface transition-colors cursor-pointer"
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
      <div className="flex flex-col md:flex-row items-center justify-between p-space-sm rounded-xl bg-surface-container-low text-on-surface-variant font-body-xs text-xs gap-space-xs border border-surface-container-high/40">
        <div className="flex items-center gap-space-md flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-on-surface font-semibold">حالة النظام:</span>
            <span className="text-emerald-400 font-bold">جاهز ومستعد للعمل</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-base">schedule</span>
            <span>الوردية: {currentShift.label} ({currentShift.timeRange})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-secondary text-base">person</span>
            <span>المسؤول: {user?.name || "مشرف الشفت"}</span>
          </div>
        </div>
        <div className="flex items-center gap-space-xs">
          <span className="text-on-surface-variant font-medium text-[11px]">
            شارع الدقهلية بالقرب من مسجد المطافي أمام مركز نور الحياة - عرايشية مصر - الإسماعيلية
          </span>
        </div>
      </div>

      {/* Modal: Printable WhatsApp QR Stand / Wall Poster */}
      {printQrModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-2xl my-auto flex flex-col items-center">
            {/* Control Bar (Screen Only) */}
            <div className="w-full flex items-center justify-between p-3 mb-3 bg-surface-container-low border border-surface-container-high rounded-xl text-on-surface shadow-xl print:hidden">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-xl">print</span>
                <span className="font-bold text-xs">
                  {printQrModal === "stand" ? "معاينة استند طاولة الكاشير (A5)" : "معاينة بوستر حائط المحل (A4)"}
                </span>
                <div className="flex items-center bg-surface-container rounded-lg p-0.5 border border-surface-container-high mr-2">
                  <button
                    onClick={() => setPrintQrModal("stand")}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                      printQrModal === "stand" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    استند طاولة (A5)
                  </button>
                  <button
                    onClick={() => setPrintQrModal("poster")}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                      printQrModal === "poster" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    بوستر حائط (A4)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">print</span>
                  <span>طباعة فورية (Ctrl+P)</span>
                </button>
                <button
                  onClick={() => setPrintQrModal(null)}
                  className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-6xl h-[92vh] bg-surface rounded-2xl border border-surface-container-high shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-surface-container-low border-b border-surface-container-high shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">storefront</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface">معاينة واجهة متجر الزبائن الحية</h3>
                  <p className="text-xs text-on-surface-variant">شاهد كيف تبدو العروض والأسعار والمنتجات للعميل الآن</p>
                </div>
              </div>

              {/* View Controls & Close */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex items-center bg-surface-container rounded-xl p-1 border border-surface-container-high">
                  <button
                    onClick={() => setPreviewDevice("desktop")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      previewDevice === "desktop"
                        ? "bg-primary text-on-primary shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">laptop</span>
                    <span className="hidden sm:inline">كمبيوتر</span>
                  </button>
                  <button
                    onClick={() => setPreviewDevice("mobile")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                      previewDevice === "mobile"
                        ? "bg-primary text-on-primary shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface"
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
                  className="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-bright text-xs font-bold text-on-surface flex items-center gap-1.5 transition"
                  title="فتح في نافذة متصفح جديدة"
                >
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  <span className="hidden sm:inline">نافذة جديدة</span>
                </a>

                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="w-9 h-9 rounded-xl bg-surface-container-high hover:bg-red-500/20 hover:text-red-400 text-on-surface-variant flex items-center justify-center transition cursor-pointer"
                  title="إغلاق المعاينة"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
            </div>

            {/* Modal Body / Iframe Container */}
            <div className="flex-1 bg-neutral-900/60 p-2 sm:p-4 flex items-center justify-center overflow-auto">
              <div
                className={`transition-all duration-300 h-full shadow-2xl overflow-hidden rounded-xl border border-surface-container-high bg-surface ${
                  previewDevice === "mobile"
                    ? "w-[390px] max-w-full rounded-3xl border-4 border-neutral-700"
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
