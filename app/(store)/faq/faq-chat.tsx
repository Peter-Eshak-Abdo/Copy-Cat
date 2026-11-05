"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, CheckCheck, HelpCircle, MessageCircle, Search, Sparkles, X } from "lucide-react";
import type { FaqItem } from "@/lib/faq";
import { TOPIC_ICON, useFaqItems } from "@/components/storefront/faq-section";
import { searchTokens, useStore } from "@/components/storefront/store-provider";
import { normalizeArabic } from "@/components/storefront/storefront-utils";
import { Highlight, WaLink } from "@/components/storefront/ui";

/**
 * /faq: every customer question. The answer comes back as a chat with the shop (the customer's question
 * bubble, "typing...", then the shop's reply word by word), the way customers already talk to the shop on
 * WhatsApp. Wide screens keep the chat beside the list; phones open it as a sheet from the bottom.
 */

const ALL = "الكل";

const TOPIC_TONE: Record<string, { tile: string; soft: string; text: string }> = {
  "الطباعة": { tile: "from-blue-500 to-indigo-600", soft: "bg-blue-50 border-blue-100", text: "text-blue-700" },
  "التصوير والصور": { tile: "from-fuchsia-500 to-pink-600", soft: "bg-fuchsia-50 border-fuchsia-100", text: "text-fuchsia-700" },
  "الأدوات المكتبية": { tile: "from-amber-400 to-orange-600", soft: "bg-amber-50 border-amber-100", text: "text-amber-700" },
  "الطلب والاستلام": { tile: "from-emerald-500 to-teal-600", soft: "bg-emerald-50 border-emerald-100", text: "text-emerald-700" },
};
const DEFAULT_TONE = { tile: "from-slate-500 to-slate-700", soft: "bg-slate-50 border-slate-200", text: "text-slate-700" };
const toneOf = (topic: string) => TOPIC_TONE[topic] ?? DEFAULT_TONE;

const FLOATING = [
  { c: "؟", cls: "top-[12%] right-[6%] text-7xl", d: 7 },
  { c: "?", cls: "top-[55%] right-[18%] text-5xl hidden sm:block", d: 9 },
  { c: "؟", cls: "top-[18%] left-[8%] text-6xl", d: 8 },
  { c: "💬", cls: "bottom-[14%] left-[20%] text-4xl hidden sm:block", d: 6 },
  { c: "🖨️", cls: "top-[8%] left-[38%] text-3xl hidden lg:block", d: 7.5 },
];

const arNum = (n: number) => String(n).padStart(2, "0");

type Msg = { id: number; from: "me" | "shop"; text: string; q?: number };

