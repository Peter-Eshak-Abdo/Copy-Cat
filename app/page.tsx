"use client";

import Link from "next/link";
import {
  Printer,
  Sparkles,
  CreditCard,
  Camera,
  FileText,
  ScanLine,
  ArrowLeft,
  CheckCircle,
  Phone,
  Clock,
  MapPin,
  LogIn,
} from "lucide-react";

export default function PublicStorefrontPage() {
  const services = [
    {
      title: "تجهيز وطباعة بطاقات الرقم القومي والشهادات",
      desc: "تجميع الوجهين بدقة على ورق مقاس A5 أو A4 مع سلوفان حراري فوري لحماية الكروت.",
      icon: CreditCard,
      price: "15 ج.م",
    },
    {
      title: "استوديو الصور الشخصية الفورية (4×6)",
      desc: "عزل الخلفية وضبط مقاسات الباسبور والتأشيرات والتقديمات الحكومية وطباعة كوداك.",
      icon: Camera,
      price: "25 ج.م (4 صور)",
    },
    {
      title: "تصوير المستندات وعكس المذكرات الداكنة",
      desc: "تفتيح وتبييض الأوراق، وتفريغ الخلفيات السوداء لتوفير وضوح عالي للطلاب والباحثين.",
      icon: ScanLine,
      price: "حسب عدد الصفحات",
    },
    {
      title: "إعداد وصياغة الأبحاث الأكاديمية والجامعية",
      desc: "تنسيق متكامل للرسائل والتقارير الطلابية مع الغلاف الرسمي والفهرس والمراجع.",
      icon: FileText,
      price: "يبدأ من 35 ج.م",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/20">
              PS
            </div>
            <div>
              <span className="font-extrabold text-white text-lg block leading-tight">
                أوفيس برنت ستوديو
              </span>
              <span className="text-xs text-slate-400">خدمات الطباعة، النسخ، والتصوير الرقمي</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-600/30 transition"
            >
              <LogIn className="w-4 h-4" />
              <span>دخول الموظفين (ERP)</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-6 max-w-7xl mx-auto w-full text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-6">
          <Sparkles className="w-4 h-4" /> جودة طباعة استوديو وسرعة تسليم قياسية
        </div>

        <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-6 max-w-4xl mx-auto">
          الوجهة المتكاملة لكافة حلول <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">الطباعة والخدمات الطلابية</span>
        </h1>

        <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-10">
          نوفر أحدث تقنيات تصوير المستندات والبطاقات الشخصية، طباعة الصور الاستوديو، تجهيز الأبحاث، وبيع
          كافة المستلزمات المكتبية والورقية بأفضل جودة وسعر.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/admin"
            className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-base shadow-xl shadow-blue-600/30 transition"
          >
            <span>بدء تنفيذ طلب الآن</span>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-16 px-6 max-w-7xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">خدماتنا الرئيسية</h2>
          <p className="text-slate-400 text-sm">كل ما تحتاجه في مكان واحد بأعلى معايير الدقة والسرعة</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((svc, i) => {
            const Icon = svc.icon;
            return (
              <div
                key={i}
                className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between hover:border-slate-700 transition shadow-lg"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-6">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-white text-lg mb-2">{svc.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-6">{svc.desc}</p>
                </div>
                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">السعر التقديري</span>
                  <span className="text-sm font-black text-cyan-400">{svc.price}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer Info */}
      <footer className="border-t border-slate-800/80 bg-slate-900/30 py-8 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>جميع الحقوق محفوظة © أوفيس برنت ستوديو {new Date().getFullYear()}</span>
          <div className="flex items-center gap-6">
            <span>طباعة فورية</span>
            <span>تجهيز أبحاث</span>
            <span>تصوير مستندات</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
