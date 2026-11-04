import type { LucideIcon } from "lucide-react";
import {
  PenTool,
  NotebookPen,
  Paperclip,
  Palette,
  Briefcase,
  FolderOpen,
  Backpack,
  Ruler,
  Printer,
  IdCard,
  Gift,
  Shirt,
  LayoutGrid,
  Package,
} from "lucide-react";

/**
 * Arabic-friendly search: one spelling for the letters people type in different ways
 * (أ/إ/آ → ا, ة → ه, ى → ي), no tashkeel or tatweel, Arabic-Indic digits → 0-9, × → x.
 */
export function normalizeArabic(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/×/g, "x")
    .replace(/\s+/g, " ")
    .trim();
}

export interface CategoryMeta {
  icon: LucideIcon;
  /** Tailwind classes for the tile: icon background + text color */
  tone: string;
  /** Gradient for the tile glow */
  glow: string;
  blurb: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  "خدمات وطباعة": { icon: Printer, tone: "bg-blue-100 text-blue-700", glow: "from-blue-500/25", blurb: "طباعة وتصوير وصور شخصية" },
  "أدوات كتابة ورسم": { icon: PenTool, tone: "bg-violet-100 text-violet-700", glow: "from-violet-500/25", blurb: "أقلام وألوان وماركرات" },
  "كشاكيل ودفاتر": { icon: NotebookPen, tone: "bg-amber-100 text-amber-700", glow: "from-amber-500/25", blurb: "كشاكيل وكراسات ونوت" },
  "لواصق ومثبتات": { icon: Paperclip, tone: "bg-rose-100 text-rose-700", glow: "from-rose-500/25", blurb: "صمغ وشريط ودباسات" },
  "ورق وخامات فنية": { icon: Palette, tone: "bg-pink-100 text-pink-700", glow: "from-pink-500/25", blurb: "كانسون وكريب وفوم" },
  "أدوات ومستلزمات عامة": { icon: Briefcase, tone: "bg-slate-200 text-slate-700", glow: "from-slate-500/25", blurb: "كل اللي المكتب محتاجه" },
  "ملفات وحوافظ": { icon: FolderOpen, tone: "bg-cyan-100 text-cyan-700", glow: "from-cyan-500/25", blurb: "ملفات وحوافظ وكلبسات" },
  "حقائب ومقالم": { icon: Backpack, tone: "bg-emerald-100 text-emerald-700", glow: "from-emerald-500/25", blurb: "شنط ومقالم للمدرسة" },
  "أدوات هندسية وحسابية": { icon: Ruler, tone: "bg-indigo-100 text-indigo-700", glow: "from-indigo-500/25", blurb: "مساطر وآلات حاسبة" },
  "بطاقات ومطبوعات": { icon: IdCard, tone: "bg-sky-100 text-sky-700", glow: "from-sky-500/25", blurb: "كروت وبطاقات ومطبوعات" },
  "هدايا وألعاب": { icon: Gift, tone: "bg-orange-100 text-orange-700", glow: "from-orange-500/25", blurb: "هدايا ولعب أطفال" },
  "ملبوسات وإكسسوار": { icon: Shirt, tone: "bg-teal-100 text-teal-700", glow: "from-teal-500/25", blurb: "إكسسوارات وملبوسات" },
};

const FALLBACK_META: CategoryMeta = {
  icon: Package,
  tone: "bg-slate-100 text-slate-700",
  glow: "from-slate-500/20",
  blurb: "منتجات متنوعة",
};

export const ALL_CATEGORY = "الكل";

export function categoryMeta(category: string): CategoryMeta {
  if (category === ALL_CATEGORY) {
    return { icon: LayoutGrid, tone: "bg-blue-600 text-white", glow: "from-blue-500/25", blurb: "كل المنتجات" };
  }
  return CATEGORY_META[category] ?? FALLBACK_META;
}

export type SortKey = "default" | "price-asc" | "price-desc" | "name";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "default", label: "الترتيب المقترح" },
  { key: "price-asc", label: "السعر: من الأقل" },
  { key: "price-desc", label: "السعر: من الأعلى" },
  { key: "name", label: "الاسم (أ - ي)" },
];

/** Quick searches shown under the search box */
export const POPULAR_SEARCHES = ["كشكول", "قلم جاف", "ألوان", "ملف", "آلة حاسبة", "صور 4x6", "مقلمة", "كانسون"];
