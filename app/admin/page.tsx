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
  ShieldCheck,
  Zap,
  ShoppingBag,
  Clock,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const pythonTools = [
  {
    title: "اسكربت مصنع البطاقات والمستندات (A5)",
    description: "تجميع وقص وش وضهر بطاقات الرقم القومي والشهادات وتصديرها كملف Word مقاس A5 حقيقي للطباعة والتسليف فورياً.",
    href: "/admin/id-cards",
    icon: CreditCard,
    color: "from-blue-600 to-cyan-600",
    badge: "اسكربت بايثون مدمج",
    stats: "مقاس A5 دقيق",
  },
  {
    title: "اسكربت استوديو الصور الشخصية (4x6)",
    description: "عزل خلفية الصورة فورياً بالذكاء الاصطناعي على المتصفح وتكرارها (4 على كوداك A6 أو 9 على A5) بجودة الاستوديو.",
    href: "/admin/passport-photos",
    icon: Camera,
    color: "from-emerald-600 to-teal-600",
    badge: "AI بدون سيرفر",
    stats: "كوداك 4×6 فوري",
  },
  {
    title: "اسكربت ماسح المستندات وتوفير الأحبار",
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
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-950 via-slate-900 to-slate-900 border border-blue-500/20 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" /> مركز إدارة كوبي كات v1.2
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> نظام آمن ومحمي
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">
            مرحباً بك {user?.name ? `يا ${user.name}` : ""} في مركز عمليات كوبي كات 👋
          </h1>
          <p className="text-slate-400 max-w-3xl text-sm leading-relaxed">
            تم دمج كافة اسكربتات بايثون (تجهيز بطاقات الرقم القومي، تصوير استوديو 4×6، ماسح تفتيح المستندات، وحصر
            المخزن) لتعمل سحابياً وبشكل فوري لخدمة زبائن المكتبة بأعلى سرعة وأقصى توفير في الأحبار والخامات.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/admin/inventory"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition flex items-center gap-2"
          >
            <Boxes className="w-4 h-4" />
            <span>تنظيم وحصر المنتجات والأسعار</span>
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

      {/* Main Python Scripts & Machines Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            اسكربتات بايثون وأدوات العمل اليومية
          </h2>
          <span className="text-xs text-slate-400">5 أدوات جاهزة للتشغيل الفوري</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pythonTools.map((tool) => {
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

                  <h3 className="text-lg font-black text-white group-hover:text-blue-400 transition-colors mb-2">
                    {tool.title}
                  </h3>
                  <p className="text-slate-400 text-xs leading-relaxed mb-6">
                    {tool.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">{tool.stats}</span>
                  <div className="flex items-center gap-1 text-xs font-bold text-blue-400 group-hover:text-blue-300">
                    <span>تشغيل الاسكربت</span>
                    <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
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
