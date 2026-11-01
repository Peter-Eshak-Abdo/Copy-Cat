"use client";

import React, { useState, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/toast-provider";
import {
  LayoutGrid,
  ChevronUp,
  BarChart3,
  RotateCcw,
  Printer,
  Eye,
  MapPin,
  Monitor,
  Calculator,
  ClipboardCheck,
  Megaphone,
  Edit2,
  Receipt,
  CheckCheck,
  CheckCircle2,
  CreditCard,
  ArrowLeft,
  PieChart,
  GripVertical,
  Store,
  Laptop,
  Smartphone,
  ExternalLink,
  X,
  FileText,
  ScanText,
  Share2,
  Contact,
  Camera,
  Sliders,
  GraduationCap,
  Globe,
  Package,
  Images,
  Download,
} from "lucide-react";

function renderToolIcon(toolId: string, className: string = "w-8 h-8 sm:w-9 sm:h-9") {
  switch (toolId) {
    case "calculator":
      return <Calculator className={className} />;
    case "tasks":
      return <ClipboardCheck className={className} />;
    case "pdf-tools":
      return <FileText className={className} />;
    case "ocr":
      return <ScanText className={className} />;
    case "lan-transfer":
      return <Share2 className={className} />;
    case "id-cards":
      return <Contact className={className} />;
    case "passport-photos":
      return <Camera className={className} />;
    case "scanner":
      return <Sliders className={className} />;
    case "research":
      return <GraduationCap className={className} />;
    case "shortcuts":
      return <Globe className={className} />;
    case "inventory":
      return <Package className={className} />;
    case "photos":
      return <Images className={className} />;
    case "instapay":
      return <CreditCard className={className} />;
    case "fb-post-tools":
      return <Download className={className} />;
    default:
      return <LayoutGrid className={className} />;
  }
}

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
      label: "شيفت الصبح",
      timeRange: "08:30 ص - 04:00 م",
    };
  }

  // من 4:00 عصراً حتى 11:30 مساءً = شفت مسائي
  return {
    id: "evening",
    label: "شيفت بالليل",
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
    title: "حاسبة سعر الملازم",
    desc: "بتحسب سعر الملزمة (وش وضهر) والتجليد والسلوفان، وفيها آلة حاسبة عادية.",
    badge: "وش وضهر",
    footerTag: "بأسعار المكتبة",
    icon: "calculate",
    href: "/admin/calculator",
    colorClass: "text-blue-600",
    borderHoverClass: "hover:border-blue-400 hover:shadow-md",
    iconBgClass: "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white",
  },
  // {
  //   id: "tasks",
  //   title: "أوردرات الطباعة وتسليم الشفت",
  //   desc: "متابعة أوردرات وملازم المدرسين، عداد النسخ المطبوعة الحي، مراسلة واتساب فورية، وتوليد تقرير تسليم الشفت بضغطة واحدة.",
  //   badge: "مراسلة واتساب فورية",
  //   footerTag: "تقرير شفت متكامل",
  //   icon: "task_alt",
  //   href: "/admin/tasks",
  //   colorClass: "text-indigo-600",
  //   borderHoverClass: "hover:border-indigo-400 hover:shadow-md",
  //   iconBgClass: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white",
  // },
  {
    id: "pdf-tools",
    title: "أدوات PDF",
    desc: "امسح صفحات من الملزمة، جمّع صور في ملف PDF، وحوّل PDF عربي لـ Word.",
    badge: "من غير نت",
    footerTag: "مسح صفحات وصور لـ PDF",
    icon: "picture_as_pdf",
    href: "/admin/pdf-tools",
    colorClass: "text-rose-600",
    borderHoverClass: "hover:border-rose-400 hover:shadow-md",
    iconBgClass: "bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white",
  },
  {
    id: "ocr",
    title: "صورة لـ Word (OCR)",
    desc: "صوّر الورقة (مطبوعة أو بخط الإيد) وهتطلعلك ملف Word بنفس الشكل والجداول، حتى لو الصورة بالعرض أو مقلوبة.",
    badge: "مطبوع وخط إيد",
    footerTag: "بيطلع Word",
    icon: "psychology",
    href: "/admin/ocr",
    colorClass: "text-amber-600",
    borderHoverClass: "hover:border-amber-400 hover:shadow-md",
    iconBgClass: "bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white",
  },
  {
    id: "lan-transfer",
    title: "نقل ملفات بين الأجهزة",
    desc: "ابعت الملفات الكبيرة بين أجهزة المكتبة على نفس الراوتر من غير ما تصرف من باقة النت.",
    badge: "من غير باقة",
    footerTag: "سريع جداً",
    icon: "share",
    href: "/admin/lan-transfer",
    colorClass: "text-cyan-600",
    borderHoverClass: "hover:border-cyan-400 hover:shadow-md",
    iconBgClass: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white",
  },
  {
    id: "id-cards",
    title: "البطايق (وش وضهر)",
    desc: "ارفع صور البطايق بأي ترتيب، وهو يقصها ويعدلها ويحط كل وش مع ضهره بالرقم القومي في ورقة جاهزة للطباعة.",
    badge: "Word A4 / A5",
    footerTag: "وش مع ضهره",
    icon: "badge",
    href: "/admin/id-cards",
    colorClass: "text-emerald-600",
    borderHoverClass: "hover:border-emerald-400 hover:shadow-md",
    iconBgClass: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white",
  },
  {
    id: "passport-photos",
    title: "الصور الشخصية 4×6",
    desc: "بيشيل الخلفية ويخليها بيضا، ويظبط الراس والكتاف، ويرص الصور في ورقة جاهزة للطباعة.",
    badge: "مقاس 4×6",
    footerTag: "4 أو 9 صور في الورقة",
    icon: "photo_camera",
    href: "/admin/passport-photos",
    colorClass: "text-sky-600",
    borderHoverClass: "hover:border-sky-400 hover:shadow-md",
    iconBgClass: "bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white",
  },
  {
    id: "scanner",
    title: "سكانر وتوفير الحبر",
    desc: "بيقلب الشاشات السودا لأبيض، وبيبيّض الورق الأصفر ويشيل الضل عشان الطباعة متصرفش حبر.",
    badge: "حبر أقل",
    footerTag: "تبييض الورق",
    icon: "invert_colors",
    href: "/admin/scanner",
    colorClass: "text-teal-600",
    borderHoverClass: "hover:border-teal-400 hover:shadow-md",
    iconBgClass: "bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white",
  },
  {
    id: "research",
    title: "عمل الأبحاث",
    desc: "اكتب عنوان البحث، وهيطلعلك ملف Word فيه غلاف وفهرس ومراجع جاهز للطباعة. تقدر تطلب كذا نسخة مختلفة.",
    badge: "لحد 15 نسخة",
    footerTag: "Word مقاس A4",
    icon: "auto_stories",
    href: "/admin/research",
    colorClass: "text-purple-600",
    borderHoverClass: "hover:border-purple-400 hover:shadow-md",
    iconBgClass: "bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white",
  },
  {
    id: "shortcuts",
    title: "مواقع بنستخدمها كل يوم",
    desc: "روابط المواقع الحكومية والتنسيق والجامعات والتقديم على الوظايف.",
    badge: "بدوسة واحدة",
    footerTag: "24 موقع",
    icon: "language",
    href: "/admin/shortcuts",
    colorClass: "text-slate-600",
    borderHoverClass: "hover:border-slate-400 hover:shadow-md",
    iconBgClass: "bg-slate-100 text-slate-700 group-hover:bg-slate-800 group-hover:text-white",
  },
  {
    id: "inventory",
    title: "المخزن والأسعار",
    desc: "تابع الورق والحبر والسلك اللي في المخزن، وغيّر أسعار الشرا والبيع.",
    badge: "جرد المخزن",
    footerTag: "الأسعار والموردين",
    icon: "inventory",
    href: "/admin/inventory",
    colorClass: "text-emerald-700",
    borderHoverClass: "hover:border-emerald-500 hover:shadow-md",
    iconBgClass: "bg-emerald-50 text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white",
  },
  {
    id: "photos",
    title: "صور المنتجات",
    desc: "كل صور المنتجات من صفحة فيسبوك ومن كاميرا الموبايل في مكان واحد، وتقدر تحط أي صورة لأي منتج.",
    badge: "كل الصور",
    footerTag: "صوّر واربط بالمنتج",
    icon: "photo_library",
    href: "/admin/photos",
    colorClass: "text-emerald-600",
    borderHoverClass: "hover:border-emerald-400 hover:shadow-md",
    iconBgClass: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white",
  },
  {
    id: "instapay",
    title: "تحويلات إنستا باي",
    desc: "سجّل تحويل الزبون (الاسم والرقم والمبلغ) لحد ما الباشمهندس يتأكد إن الفلوس وصلت.",
    badge: "متابعة التحويلات",
    footerTag: "سجّل وأكّد",
    icon: "credit_card",
    href: "/admin/instapay",
    colorClass: "text-violet-600",
    borderHoverClass: "hover:border-violet-400 hover:shadow-md",
    iconBgClass: "bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white",
  },
  {
    id: "fb-post-tools",
    title: "ملازم فيسبوك لـ PDF",
    desc: "الزق رابط بوست فيسبوك عام فيه صور ملزمة، أو ارفع الصور بنفسك، وهتتجمع بالترتيب في ملف PDF.",
    badge: "بوست كامل",
    footerTag: "بالترتيب",
    icon: "picture_as_pdf",
    href: "/admin/fb-post-tools",
    colorClass: "text-blue-600",
    borderHoverClass: "hover:border-blue-400 hover:shadow-md",
    iconBgClass: "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white",
  },
];