function useIsDesktop() {
  const [desk, setDesk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesk(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desk;
}

/** The shop's reply, appearing word by word */
function TypedAnswer({ text }: { text: string }) {
  const words = text.split(/(\s+)/);
  return (
    <motion.span initial="h" animate="s" variants={{ s: { transition: { staggerChildren: Math.min(0.035, 1.1 / words.length) } } }}>
      {words.map((w, i) => (
        <motion.span key={i} variants={{ h: { opacity: 0, y: 4, filter: "blur(3px)" }, s: { opacity: 1, y: 0, filter: "blur(0px)" } }} className="whitespace-pre-wrap">
          {w}
        </motion.span>
      ))}
    </motion.span>
  );
}

function Chat({
  items,
  messages,
  typing,
  asked,
  onAsk,
  onClose,
}: {
  items: FaqItem[];
  messages: Msg[];
  typing: boolean;
  asked: Set<number>;
  onAsk: (i: number) => void;
  onClose?: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, typing]);

  // Quick replies: more from the topic of the last question, then anything not asked yet
  const last = [...messages].reverse().find((m) => m.q !== undefined)?.q;
  const suggestions = useMemo(() => {
    const free = items.map((it, i) => ({ it, i })).filter(({ i }) => !asked.has(i));
    const topic = last !== undefined ? items[last]?.topic : undefined;
    return [...free.filter(({ it }) => it.topic === topic), ...free.filter(({ it }) => it.topic !== topic)].slice(0, 3);
  }, [items, asked, last]);

  return (
    <div className="flex flex-col h-full rounded-[1.75rem] overflow-hidden bg-white border border-slate-200 shadow-2xl shadow-slate-900/15">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-emerald-700 text-white">
        <div className="relative w-11 h-11 rounded-full bg-white p-1 shrink-0">
          <Image src="/logo.jpg" alt="" width={44} height={44} className="w-full h-full object-contain rounded-full" />
          <span className="absolute bottom-0 left-0 w-3 h-3 rounded-full bg-lime-400 ring-2 ring-emerald-700" />
        </div>
        <div className="flex-1 min-w-0 leading-tight">
          <div className="font-black text-base">مكتبة كوبي كات</div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={typing ? "t" : "o"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="text-xs text-emerald-100">
              {typing ? "بيكتب..." : "بنرد على أسئلتك"}
            </motion.div>
          </AnimatePresence>
        </div>
        {onClose && (
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer" aria-label="اقفل">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={bodyRef}
        className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-3 bg-[#efeae2]"
        style={{ backgroundImage: "radial-gradient(rgba(15,23,42,0.06) 1px, transparent 1px)", backgroundSize: "16px 16px" }}
      >
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className={`flex ${m.from === "shop" ? "justify-start" : "justify-end"}`}
              style={{ transformOrigin: m.from === "shop" ? "right bottom" : "left bottom" }}
            >
              <div
                className={`relative max-w-[86%] px-3.5 pt-2.5 pb-1.5 shadow-sm text-[15px] sm:text-base leading-8 ${
                  m.from === "shop" ? "bg-white text-slate-800 rounded-2xl rounded-tr-sm" : "bg-[#d9fdd3] text-slate-900 font-bold rounded-2xl rounded-tl-sm"
                }`}
              >
                {m.from === "shop" && m.q !== undefined ? <TypedAnswer text={m.text} /> : <span className="whitespace-pre-line">{m.text}</span>}
                <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 mt-0.5">
                  {m.from === "me" ? (
                    <>
                      <CheckCheck className="w-3.5 h-3.5 text-sky-500" /> اتبعت
                    </>
                  ) : (
                    "كوبي كات"
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          {typing && (
            <motion.div key="typing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex justify-start">
              <div className="bg-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm flex gap-1.5">
                {[0, 1, 2].map((d) => (
                  <motion.span
                    key={d}
                    className="w-2 h-2 rounded-full bg-slate-400"
                    animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: d * 0.15 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick replies + WhatsApp */}
      <div className="border-t border-slate-200 bg-white p-3 space-y-2.5">
        {!typing && suggestions.length > 0 && (
          <div>
            <div className="text-[11px] font-bold text-slate-400 mb-1.5">اسأل كمان:</div>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map(({ it, i }, k) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + k * 0.07 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onAsk(i)}
                  className="px-3 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs sm:text-sm font-bold text-right cursor-pointer"
                >
                  {it.q}
                </motion.button>
              ))}
            </div>
          </div>
        )}
        <WaLink
          text="مرحباً مكتبة كوبي كات، عندي سؤال: "
          className="flex items-center gap-2 w-full rounded-full bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-sm text-slate-500 transition"
        >
          <span className="flex-1 text-right">سؤالك مش هنا؟ اكتبهولنا على الواتساب...</span>
          <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <MessageCircle className="w-4 h-4" />
          </span>
        </WaLink>
      </div>
    </div>
  );
}

export function FaqChat({ initial }: { initial: FaqItem[] }) {
  const items = useFaqItems(initial);
  const { totalCartCount } = useStore();
  const isDesktop = useIsDesktop();
  const [topic, setTopic] = useState(ALL);
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { id: 0, from: "shop", text: "أهلاً بيك في كوبي كات 👋\nاختار أي سؤال وهرد عليك على طول." },
  ]);
  const [pending, setPending] = useState(0);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const asked = useMemo(() => new Set(messages.filter((m) => m.from === "me").map((m) => m.q!)), [messages]);
  const topics = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.topic, (m.get(it.topic) ?? 0) + 1);
    return [...m.entries()];
  }, [items]);
  const tokens = searchTokens(query);
  const groups = useMemo(() => {
    const out = new Map<string, { it: FaqItem; i: number }[]>();
    items.forEach((it, i) => {
      if (topic !== ALL && it.topic !== topic) return;
      if (tokens.length) {
        const hay = normalizeArabic(`${it.q} ${it.a} ${it.topic}`);
        if (!tokens.every((w) => hay.includes(w))) return;
      }
      out.set(it.topic, [...(out.get(it.topic) ?? []), { it, i }]);
    });
    return [...out.entries()];
  }, [items, topic, tokens]);
  const found = groups.reduce((n, [, g]) => n + g.length, 0);

  const ask = (i: number) => {
    const it = items[i];
    if (!it) return;
    if (!isDesktop) setSheet(true);
    const qId = nextId.current++;
    const aId = nextId.current++;
    setMessages((ms) => [...ms, { id: qId, from: "me" as const, text: it.q, q: i }].slice(-24));
    setPending((p) => p + 1);
    const wait = 650 + Math.min(it.a.length * 6, 900);
    timers.current.push(
      window.setTimeout(() => {
        setMessages((ms) => [...ms, { id: aId, from: "shop" as const, text: it.a, q: i }].slice(-24));
        setPending((p) => p - 1);
      }, wait)
    );
  };

  // A phone's sheet stops the page scrolling behind it
  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheet]);

  const chat = (onClose?: () => void) => <Chat items={items} messages={messages} typing={pending > 0} asked={asked} onAsk={ask} onClose={onClose} />;

  return (
    <>
      {/* ============ Hero ============ */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <motion.div aria-hidden className="absolute -top-40 -right-32 w-[34rem] h-[34rem] rounded-full bg-indigo-600/40 blur-3xl" animate={{ x: [0, 50, 0], y: [0, 30, 0] }} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div aria-hidden className="absolute -bottom-40 -left-32 w-[30rem] h-[30rem] rounded-full bg-emerald-500/25 blur-3xl" animate={{ x: [0, -40, 0], y: [0, -30, 0] }} transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }} />
        {FLOATING.map((f, i) => (
          <motion.span
            key={i}
            aria-hidden
            className={`absolute font-black text-white/10 select-none pointer-events-none ${f.cls}`}
            animate={{ y: [0, -18, 0], rotate: [0, 10, -8, 0] }}
            transition={{ duration: f.d, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
          >
            {f.c}
          </motion.span>
        ))}

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-10 sm:pt-16 sm:pb-14 text-center">
          <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs sm:text-sm font-bold">
            <Sparkles className="w-4 h-4 text-amber-300" />
            {items.length} سؤال وإجابة
          </motion.span>
          <motion.h1
            initial="h"
            animate="s"
            variants={{ s: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } } }}
            className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.25] tracking-tight"
          >
            {["اسأل", "واحنا", "نرد"].map((w, i) => (
              <motion.span key={i} variants={{ h: { opacity: 0, y: 30, rotate: -4 }, s: { opacity: 1, y: 0, rotate: 0 } }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="inline-block ml-3">
                {w}
              </motion.span>
            ))}
            <br />
            <motion.span
              variants={{ h: { opacity: 0, y: 30 }, s: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block bg-linear-to-l from-emerald-300 via-sky-300 to-indigo-300 bg-clip-text text-transparent cc-gradient-pan pb-2"
            >
              على طول
            </motion.span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
            كل اللي بيتسأل عن الطباعة والتصوير والأدوات المكتبية والطلب. دوس على السؤال والإجابة توصلك كأنها رسالة منّا.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-7 max-w-xl mx-auto relative">
            <Search className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="دوّر في الأسئلة... ألوان، صور، مواعيد"
              aria-label="دوّر في الأسئلة"
              className="w-full rounded-2xl bg-white text-slate-900 placeholder:text-slate-400 pr-12 pl-4 py-4 text-base shadow-2xl shadow-black/30 border-0 focus:outline-none focus:ring-4 focus:ring-emerald-400/40"
            />
          </motion.div>
        </div>

        {/* Topic tiles */}
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pb-10 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {topics.map(([t, n], k) => {
            const Icon = TOPIC_ICON[t] ?? HelpCircle;
            const active = topic === t;
            return (
              <motion.button
                key={t}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 + k * 0.08 }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setTopic(active ? ALL : t)}
                className={`relative text-right rounded-2xl p-3.5 sm:p-4 overflow-hidden cursor-pointer transition ${active ? "ring-4 ring-white/70" : "ring-1 ring-white/10"}`}
              >
                <span className={`absolute inset-0 bg-linear-to-br ${toneOf(t).tile} ${active ? "opacity-100" : "opacity-80"}`} />
                <span className="relative flex items-start justify-between gap-2">
                  <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
                  <span className="text-2xl sm:text-3xl font-black tabular-nums opacity-90">{n}</span>
                </span>
                <span className="relative block mt-3 text-sm sm:text-base font-black">{t}</span>
                <span className="relative block text-[11px] text-white/80">{active ? "دوس تاني للكل" : "سؤال"}</span>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* ============ Questions + chat ============ */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14 grid lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px] gap-8 items-start">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3 mb-5">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              {topic === ALL ? "كل الأسئلة" : topic}
              <span className="text-slate-400 font-bold text-base mr-2">({found})</span>
            </h2>
            {(topic !== ALL || query) && (
              <button onClick={() => { setTopic(ALL); setQuery(""); }} className="text-sm font-bold text-blue-700 hover:underline cursor-pointer">
                اعرض الكل
              </button>
            )}
          </div>

          {found === 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-14 rounded-3xl bg-white border border-dashed border-slate-300">
              <div className="text-5xl">🤔</div>
              <p className="mt-3 text-base font-bold text-slate-700">ملقيناش سؤال بالكلام ده</p>
              <WaLink
                text={`مرحباً مكتبة كوبي كات، عندي سؤال: ${query}`}
                className="mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 text-white text-sm font-bold"
              >
                <MessageCircle className="w-4 h-4" /> اسألنا على الواتساب
              </WaLink>
            </motion.div>
          )}

          <div className="space-y-9">
            {groups.map(([t, list]) => {
              const tone = toneOf(t);
              const Icon = TOPIC_ICON[t] ?? HelpCircle;
              return (
                <div key={t}>
                  <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="flex items-center gap-2.5 mb-3">
                    <span className={`w-10 h-10 rounded-xl bg-linear-to-br ${tone.tile} text-white flex items-center justify-center shadow-md`}>
                      <Icon className="w-5 h-5" />
                    </span>
                    <h3 className={`text-lg font-black ${tone.text}`}>{t}</h3>
                    <span className="flex-1 h-px bg-slate-200" />
                  </motion.div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {list.map(({ it, i }, k) => {
                      const done = asked.has(i);
                      return (
                        <motion.button
                          key={`${i}-${it.q}`}
                          initial={{ opacity: 0, y: 18 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, margin: "-20px" }}
                          transition={{ delay: Math.min(k, 6) * 0.05 }}
                          whileHover={{ y: -3 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => ask(i)}
                          className={`group relative text-right rounded-2xl border p-4 pr-5 flex items-start gap-3 cursor-pointer transition-shadow hover:shadow-lg hover:shadow-slate-900/5 ${done ? tone.soft : "bg-white border-slate-200"}`}
                        >
                          <span className={`text-3xl font-black leading-none tabular-nums text-transparent bg-linear-to-b ${tone.tile} bg-clip-text shrink-0 pt-1`}>{arNum(i + 1)}</span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-base sm:text-[17px] font-bold text-slate-900 leading-7">
                              <Highlight text={it.q} tokens={tokens} />
                            </span>
                            <span className={`mt-2 inline-flex items-center gap-1 text-xs font-bold ${done ? "text-emerald-700" : "text-slate-400 group-hover:text-blue-600"}`}>
                              {done ? (
                                <>
                                  <CheckCheck className="w-3.5 h-3.5" /> اتسأل، الإجابة في المحادثة
                                </>
                              ) : (
                                <>
                                  دوس وشوف الإجابة <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
                                </>
                              )}
                            </span>
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wide screens: the chat stays beside the list */}
        {isDesktop && <div className="hidden lg:block sticky top-20 h-[calc(100vh-6.5rem)] max-h-[720px]">{chat()}</div>}
      </section>

      {/* Phones: the chat opens from the bottom */}
      <AnimatePresence>
        {!isDesktop && sheet && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setSheet(false)} />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="absolute inset-x-2 bottom-2 top-14"
            >
              {chat(() => setSheet(false))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phones: back to the chat after closing it */}
      <AnimatePresence>
        {!isDesktop && !sheet && asked.size > 0 && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setSheet(true)}
            className={`fixed right-4 z-40 lg:hidden flex items-center gap-2 pl-4 pr-3 py-3 rounded-full bg-indigo-600 text-white text-sm font-black shadow-xl shadow-indigo-900/30 cursor-pointer ${totalCartCount > 0 ? "bottom-24 sm:bottom-6" : "bottom-6"}`}
          >
            <MessageCircle className="w-5 h-5" />
            المحادثة ({asked.size})
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
