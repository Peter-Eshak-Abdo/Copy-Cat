import type { LucideIcon } from "lucide-react";
import {
  Calculator,
  Contact,
  CreditCard,
  FileText,
  Globe,
  GraduationCap,
  Camera,
  Images,
  Package,
  ScanText,
  Share2,
  Sliders,
  Download,
  MousePointerClick,
  History,
} from "lucide-react";

/**
 * One list of admin tools, used by the dashboard cards, the top-bar breadcrumb and the Ctrl+K switcher,
 * so a tool's name and icon are the same everywhere. Tailwind classes are written out in full here
 * (not built from a colour name) so the Tailwind scanner sees them.
 */
export interface AdminTool {
  id: string;
  title: string;
  /** Short name for the top bar and the switcher */
  short: string;
  desc: string;
  badge: string;
  footerTag: string;
  href: string;
  icon: LucideIcon;
  /** Extra words the switcher search matches (English names, common misspellings) */
  keywords: string;
  group: "docs" | "photos" | "shop";
  /** Text colour for the "open" link */
  accent: string;
  /** Icon tile, idle + on card hover */
  iconTile: string;
  /** Small solid tile used in the top bar / switcher */
  solidTile: string;
  /** Card border colour on hover */
  hoverBorder: string;
  /** Tool is built but hidden from the dashboard */
  hidden?: boolean;
  /** Only the engineer (admin account) sees it */
  adminOnly?: boolean;
}

export const TOOL_GROUPS: { id: AdminTool["group"]; label: string }[] = [
  { id: "docs", label: "ورق وملفات" },
  { id: "photos", label: "صور وبطايق" },
  { id: "shop", label: "المحل والحسابات" },
];

