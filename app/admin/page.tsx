"use client";

import Link from "next/link";
import {
  CreditCard,
  Camera,
  ScanLine,
  FileText,
  Boxes,
  ArrowUpRight,
  Printer,
  Sparkles,
  TrendingUp,
} from "lucide-react";

const tools = [
  {
    title: "مصنع البطاقات والمستندات (A5)",
    description: "تجميع وقص وش وضهر بطاقات الرقم القومي والشهادات وتصديرها كملف Word مقاس A5 حقيقي.",
    href: "/admin/id-cards",
    icon: CreditCard,
    color: "from-blue-600 to-cyan-600",
    badge: "توفير الورق A5",
  },
  {
    title: "استوديو الصور الشخصية (4x6)",
    description: "عزل خلفية الصورة فورياً بالذكاء الاصطناعي على المتصفح وتكرارها (4 على A6 أو 9 على A5).",
    href: "/admin/passport-photos",
    icon: Camera,
    color: "from-emerald-600 to-teal-600",
    badge: "AI بدون سيرفر",
  },
  {
    title: "ماسح المستندات وتوفير الحبر",
    description: "عكس المذكرات السوداء للأبيض وتفتيح خلفية الأوراق لتوفير أحبار الطابعات وتصدير ZIP.",
    href: "/admin/scanner",
    icon: ScanLine,
    color: "from-amber-600 to-orange-600",
    badge: "توفير 80% حبر",
  },
  {
    title: "مولد الأبحاث الذكي",
    description: "كتابة أبحاث مدرسية وجامعية موسعة بالذكاء الاصطناعي مع الغلاف، الفهرس والمراجع بتنسيق Word جاهز.",
    href: "/admin/research",
    icon: FileText,
    color: "from-purple-600 to-indigo-600",
    badge: "Gemini / Groq",
  },
  {
    title: "إدارة المخزن والـ POS (حصر)",
    description: "متابعة الكميات، أسعار بيع المستلزمات الورقية والأدوات المكتبية وإجمالي رأس المال الحي.",
    href: "/admin/inventory",
    icon: Boxes,
    color: "from-rose-600 to-pink-600",
    badge: "Supabase DB",
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-900/40 via-slate-900 to-slate-900 border border-blue-500/20 rounded-3xl p-8">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" /> أوفيس برنت ستوديو سحابي v2.0
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2">
            مرحباً بك في مركز عمليات الطباعة والخدمات الرقمية 👋
          </h1>
          <p className="text-slate-400 max-w-2xl text-sm leading-relaxed">
            جميع أدوات تجهيز الأوراق، الصور الشخصية، وحصر المخزون أصبحت تعمل الآن مباشرة على
            المتصفح والسحابة لتسريع خدمة العملاء بأعلى إنتاجية وأقل استهلاك للأحبار.
          </p>
        </div>
      </div>

      {/* Tools Grid */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Printer className="w-5 h-5 text-blue-400" />
          أدوات وماكينات العمل السريعة
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="group relative bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all hover:shadow-xl hover:shadow-blue-500/5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${tool.color} flex items-center justify-center text-white shadow-lg`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {tool.badge}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors mb-2">
                    {tool.title}
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-6">
                    {tool.description}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-sm font-semibold text-blue-400 group-hover:text-blue-300">
                  <span>فتح الأداة</span>
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