export default function AdminDashboardPage() {
  useAuth();
  const toast = useToast();
  const tasks = useSyncExternalStore(subscribeTasks, getTasksSnapshot, getTasksServerSnapshot);

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
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Collapsible top section (collapsed by default for ultra simplicity)
  const [showOverview, setShowOverview] = useState(false);

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

  // Shift & Real metrics calculations
  const currentShift = getCurrentShift();
  const activeOrdersCount = tasks.filter((t) => t.status === "in_progress" || t.status === "pending").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const readyCount = tasks.filter((t) => t.status === "ready").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;

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

  const handleSaveBanner = () => {
    if (!bannerInput.trim()) return;
    localStorage.setItem("copycat_announcement_banner", bannerInput.trim());
    setBannerText(bannerInput.trim());
    setIsEditingBanner(false);
    toast.success("الإعلان اتغير", "الكلام الجديد هيظهر فوق في صفحة الزباين.");
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
            <p className="text-xs sm:text-sm text-slate-500 font-semibold mt-0.5">
              💡 تقدر تسحب أي أداة وتحطها في المكان اللي يريحك
            </p>
          </div>
        </div>

        {/* Header Controls: Collapsible Overview Toggle & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowOverview(!showOverview)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all border cursor-pointer ${
              showOverview
                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300/80"
            }`}
          >
            {showOverview ? <ChevronUp className="w-4 h-4" /> : <BarChart3 className="w-4 h-4" />}
            <span>{showOverview ? "خبّي ملخص الشيفت ▲" : "وريني ملخص الشيفت ▼"}</span>
            {activeOrdersCount > 0 && !showOverview && (
              <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs font-bold mr-1">
                {activeOrdersCount} أوردر
              </span>
            )}
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
      {showOverview && (
        <div className="flex flex-col space-y-5 animate-in fade-in slide-in-from-top-4 duration-300">
          {/* Operations Welcome Banner */}
          <div className="rounded-2xl sm:rounded-3xl bg-white p-6 shadow-xs border-2 border-slate-200">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200/60">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                    مكتبة ومطبعة كوبي كات
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs border border-slate-200">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    فرع الإسماعيلية — شارع الدقهلية
                  </span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  أدوات مكتبة كوبي كات
                </h2>
                <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
                  كل اللي محتاجه في الشغل: الأوردرات، تسليم الشيفت، صورة لـ Word، حاسبة الملازم، البطايق والصور.
                </p>
              </div>

              {/* Quick Header Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
                <button
                  onClick={handleInstallPwa}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs transition cursor-pointer"
                  title="ثبّت صفحة الأدمن كبرنامج على الكمبيوتر"
                >
                  <Monitor className="w-4 h-4 text-emerald-600" />
                  <span>{isPwaInstalled ? "البرنامج متثبت ✓" : "ثبّت كبرنامج"}</span>
                </button>

                <Link
                  href="/admin/calculator"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-xs"
                >
                  <Calculator className="w-4 h-4" />
                  <span>حاسبة الملازم</span>
                </Link>
                <Link
                  href="/admin/tasks"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition border border-slate-200"
                >
                  <ClipboardCheck className="w-4 h-4 text-slate-600" />
                  <span>أوردرات الشيفت</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Announcement Banner Management Card */}
          <div className="rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-5 border-2 border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 w-full">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                <Megaphone className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-slate-900">الإعلان اللي فوق في صفحة الزباين:</span>
                  <span className="text-xs text-slate-400">بيظهر أول حاجة للزبون</span>
                </div>
                {isEditingBanner ? (
                  <div className="flex items-center gap-2 mt-2 w-full">
                    <input
                      type="text"
                      value={bannerInput}
                      onChange={(e) => setBannerInput(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                    />
                    <button
                      onClick={handleSaveBanner}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shrink-0 cursor-pointer"
                    >
                      احفظ ✓
                    </button>
                    <button
                      onClick={() => setIsEditingBanner(false)}
                      className="px-3 py-2 rounded-xl text-xs sm:text-sm text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-slate-600 font-medium truncate mt-0.5">
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
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold shrink-0 transition cursor-pointer"
              >
                <Edit2 className="w-4 h-4" />
                <span>غيّر الإعلان</span>
              </button>
            )}
          </div>

          {/* KPI Operational Metrics Grid (4 Clean Metric Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Card 1: Active Orders */}
            <div className="flex flex-col justify-between p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500">أوردرات النهارده الشغالة</span>
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                  <Receipt className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {activeOrdersCount}
                </span>
                <span className="text-xs font-bold text-blue-600">أوردر</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  {inProgressCount > 0 ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span>
                      {inProgressCount} شغالين على المكن
                    </>
                  ) : (
                    <>
                      <CheckCheck className="w-4 h-4 text-emerald-600" />
                      كل الأوردرات متسجلة
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
                <span className="text-xs font-semibold text-slate-500">اتطبع النهارده</span>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                  <Printer className="w-5 h-5 text-indigo-600" />
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
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {readyCount > 0 ? `${readyCount} أوردر جاهز يتسلم` : `${completedCount} أوردر خلص`}
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
                <span className="text-xs font-semibold text-slate-500">تحويلات إنستا باي لسه متأكدتش</span>
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors border border-violet-100">
                  <CreditCard className="w-5 h-5 text-violet-600" />
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
                  {getPendingInstaPaySummary().count > 0 ? `${getPendingInstaPaySummary().count} مستنيين تأكيد` : "مفيش فلوس مستنية"}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-bold flex items-center gap-0.5">
                  <span>افتح السجل</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>

            {/* Card 4: Shift Completion & Progress */}
            <div className="flex flex-col justify-between p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500">أوردرات الشيفت اللي خلصت</span>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                  <PieChart className="w-5 h-5 text-emerald-600" />
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
                    ? `${inProgressCount} أوردر شغالين فيه دلوقتي`
                    : "جاهز لأوردرات الشيفت"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* The Dynamic Workstation Cards Grid with Drag & Drop Reordering */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6">
        {tools.map((tool, index) => {
          const isDragging = draggedIndex === index;
          const isOver = dragOverIndex === index;

          return (
            <div
              key={tool.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`relative transition-all duration-200 ${
                isDragging ? "opacity-35 scale-95" : ""
              } ${isOver ? "ring-4 ring-blue-500/40 rounded-3xl scale-[1.02]" : ""}`}
            >
              <Link
                href={tool.href}
                className={`group flex flex-col justify-between p-6 sm:p-7 rounded-2xl sm:rounded-3xl bg-white hover:bg-slate-50/90 transition-all shadow-xs border-2 border-slate-200/90 hover:border-blue-500 hover:shadow-xl ${tool.borderHoverClass} h-full`}
              >
                <div>
                  {/* Top Row: Icon, Badge, Drag Handle */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-colors shadow-xs ${tool.iconBgClass}`}
                      >
                        {renderToolIcon(tool.id)}
                      </div>
                      <span className="text-xs sm:text-sm font-extrabold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {tool.badge}
                      </span>
                    </div>

                    {/* Drag Handle Indicator */}
                    <div
                      className="p-1.5 rounded-xl text-slate-300 group-hover:text-slate-500 hover:bg-slate-100 cursor-grab active:cursor-grabbing transition-colors"
                      title="اسحب الأداة عشان تغير مكانها"
                      onClick={(e) => e.preventDefault()}
                    >
                      <GripVertical className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Card Title (Large & Bold) */}
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 group-hover:text-blue-600 transition-colors mb-2.5 leading-snug">
                    {tool.title}
                  </h2>

                  {/* Card Description (Enlarged & Easy to read) */}
                  <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
                    {tool.desc}
                  </p>
                </div>

                {/* Footer Action Button */}
                <div className="flex items-center justify-between pt-4 mt-5 border-t border-slate-100">
                  <span
                    className={`text-sm sm:text-base font-black ${tool.colorClass} flex items-center gap-1.5 group-hover:translate-x-[-4px] transition-transform`}
                  >
                    افتح
                    <ArrowLeft className="w-4 h-4" />
                  </span>
                  <span className="text-xs sm:text-sm text-slate-400 font-bold">{tool.footerTag}</span>
                </div>
              </Link>
            </div>
          );
        })}
      </div>

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