export const ADMIN_TOOLS: AdminTool[] = [
  {
    id: "calculator",
    title: "حاسبة سعر الملازم",
    short: "حاسبة الملازم",
    desc: "بتحسب سعر الملزمة (وش وضهر) والتجليد والسلوفان، وفيها آلة حاسبة عادية.",
    badge: "وش وضهر",
    footerTag: "بأسعار المكتبة",
    href: "/admin/calculator",
    icon: Calculator,
    keywords: "calculator سعر حساب ملزمة طباعة تجليد",
    group: "shop",
    accent: "text-blue-600",
    iconTile: "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white",
    solidTile: "bg-blue-600 text-white",
    hoverBorder: "hover:border-blue-400",
  },
  {
    id: "pdf-tools",
    title: "أدوات PDF",
    short: "أدوات PDF",
    desc: "امسح صفحات من الملزمة، جمّع صور في ملف PDF، وحوّل PDF عربي لـ Word.",
    badge: "من غير نت",
    footerTag: "مسح صفحات وصور لـ PDF",
    href: "/admin/pdf-tools",
    icon: FileText,
    keywords: "pdf بي دي اف دمج مسح صفحات ضغط",
    group: "docs",
    accent: "text-rose-600",
    iconTile: "bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white",
    solidTile: "bg-rose-600 text-white",
    hoverBorder: "hover:border-rose-400",
  },
  {
    id: "ocr",
    title: "صورة لـ Word (OCR)",
    short: "صورة لـ Word",
    desc: "صوّر الورقة (مطبوعة أو بخط الإيد) وهتطلعلك ملف Word بنفس الشكل والجداول، حتى لو الصورة بالعرض أو مقلوبة.",
    badge: "مطبوع وخط إيد",
    footerTag: "بيطلع Word",
    href: "/admin/ocr",
    icon: ScanText,
    keywords: "ocr word وورد كتابة تفريغ",
    group: "docs",
    accent: "text-amber-600",
    iconTile: "bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white",
    solidTile: "bg-amber-500 text-white",
    hoverBorder: "hover:border-amber-400",
  },
  {
    id: "word-picker",
    title: "نسخ الكلمات العربي من صورة",
    short: "نسخ الكلمات",
    desc: "ارفع صورة صفحة الكلمات، وهيطلع زرار على كل كلمة عربي: دوسة واحدة تتنسخ وتلزقها في جدول Word.",
    badge: "دوسة وتتنسخ",
    footerTag: "شيتات المدارس",
    href: "/admin/word-picker",
    icon: MousePointerClick,
    keywords: "words copy كلمات نسخ شيت مدرسة جدول",
    group: "docs",
    accent: "text-orange-600",
    iconTile: "bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white",
    solidTile: "bg-orange-600 text-white",
    hoverBorder: "hover:border-orange-400",
  },
  {
    id: "lan-transfer",
    title: "نقل ملفات بين الأجهزة",
    short: "نقل ملفات",
    desc: "ابعت الملفات الكبيرة بين أجهزة المكتبة على نفس الراوتر من غير ما تصرف من باقة النت.",
    badge: "من غير باقة",
    footerTag: "سريع جداً",
    href: "/admin/lan-transfer",
    icon: Share2,
    keywords: "lan transfer نقل ملفات شبكة راوتر",
    group: "docs",
    accent: "text-cyan-600",
    iconTile: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white",
    solidTile: "bg-cyan-600 text-white",
    hoverBorder: "hover:border-cyan-400",
  },
  {
    id: "id-cards",
    title: "البطايق (وش وضهر)",
    short: "البطايق",
    desc: "ارفع صور البطايق بأي ترتيب، وهو يقصها ويعدلها ويحط كل وش مع ضهره بالرقم القومي في ورقة جاهزة للطباعة.",
    badge: "Word A4 / A5",
    footerTag: "وش مع ضهره",
    href: "/admin/id-cards",
    icon: Contact,
    keywords: "id card بطاقة بطايق رقم قومي",
    group: "photos",
    accent: "text-emerald-600",
    iconTile: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white",
    solidTile: "bg-emerald-600 text-white",
    hoverBorder: "hover:border-emerald-400",
  },
  {
    id: "passport-photos",
    title: "الصور الشخصية 4×6",
    short: "الصور الشخصية",
    desc: "بيشيل الخلفية ويخليها بيضا، ويظبط الراس والكتاف، ويرص الصور في ورقة جاهزة للطباعة.",
    badge: "مقاس 4×6",
    footerTag: "4 أو 9 صور في الورقة",
    href: "/admin/passport-photos",
    icon: Camera,
    keywords: "passport photo صورة شخصية 4x6 خلفية",
    group: "photos",
    accent: "text-sky-600",
    iconTile: "bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white",
    solidTile: "bg-sky-600 text-white",
    hoverBorder: "hover:border-sky-400",
  },
  {
    id: "scanner",
    title: "سكانر وتوفير الحبر",
    short: "سكانر وتوفير الحبر",
    desc: "بيقلب الشاشات السودا لأبيض، وبيبيّض الورق الأصفر ويشيل الضل عشان الطباعة متصرفش حبر.",
    badge: "حبر أقل",
    footerTag: "تبييض الورق",
    href: "/admin/scanner",
    icon: Sliders,
    keywords: "scanner سكانر حبر تبييض فلتر",
    group: "photos",
    accent: "text-teal-600",
    iconTile: "bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white",
    solidTile: "bg-teal-600 text-white",
    hoverBorder: "hover:border-teal-400",
  },
  {
    id: "research",
    title: "عمل الأبحاث",
    short: "الأبحاث",
    desc: "اكتب عنوان البحث، وهيطلعلك ملف Word فيه غلاف وفهرس ومراجع جاهز للطباعة. تقدر تطلب كذا نسخة مختلفة.",
    badge: "لحد 15 نسخة",
    footerTag: "Word مقاس A4",
    href: "/admin/research",
    icon: GraduationCap,
    keywords: "research بحث ابحاث جامعة",
    group: "docs",
    accent: "text-purple-600",
    iconTile: "bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white",
    solidTile: "bg-purple-600 text-white",
    hoverBorder: "hover:border-purple-400",
  },
  {
    id: "fb-post-tools",
    title: "ملازم فيسبوك لـ PDF",
    short: "ملازم فيسبوك",
    desc: "الزق رابط بوست فيسبوك عام فيه صور ملزمة، أو ارفع الصور بنفسك، وهتتجمع بالترتيب في ملف PDF.",
    badge: "بوست كامل",
    footerTag: "بالترتيب",
    href: "/admin/fb-post-tools",
    icon: Download,
    keywords: "facebook فيسبوك فيس بوست ملزمة pdf",
    group: "docs",
    accent: "text-blue-600",
    iconTile: "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white",
    solidTile: "bg-blue-600 text-white",
    hoverBorder: "hover:border-blue-400",
  },
  {
    id: "shortcuts",
    title: "مواقع بنستخدمها كل يوم",
    short: "المواقع",
    desc: "روابط المواقع الحكومية والتنسيق والجامعات والتقديم على الوظايف.",
    badge: "بدوسة واحدة",
    footerTag: "روابط سريعة",
    href: "/admin/shortcuts",
    icon: Globe,
    keywords: "shortcuts links مواقع روابط حكومة تنسيق",
    group: "shop",
    accent: "text-slate-700",
    iconTile: "bg-slate-100 text-slate-700 group-hover:bg-slate-800 group-hover:text-white",
    solidTile: "bg-slate-800 text-white",
    hoverBorder: "hover:border-slate-400",
  },
  {
    id: "inventory",
    title: "المخزن والأسعار",
    short: "المخزن",
    desc: "تابع الورق والحبر والسلك اللي في المخزن، وغيّر أسعار الشرا والبيع.",
    badge: "جرد المخزن",
    footerTag: "الأسعار والموردين",
    href: "/admin/inventory",
    icon: Package,
    keywords: "inventory مخزن منتجات اسعار جرد",
    group: "shop",
    accent: "text-emerald-700",
    iconTile: "bg-emerald-50 text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white",
    solidTile: "bg-emerald-700 text-white",
    hoverBorder: "hover:border-emerald-500",
  },
  {
    id: "photos",
    title: "صور المنتجات",
    short: "صور المنتجات",
    desc: "كل صور المنتجات من صفحة فيسبوك ومن كاميرا الموبايل في مكان واحد، وتقدر تحط أي صورة لأي منتج.",
    badge: "كل الصور",
    footerTag: "صوّر واربط بالمنتج",
    href: "/admin/photos",
    icon: Images,
    keywords: "photos صور منتجات كاميرا",
    group: "shop",
    accent: "text-lime-700",
    iconTile: "bg-lime-50 text-lime-700 group-hover:bg-lime-600 group-hover:text-white",
    solidTile: "bg-lime-600 text-white",
    hoverBorder: "hover:border-lime-400",
  },
  {
    id: "instapay",
    title: "تحويلات إنستا باي",
    short: "إنستا باي",
    desc: "سجّل تحويل الزبون (الاسم والرقم والمبلغ) لحد ما الباشمهندس يتأكد إن الفلوس وصلت.",
    badge: "متابعة التحويلات",
    footerTag: "سجّل وأكّد",
    href: "/admin/instapay",
    icon: CreditCard,
    keywords: "instapay انستا باي تحويل فلوس",
    group: "shop",
    accent: "text-violet-600",
    iconTile: "bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white",
    solidTile: "bg-violet-600 text-white",
    hoverBorder: "hover:border-violet-400",
  },
];

ADMIN_TOOLS.push({
  id: "activity",
  title: "سجل التعديلات",
  short: "سجل التعديلات",
  desc: "مين غيّر إيه في المنتجات والأسعار والتحويلات في آخر 30 يوم، وترجّع أي تعديل غلط بدوسة.",
  badge: "للباشمهندس",
  footerTag: "آخر 30 يوم",
  href: "/admin/activity",
  icon: History,
  keywords: "audit log history سجل تعديلات رجوع",
  group: "shop",
  accent: "text-slate-800",
  iconTile: "bg-slate-100 text-slate-800 group-hover:bg-slate-900 group-hover:text-white",
  solidTile: "bg-slate-900 text-white",
  hoverBorder: "hover:border-slate-500",
  adminOnly: true,
});

/** Tools a user sees on the dashboard and in Ctrl+K */
export function visibleTools(isAdmin: boolean): AdminTool[] {
  return ADMIN_TOOLS.filter((t) => !t.hidden && (!t.adminOnly || isAdmin));
}

export function findToolByPath(pathname: string | null): AdminTool | undefined {
  if (!pathname) return undefined;
  return ADMIN_TOOLS.find((t) => pathname === t.href || pathname.startsWith(t.href + "/"));
}
