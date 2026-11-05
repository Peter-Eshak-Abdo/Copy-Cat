"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, HelpCircle, MessageCircle, Package, Plus, Printer, Search, ShoppingBag } from "lucide-react";
import { DEFAULT_FAQ, isFaqList, type FaqItem } from "@/lib/faq";
import { normalizeArabic } from "@/components/storefront/storefront-utils";
import { Reveal, SectionHeading, WaLink } from "@/components/storefront/ui";

const TOPIC_ICON: Record<string, typeof Printer> = {
  "الطباعة": Printer,
  "التصوير والصور": Camera,
  "الأدوات المكتبية": Package,
  "الطلب والاستلام": ShoppingBag,
};

/** Customer questions about printing, photos and stationery (edited from /admin/faq) */
export function FaqSection() {
  const [items, setItems] = useState<FaqItem[]>(DEFAULT_FAQ);
  const [topic, setTopic] = useState("الكل");
  const [open, setOpen] = useState<number | null>(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/public/faq")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (isFaqList(d?.items) && d.items.length) setItems(d.items);
      })
      .catch(() => {});
  }, []);

  const topics = useMemo(() => ["الكل", ...Array.from(new Set(items.map((i) => i.topic)))], [items]);
  const shown = useMemo(() => {
    const words = normalizeArabic(query).split(" ").filter(Boolean);
    return items
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => topic === "الكل" || it.topic === topic)
      .filter(({ it }) => {
        if (!words.length) return true;
        const hay = normalizeArabic(`${it.q} ${it.a}`);
        return words.every((w) => hay.includes(w));
      });
  }, [items, topic, query]);

  // Search engines show these answers right in the results
  const jsonLd = useMemo(
    () =>
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((it) => ({ "@type": "Question", name: it.q, acceptedAnswer: { "@type": "Answer", text: it.a } })),
      }).replace(/</g, "\\u003c"),
    [items]
  );

  return (
    <section id="faq" className="scroll-mt-20 max-w-5xl mx-auto w-full px-4 sm:px-6 py-14 sm:py-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <SectionHeading
        eyebrow="أسئلة شائعة"
        title={
          <>
            عندك سؤال؟ <span className="text-blue-600">غالباً إجابته هنا</span>
          </>
        }
        subtitle="كل اللي الزباين بيسألوا عنه في الطباعة والتصوير والأدوات المكتبية."
      />

      <Reveal>
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(null);
              }}
              placeholder="دوّر في الأسئلة... (ألوان، صور، توصيل)"
              className="w-full bg-white border border-slate-200 rounded-2xl pr-10 pl-3 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 mb-5">
          {topics.map((t) => {
            const Icon = TOPIC_ICON[t] ?? HelpCircle;
            const active = topic === t;
            return (
              <button
                key={t}
                onClick={() => {
                  setTopic(t);
                  setOpen(null);
                }}
                className={`relative shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                  active ? "text-white" : "text-slate-600 bg-white border border-slate-200 hover:border-blue-300"
                }`}
              >
                {active && (
                  <motion.span layoutId="faq-topic" className="absolute inset-0 rounded-xl bg-blue-600 shadow-md shadow-blue-600/30" transition={{ type: "spring", stiffness: 420, damping: 32 }} />
                )}
                <Icon className="relative w-4 h-4" />
                <span className="relative">{t}</span>
              </button>
            );
          })}
        </div>
      </Reveal>

      <div className="space-y-2.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {shown.map(({ it, i }, k) => {
            const isOpen = open === i;
            const Icon = TOPIC_ICON[it.topic] ?? HelpCircle;
            return (
              <motion.div
                key={`${it.q}-${i}`}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(k, 8) * 0.03 } }}
                exit={{ opacity: 0, scale: 0.97 }}
                className={`rounded-2xl border bg-white overflow-hidden transition-colors ${isOpen ? "border-blue-300 shadow-lg shadow-blue-900/5" : "border-slate-200 hover:border-blue-200"}`}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center gap-3 p-4 text-right cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isOpen ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="flex-1 text-sm sm:text-base font-black text-slate-900">{it.q}</span>
                  <motion.span animate={{ rotate: isOpen ? 45 : 0 }} className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <Plus className="w-4 h-4" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="px-4 pb-4 pr-16 text-sm text-slate-600 leading-relaxed whitespace-pre-line">{it.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {shown.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-8">ملقيناش سؤال بالكلام ده، اسألنا على الواتساب على طول.</p>
        )}
      </div>

      <Reveal className="mt-6 text-center">
        <WaLink
          text="مرحباً مكتبة كوبي كات، عندي سؤال: "
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/20 transition"
        >
          <MessageCircle className="w-4 h-4" />
          ملقتش سؤالك؟ اسألنا على الواتساب
        </WaLink>
      </Reveal>
    </section>
  );
}
