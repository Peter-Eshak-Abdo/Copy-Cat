"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Camera, HelpCircle, MessageCircle, Package, Plus, Printer, ShoppingBag } from "lucide-react";
import { DEFAULT_FAQ, isFaqList, type FaqItem } from "@/lib/faq";
import { Reveal, SectionHeading, WaLink } from "@/components/storefront/ui";

export const TOPIC_ICON: Record<string, typeof Printer> = {
  "الطباعة": Printer,
  "التصوير والصور": Camera,
  "الأدوات المكتبية": Package,
  "الطلب والاستلام": ShoppingBag,
};

/** The FAQ list (edited from /admin/faq), starting from `initial` and refreshed from the server */
export function useFaqItems(initial: FaqItem[] = DEFAULT_FAQ) {
  const [items, setItems] = useState<FaqItem[]>(initial);
  useEffect(() => {
    fetch("/api/public/faq")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (isFaqList(d?.items) && d.items.length) setItems(d.items);
      })
      .catch(() => {});
  }, []);
  return items;
}

/** One question from each topic in turn, so a short list still covers everything */
function spread(items: FaqItem[], count: number): FaqItem[] {
  const byTopic = new Map<string, FaqItem[]>();
  for (const it of items) byTopic.set(it.topic, [...(byTopic.get(it.topic) ?? []), it]);
  const queues = [...byTopic.values()];
  const out: FaqItem[] = [];
  for (let round = 0; out.length < count && queues.some((q) => q.length > round); round++) {
    for (const q of queues) if (q[round] && out.length < count) out.push(q[round]);
  }
  return out;
}

/** Home page: a few customer questions; all of them are on /faq */
export function FaqSection({ limit = 5 }: { limit?: number }) {
  const items = useFaqItems();
  const [open, setOpen] = useState<number | null>(0);
  const shown = useMemo(() => spread(items, limit), [items, limit]);
  const rest = items.length - shown.length;

  return (
    <section id="faq" className="scroll-mt-20 max-w-4xl mx-auto w-full px-4 sm:px-6 py-14 sm:py-20">
      <SectionHeading
        eyebrow="أسئلة شائعة"
        title={
          <>
            عندك سؤال؟ <span className="text-blue-600">غالباً إجابته هنا</span>
          </>
        }
        subtitle="أكتر الأسئلة اللي الزباين بيسألوها، والباقي كله في صفحة الأسئلة."
      />

      <div className="space-y-2.5">
        {shown.map((it, i) => {
          const isOpen = open === i;
          const Icon = TOPIC_ICON[it.topic] ?? HelpCircle;
          return (
            <Reveal key={`${it.q}-${i}`} delay={i * 0.05}>
              <div className={`rounded-2xl border bg-white overflow-hidden transition-colors ${isOpen ? "border-blue-300 shadow-lg shadow-blue-900/5" : "border-slate-200 hover:border-blue-200"}`}>
                <button onClick={() => setOpen(isOpen ? null : i)} className="w-full flex items-center gap-3 p-4 text-right cursor-pointer" aria-expanded={isOpen}>
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
              </div>
            </Reveal>
          );
        })}
      </div>

      <Reveal className="mt-6">
        <Link
          href="/faq"
          className="group relative flex flex-col sm:flex-row items-center justify-between gap-3 p-5 rounded-2xl bg-linear-to-l from-indigo-600 to-blue-600 text-white shadow-xl shadow-blue-900/20 overflow-hidden"
        >
          <span className="absolute inset-0 cc-shine" aria-hidden />
          <span className="relative text-center sm:text-right">
            <span className="block text-base sm:text-lg font-black">{rest > 0 ? `فيه ${rest} سؤال تاني في صفحة الأسئلة` : "كل الأسئلة في صفحة واحدة"}</span>
            <span className="block text-xs sm:text-sm text-blue-100 mt-0.5">الطباعة، الصور، الأدوات، والطلب والاستلام، مع بحث في كل الأسئلة</span>
          </span>
          <span className="relative inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-blue-700 text-sm font-black shrink-0">
            شوف كل الأسئلة
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          </span>
        </Link>
      </Reveal>

      <Reveal className="mt-4 text-center">
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
