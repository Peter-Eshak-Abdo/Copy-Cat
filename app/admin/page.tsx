"use client";

import Link from "next/link";
import {
  CreditCard,
  Camera,
  ScanLine,
  FileText,
  Boxes,
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
  Zap,
  ShoppingBag,
  Calculator,
  CheckSquare,
  Globe,
  Share2,
  GraduationCap,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const allTools = [
  // 1. Calculator
  {
    title: "حاسبة المطبعة والملازم الذكية",
    description: "حساب دقيق لورق الملازم (وش وظهر)، أزرار تسعير الورقة، وإضافات التجليد والسلوفان مع حاسبة عامة سريعة بنظام Numpad.",
    href: "/admin/calculator",
    icon: Calculator,
    color: "from-blue-600 to-indigo-600",
    badge: "حساب وش وضهر دقيق",
    stats: "تسعير مخصص للمكتبة",
  },
  // 2. Tasks & Handover
  {
    title: "أوردرات الطباعة وتسليم الشيفت",
    description: "متابعة أوردرات وملازم المدرسين، عداد النسخ المطبوعة الحي، مراسلة واتساب فورية، وتوليد تقرير تسليم الشيفت بضغطة واحدة.",
    href: "/admin/tasks",
    icon: CheckSquare,
    color: "from-emerald-600 to-teal-600",
    badge: "مراسلة واتساب فورية",
    stats: "تقرير شيفت متكامل",
  },
  // 3. PDF Studio
  {
    title: "استوديو وأدوات الـ PDF المتقدمة",
    description: "حذف صفحات الملازم من المنتصف والأطراف، تجميع الصور في ملف PDF، وتحويل المستندات العربية إلى Word بمسافات ضيقة وخط 18pt.",
    href: "/admin/pdf-tools",
    icon: FileText,
    color: "from-rose-600 to-red-600",
    badge: "تعديل PDF أوفلاين",
    stats: "حذف صفحات & صور لـ PDF",
  },
  // 4. Multi-stage OCR
  {
    title: "الماسح الضوئي الذكي (Multi-Stage OCR)",
    description: "استخراج نصوص الأوراق والملازم على مرحلتين: استخراج بصري يتبعه تدقيق لغوي ونحوي عربي مع تصدير Word جاهز للطباعة.",
    href: "/admin/ocr",
    icon: Sparkles,
    color: "from-amber-500 to-orange-600",
    badge: "تدقيق لغوي ذكي",
    stats: "تصدير Word بخط 18pt",
  },
  // 5. School Sheets
  {
    title: "مولد شيتات المفردات المدرسية",
    description: "استخراج معاني الكلمات من كتب المدرسين وتوليد نموذجين امتحانيين (نموذج أ / نموذج ب) بترتيب عشوائي وتصدير Word فوري.",
    href: "/admin/school-sheets",
    icon: GraduationCap,
    color: "from-cyan-600 to-blue-600",
    badge: "خلط عشوائي للمفردات",
    stats: "نموذج أ + نموذج ب",
  },
  // 6. LAN Transfer
  {
    title: "مركز النقل السريع الداخلي (LAN Transfer)",
    description: "نقل فوري للملفات والملازم الكبيرة بين أجهزة المكتبة عبر كابل الشبكة المحلية أو الراوتر بدون استهلاك باقة الإنترنت.",
    href: "/admin/lan-transfer",
    icon: Share2,
    color: "from-violet-600 to-purple-600",
    badge: "0 استهلاك نت",
    stats: "سرعة كابل الشبكة القصوى",
  },
  // 7. Shortcuts
  {
    title: "روابط وسيرفرات العمل اليومية",
    description: "دليل سريع للمواقع والسيرفرات والمنصات التعليمية والحكومية التي يحتاجها عمل المطبعة يومياً مع بحث وتصنيف فوري.",
    href: "/admin/shortcuts",
    icon: Globe,
    color: "from-sky-600 to-teal-600",
    badge: "وصول سريع بضغطة زر",
    stats: "مواقع حكومية وتعليمية",
  },
  // Existing tools
  {
    title: "مصنع البطاقات والمستندات (A5)",
    description: "تجميع وقص وش وضهر بطاقات الرقم القومي والشهادات وتصديرها كملف Word مقاس A5 حقيقي للطباعة والتسليف فورياً.",
    href: "/admin/id-cards",
    icon: CreditCard,
    color: "from-blue-600 to-cyan-600",
    badge: "تصدير Word A5",
    stats: "مقاس A5 دقيق",
  },
  {
    title: "استوديو الصور الشخصية (4x6)",
    description: "عزل خلفية الصورة فورياً بالذكاء الاصطناعي على المتصفح وتكرارها (4 على كوداك A6 أو 9 على A5) بجودة الاستوديو.",
    href: "/admin/passport-photos",
    icon: Camera,
    color: "from-emerald-600 to-teal-600",
    badge: "AI بدون سيرفر",
    stats: "كوداك 4×6 فوري",
  },
  {
    title: "ماسح المستندات وتوفير الأحبار",
    description: "عكس المذكرات السوداء للأبيض وتفتيح خلفية الأوراق لتوفير أحبار الطابعات وتصدير حزم ZIP جاهزة للطباعة.",
    href: "/admin/scanner",
    icon: ScanLine,
    color: "from-amber-600 to-orange-600",
    badge: "توفير 80% حبر",
    stats: "أبيض وأسود عالي النقاء",
  },
  {
    title: "مولد الأبحاث الأكاديمية والجامعية",
    description: "توليد أبحاث مدرسية وجامعية موسعة وموثقة بالمراجع والغلاف الرسمي والفهرس مع التصدير لملف Word جاهز.",
    href: "/admin/research",
    icon: FileText,
    color: "from-purple-600 to-indigo-600",
    badge: "Gemini / Groq AI",
    stats: "تنسيق أكاديمي فوري",
  },
  {
    title: "إدارة المخزن وكتالوج المتجر (حصر)",
    description: "إضافة وتعديل وحذف المنتجات وأسعار البيع، مراقبة المخزون، وتنظيم العرض لزبائن المتجر الخارجي.",
    href: "/admin/inventory",
    icon: Boxes,
    color: "from-rose-600 to-pink-600",
    badge: "Supabase DB",
    stats: "تحكم كامل بالمنتجات",
  },
];

export default function AdminDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8" dir="rtl">
      {/* Top Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-950 via-slate-900 to-slate-900 border border-blue-500/20 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" /> مركز إدارة كوبي كات v1.8
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> نظام آمن ومحمي أوفلاين
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">
            مرحباً بك {user?.name ? `يا ${user.name}` : ""} في مركز عمليات كوبي كات 👋
          </h1>
          <p className="text-slate-400 max-w-3xl text-sm leading-relaxed">
            تم تحديث النظام بالكامل ليشمل حاسبة الملازم المتطورة، إدارة أوردرات الشيفت، الماسح الضوئي الذكي (OCR)، استوديو تعديل الـ PDF، ومولد شيتات المدارس لخدمة زبائن المطبعة بأقصى سرعة وكفاءة.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/admin/calculator"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition flex items-center gap-2"
          >
            <Calculator className="w-4 h-4" />
            <span>حاسبة الملازم والطباعة</span>
          </Link>
          <Link
            href="/admin/tasks"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition flex items-center gap-2"
          >
            <CheckSquare className="w-4 h-4" />
            <span>مهام وأوردرات الشيفت</span>
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-2 border border-slate-700"
          >
            <ShoppingBag className="w-4 h-4 text-cyan-400" />
            <span>معاينة متجر الزبائن العام</span>
          </Link>
        </div>
      </div>

      {/* Main Tools Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            جميع أدوات وماكينات العمل اليومية
          </h2>
          <span className="text-xs text-slate-400">{allTools.length} أداة جاهزة للتشغيل الفوري</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="group relative bg-slate-900/90 border border-slate-800 rounded-3xl p-6 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${tool.color} flex items-center justify-center text-white shadow-lg`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {tool.badge}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-white group-hover:text-blue-400 transition-colors mb-2">
                    {tool.title}
                  </h3>
                  <p className="text-slate-400 text-xs leading-relaxed mb-6">
                    {tool.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">{tool.stats}</span>
                  <div className="flex items-center gap-1 text-xs font-bold text-blue-400 group-hover:text-blue-300">
                    <span>تشغيل الأداة</span>
                    <ArrowUpRight className="w-4 h-4 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
