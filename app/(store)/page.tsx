"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import {
  Search,
  CheckCircle2,
  MessageCircle,
  MapPin,
  FileText,
  Clock,
  Navigation,
  Compass,
  Layers,
  ExternalLink,
  Printer,
  Camera,
  IdCard,
  BookOpen,
  Zap,
  ShieldCheck,
  Wallet,
  ArrowLeft,
  Star,
  Timer,
  Package,
  Plus,
  X,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { SITE_CONFIG } from "@/lib/site-config";
import type { InventoryItem } from "@/lib/inventory";
import { ALL_CATEGORY, POPULAR_SEARCHES, categoryMeta } from "@/components/storefront/storefront-utils";
import { searchTokens, useStore } from "@/components/storefront/store-provider";
import { ProductCard } from "@/components/storefront/product-card";
import { FaqSection } from "@/components/storefront/faq-section";
import {
  CountUp,
  Highlight,
  Reveal,
  SectionHeading,
  SERVICES_CATEGORY,
  WHATSAPP_INTERNATIONAL,
  WaLink,
} from "@/components/storefront/ui";

/**
 * Customer home page: services, sections, ~20 picked products (the full catalog is /products), how to
 * order, FAQ, contact and map. Header, footer, cart and the product window come from the (store) layout.
 */

const MotionLink = motion.create(Link);
/** Products shown on the home page; the rest are on /products */
const FEATURED_COUNT = 20;

const FLOATING_DECOR = [
  { emoji: "✏️", className: "top-[6%] left-[8%] text-3xl", duration: 5.5, delay: 0 },
  { emoji: "📚", className: "bottom-[30%] left-[2%] text-4xl hidden md:block", duration: 6.5, delay: 0.6 },
  { emoji: "📎", className: "top-[10%] left-[46%] text-2xl hidden xl:block", duration: 5, delay: 1.2 },
  { emoji: "✂️", className: "bottom-[22%] left-[46%] text-3xl hidden xl:block", duration: 7, delay: 0.3 },
  { emoji: "🎨", className: "top-[4%] right-[4%] text-2xl hidden lg:block", duration: 6, delay: 0.9 },
];

const SERVICES = [
  {
    icon: Printer,
    title: "طباعة وتصوير فوري",
    text: "ابعت الملف PDF أو Word على الواتساب ونطبعه أبيض وأسود أو ألوان، تستلمه جاهز.",
    cta: "ابعت ملف للطباعة",
    message: "مرحباً مكتبة كوبي كات، أود إرسال ملف للطباعة. (عدد النسخ / ألوان أو أبيض وأسود): ",
    tone: "from-blue-600 to-indigo-600",
  },
  {
    icon: Camera,
    title: "استوديو صور شخصية 4×6",
    text: "صور للمدارس والجامعات والوظائف والباسبور، بخلفية نظيفة وطباعة على ورق صور.",
    cta: "احجز تصوير",
    message: "مرحباً مكتبة كوبي كات، أود عمل صور شخصية 4×6. العدد المطلوب: ",
    tone: "from-fuchsia-600 to-pink-600",
  },
  {
    icon: IdCard,
    title: "تغليف اوراق وشهادات",
    text: "سلوفان حراري يحمي الاوراق والشهادات من الماء والتلف.",
    cta: "اسأل عن التغليف",
    message: "مرحباً مكتبة كوبي كات، أود الاستفسار عن تغليف (ورقة / شهادة). المقاس: ",
    tone: "from-amber-500 to-orange-600",
  },
  {
    icon: BookOpen,
    title: "أبحاث ومذكرات جامعية",
    text: "تجهيز وتنسيق الأبحاث وطباعة المذكرات وتغلفها حسب طلبك.",
    cta: "اطلب بحثك",
    message: "مرحباً مكتبة كوبي كات، أود تجهيز بحث / مذكرة. الموضوع والمادة: ",
    tone: "from-emerald-600 to-teal-600",
  },
];

const ORDER_STEPS = [
  { icon: Search, title: "اختار اللي محتاجه", text: "دوّر بالاسم أو تصفح الأقسام وضيف المنتجات للسلة." },
  { icon: MessageCircle, title: "ابعت الطلب واتساب", text: "بضغطة واحدة الطلب بيتكتب لوحده بالأسعار والإجمالي." },
  { icon: CheckCircle2, title: "استلم طلبك جاهز", text: "بنأكد معاك ونجهزه بـ'تمام جاهز'، تعدي تستلمه من غير انتظار." },
];

const WHY_US = [
  { icon: Zap, title: "سرعة في التنفيذ", text: "الطباعة والصور بتخلص وانت مستني." },
  { icon: Wallet, title: "أسعار واضحة", text: "سعر كل منتج مكتوب قدامك قبل ما تطلب." },
  { icon: ShieldCheck, title: "خامات مضمونة", text: "ورق وأحبار وأدوات بجودة ثابتة." },
  { icon: Timer, title: "الواتساب شغال", text: "ابعت طلبك في أي وقت ونجهزه في اقرب وقت." },
];

/** One product from each section in turn (photos first), so the home page shows a bit of everything */
function pickFeatured(list: InventoryItem[], count: number): InventoryItem[] {
  const byCat = new Map<string, InventoryItem[]>();
  for (const p of [...list].sort((a, b) => Number(Boolean(b.image)) - Number(Boolean(a.image)))) {
    if (p.category === SERVICES_CATEGORY) continue;
    const arr = byCat.get(p.category) ?? [];
    arr.push(p);
    byCat.set(p.category, arr);
  }
  const queues = [...byCat.values()].sort((a, b) => b.length - a.length);
  const out: InventoryItem[] = [];
  for (let round = 0; out.length < count && queues.some((q) => q.length > round); round++) {
    for (const q of queues) {
      if (q[round] && out.length < count) out.push(q[round]);
    }
  }
  return out;
}

/** Search box that answers while typing: top matches, and which sections have matches */
function HeroSearch() {
  const { search, addToCart, openProduct } = useStore();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const boxRef = useRef<HTMLFormElement>(null);
  const tokens = searchTokens(query);
  const results = useMemo(() => (query.trim() ? search(query) : []), [query, search]);
  const perCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of results) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [results]);
  const show = focused && query.trim().length > 0;

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setFocused(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  const goAll = (q = query) => router.push(`/products?q=${encodeURIComponent(q.trim())}`);

  return (
    <form
      ref={boxRef}
      onSubmit={(e) => {
        e.preventDefault();
        goAll();
      }}
      className="relative"
    >
      <div className="relative flex items-center bg-white rounded-2xl border border-slate-200 shadow-xl shadow-blue-900/5 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition">
        <Search className="w-5 h-5 text-slate-400 absolute right-4 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setFocused(true);
          }}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => e.key === "Escape" && setFocused(false)}
          placeholder="بتدور على إيه؟ كشكول، ألوان، آلة حاسبة..."
          className="flex-1 min-w-0 bg-transparent border-0 rounded-2xl pr-12 pl-2 py-4 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 focus:shadow-none"
          aria-label="ابحث عن منتج"
          autoComplete="off"
        />
        <button type="submit" className="m-1.5 px-4 sm:px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition cursor-pointer shrink-0">
          {query.trim() ? (
            <motion.span key={results.length} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="inline-block tabular-nums">
              اعرض {results.length}
            </motion.span>
          ) : (
            "بحث"
          )}
        </button>
      </div>

      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 top-full mt-2 inset-x-0 bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/10 overflow-hidden text-right"
          >
            {results.length === 0 ? (
              <div className="p-5 text-center">
                <p className="text-sm font-bold text-slate-700">مفيش «{query.trim()}» على الموقع</p>
                <WaLink
                  text={`مرحباً مكتبة كوبي كات، هل متوفر عندكم: ${query.trim()}؟`}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                >
                  <MessageCircle className="w-4 h-4" /> اسأل عنه على الواتساب
                </WaLink>
              </div>
            ) : (
              <>
                {perCategory.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-3 border-b border-slate-100 bg-slate-50/70">
                    {perCategory.map(([cat, n]) => (
                      <Link
                        key={cat}
                        href={`/products?q=${encodeURIComponent(query.trim())}&cat=${encodeURIComponent(cat)}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:border-blue-400 text-[11px] font-bold text-slate-700"
                      >
                        {cat}
                        <span className="px-1.5 rounded-md bg-blue-600 text-white tabular-nums">{n}</span>
                      </Link>
                    ))}
                  </div>
                )}
                <ul className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {results.slice(0, 6).map((p, i) => (
                    <motion.li key={p.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="flex items-center gap-3 p-2.5 hover:bg-blue-50/60">
                      <button type="button" onClick={() => openProduct(p)} className="flex items-center gap-3 flex-1 min-w-0 text-right cursor-pointer">
                        <span className="relative w-11 h-11 rounded-xl overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
                          {p.image ? <Image src={p.image} alt="" fill unoptimized sizes="44px" className="object-cover" /> : <Package className="w-5 h-5 text-slate-300" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-slate-900 line-clamp-1">
                            <Highlight text={p.name} tokens={tokens} />
                          </span>
                          <span className="block text-[11px] text-slate-500">{p.category}</span>
                        </span>
                      </button>
                      <span className="text-sm font-black text-emerald-600 whitespace-nowrap">{formatCurrency(p.price)}</span>
                      <button
                        type="button"
                        onClick={(e) => addToCart(p, 1, e.currentTarget)}
                        className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-blue-600 text-white flex items-center justify-center shrink-0 cursor-pointer"
                        aria-label="أضف للسلة"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </motion.li>
                  ))}
                </ul>
                <button type="submit" className="w-full p-3 text-sm font-black text-blue-700 bg-blue-50 hover:bg-blue-100 flex items-center justify-center gap-1.5 cursor-pointer">
                  اعرض كل النتائج ({results.length}) في صفحة المنتجات
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-3 flex flex-wrap items-center justify-center lg:justify-start gap-1.5">
        <span className="text-xs text-slate-500 font-bold ml-1">الأكثر بحثاً:</span>
        {POPULAR_SEARCHES.slice(0, 6).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setQuery(s);
              setFocused(true);
            }}
            className="px-2.5 py-1 rounded-full bg-white/80 border border-slate-200 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700 transition cursor-pointer"
          >
            {s}
          </button>
        ))}
        {query && (
          <button type="button" onClick={() => setQuery("")} className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="امسح البحث">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </form>
  );
}

export default function StorefrontHome() {
  const { listable, categories, categoryCounts, openProduct, isStoreOpen } = useStore();
  const [mapType, setMapType] = useState<"k" | "m">("k");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  /* WhatsApp QR for the contact section */
  useEffect(() => {
    let cancelled = false;
    import("qrcode")
      .then((QR) =>
        QR.toDataURL(`https://wa.me/${WHATSAPP_INTERNATIONAL}`, { margin: 1, width: 360, color: { dark: "#064e3b", light: "#ffffff" } })
      )
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const featuredServices = useMemo(() => listable.filter((p) => p.category === SERVICES_CATEGORY).slice(0, 4), [listable]);
  const featured = useMemo(() => pickFeatured(listable, FEATURED_COUNT), [listable]);

  /* Hero parallax */
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroImageY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const heroImageRotate = useTransform(scrollYProgress, [0, 1], [-2, 2]);

  return (
    <>
        <section ref={heroRef} className="relative overflow-hidden bg-gradient-to-b from-white via-blue-50/60 to-slate-50">
          {/* Animated colour blobs */}
          <motion.div
            aria-hidden
            className="absolute -top-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-blue-400/25 blur-3xl"
            animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="absolute top-40 -left-24 w-[24rem] h-[24rem] rounded-full bg-fuchsia-400/20 blur-3xl"
            animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="absolute bottom-0 right-1/3 w-[20rem] h-[20rem] rounded-full bg-amber-300/25 blur-3xl"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          {FLOATING_DECOR.map((d, i) => (
            <motion.span
              key={i}
              aria-hidden
              className={`absolute select-none pointer-events-none drop-shadow-sm ${d.className}`}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 0.9, scale: 1, y: [0, -14, 0], rotate: [0, 8, -6, 0] }}
              transition={{
                opacity: { delay: 0.4 + d.delay, duration: 0.6 },
                scale: { delay: 0.4 + d.delay, duration: 0.6 },
                y: { duration: d.duration, repeat: Infinity, ease: "easeInOut", delay: d.delay },
                rotate: { duration: d.duration * 1.3, repeat: Infinity, ease: "easeInOut", delay: d.delay },
              }}
            >
              {d.emoji}
            </motion.span>
          ))}

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-14 sm:pt-16 sm:pb-20 grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            {/* Copy */}
            <div className="text-center lg:text-right">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur border border-slate-200 text-slate-700 text-xs font-bold shadow-sm"
              >
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">{SITE_CONFIG.store.hoursDisplay}</span>
                <span className="sm:hidden">9 ص - 10 م</span>
                <span className="text-slate-300">•</span>
                {isStoreOpen ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <span className="relative flex w-2 h-2">
                      <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-70" />
                      <span className="relative w-2 h-2 rounded-full bg-emerald-500" />
                    </span>
                    مفتوح الآن
                  </span>
                ) : (
                  <span className="text-rose-600">مغلق الآن • يفتح 9 ص</span>
                )}
              </motion.div>

              <motion.h1
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }}
                className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15] text-slate-900"
              >
                {["كل", "اللي", "تحتاجه"].map((w, i) => (
                  <motion.span
                    key={i}
                    variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="inline-block ml-3"
                  >
                    {w}
                  </motion.span>
                ))}
                <br />
                <motion.span
                  variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="inline-block bg-gradient-to-l from-blue-600 via-indigo-600 to-fuchsia-600 bg-clip-text text-transparent cc-gradient-pan pb-2"
                >
                  للمدرسة والشغل
                </motion.span>
                <motion.span
                  variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } }}
                  className="inline-block mr-3"
                >
                  في مكان واحد
                </motion.span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.5 }}
                className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl mx-auto lg:mx-0"
              >
                طباعة فورية، صور شخصية 4×6، وأكتر من{" "}
                <span className="font-black text-slate-900">{listable.length} صنف</span> أدوات مكتبية ومدرسية
                بأسعار واضحة. اختار واطلب على الواتساب في ثواني.
              </motion.p>

              {/* Big search: results show up under it with every letter */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.5 }}
                className="mt-7 max-w-xl mx-auto lg:mx-0"
              >
                <HeroSearch />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, duration: 0.5 }}
                className="mt-7 flex flex-wrap items-center justify-center lg:justify-start gap-3"
              >
                <WaLink
                  text="مرحباً مكتبة كوبي كات، أود إرسال ملف للطباعة."
                  className="group relative inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black shadow-lg shadow-emerald-600/30 transition overflow-hidden"
                >
                  <span className="absolute inset-0 cc-shine" aria-hidden />
                  <FileText className="w-5 h-5" />
                  <span>ابعت ملف للطباعة واتساب</span>
                </WaLink>
                <Link
                  href="/products"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 text-slate-800 text-sm font-bold shadow-sm transition group"
                >
                  <span>تصفح كل المنتجات</span>
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                </Link>
              </motion.div>
            </div>

            {/* Storefront photo with floating cards */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative mx-auto w-full max-w-xl"
            >
              <motion.div
                style={{ y: heroImageY, rotate: heroImageRotate }}
                className="relative aspect-[16/10] rounded-[2rem] overflow-hidden shadow-2xl shadow-blue-900/20 ring-8 ring-white"
              >
                <Image
                  src="/images/storefront-360.jpg"
                  alt="واجهة مكتبة كوبي كات"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 560px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent" />
              </motion.div>

              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-6 -right-2 sm:-right-6 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 flex items-center gap-2.5"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Printer className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-slate-900">طباعة فورية</div>
                  <div className="text-[11px] text-slate-500">أبيض وأسود وألوان</div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute -top-5 -left-2 sm:-left-6 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 flex items-center gap-2.5"
              >
                <div className="w-10 h-10 rounded-xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-slate-900">صور 4×6</div>
                  <div className="text-[11px] text-slate-500">استلم في نفس اليوم</div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="hidden sm:flex absolute top-1/2 -left-10 bg-emerald-600 text-white rounded-2xl shadow-xl p-3 items-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                <div className="text-xs font-black">اطلب واتساب</div>
              </motion.div>
            </motion.div>
          </div>

          {/* Stats strip */}
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pb-12">
            <Reveal>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 bg-white/80 backdrop-blur-xl rounded-3xl border border-slate-200 shadow-lg shadow-slate-900/5 p-4 sm:p-6">
                {[
                  { value: listable.length, suffix: "+", label: "صنف متاح" },
                  { value: Math.max(categories.length - 1, 1), suffix: "", label: "قسم منظم" },
                  { value: SITE_CONFIG.store.closeHour - SITE_CONFIG.store.openHour, suffix: " ساعة", label: "شغالين يومياً" },
                  { value: 24, suffix: "/7", label: "استقبال طلبات واتساب" },
                ].map((s, i) => (
                  <div key={i} className="text-center">
                    <div className="text-2xl sm:text-3xl font-black text-blue-700">
                      <CountUp to={s.value} suffix={s.suffix} />
                    </div>
                    <div className="text-xs sm:text-sm text-slate-600 font-semibold mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ============ Services ============ */}
        <section id="services" className="scroll-mt-20 max-w-7xl mx-auto w-full px-4 sm:px-6 py-14 sm:py-20">
          <SectionHeading
            eyebrow="خدمات المكتبة"
            title={
              <>
                خدمات بتخلص <span className="text-blue-600">وانت مستني</span>
              </>
            }
            subtitle="ابعت طلبك على الواتساب وإحنا نجهزه، ولما توصل تلاقيه مستنيك."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {SERVICES.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="group relative h-full bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:shadow-xl hover:shadow-slate-900/5 transition-shadow overflow-hidden flex flex-col"
                >
                  <div
                    className={`absolute -top-12 -left-12 w-32 h-32 rounded-full bg-gradient-to-br ${s.tone} opacity-10 group-hover:opacity-20 group-hover:scale-125 transition duration-500`}
                  />
                  <div
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${s.tone} text-white flex items-center justify-center shadow-lg group-hover:rotate-6 transition`}
                  >
                    <s.icon className="w-6 h-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-black text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed flex-1">{s.text}</p>
                  <WaLink
                    text={s.message}
                    className="mt-5 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 group-hover:bg-emerald-600 text-white text-xs font-bold transition"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {s.cta}
                  </WaLink>
                </motion.div>
              </Reveal>
            ))}
          </div>

          {featuredServices.length > 0 && (
            <Reveal delay={0.1} className="mt-6">
              <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                <span className="text-slate-500 font-semibold">أسعار الخدمات:</span>
                {featuredServices.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => openProduct(p)}
                    className="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-blue-400 text-xs font-bold text-slate-700 transition cursor-pointer"
                  >
                    {p.name.length > 34 ? `${p.name.slice(0, 34)}…` : p.name}
                    <span className="text-emerald-600 mr-1.5">{formatCurrency(p.price)}</span>
                  </button>
                ))}
                <Link
                  href={`/products?cat=${encodeURIComponent(SERVICES_CATEGORY)}`}
                  className="px-3 py-1.5 rounded-full text-xs font-bold text-blue-700 hover:underline"
                >
                  كل الخدمات ←
                </Link>
              </div>
            </Reveal>
          )}
        </section>

        {/* ============ Categories ============ */}
        <section id="categories" className="scroll-mt-20 bg-white border-y border-slate-200/80">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-14 sm:py-20">
            <SectionHeading
              eyebrow="تسوق بالقسم"
              title={
                <>
                  اختار القسم <span className="text-blue-600">ووصل أسرع</span>
                </>
              }
              subtitle="كل منتجات المكتبة مترتبة في أقسام، دوس على القسم وتشوف كل اللي فيه."
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              {categories
                .filter((c) => c !== ALL_CATEGORY)
                .map((cat, i) => {
                  const meta = categoryMeta(cat);
                  return (
                    <Reveal key={cat} delay={Math.min(i, 8) * 0.04}>
                      <MotionLink
                        whileHover={{ y: -5 }}
                        whileTap={{ scale: 0.97 }}
                        href={`/products?cat=${encodeURIComponent(cat)}`}
                        className="group relative block w-full h-full text-right bg-slate-50 hover:bg-white rounded-2xl border border-slate-200 hover:border-blue-300 p-4 transition-colors overflow-hidden"
                      >
                        <div
                          className={`absolute inset-0 bg-gradient-to-br ${meta.glow} to-transparent opacity-0 group-hover:opacity-100 transition duration-300`}
                        />
                        <div className="relative">
                          <div
                            className={`w-11 h-11 rounded-xl ${meta.tone} flex items-center justify-center group-hover:scale-110 group-hover:-rotate-6 transition`}
                          >
                            <meta.icon className="w-5 h-5" />
                          </div>
                          <div className="mt-3 text-sm font-black text-slate-900 leading-snug">{cat}</div>
                          <div className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">{meta.blurb}</div>
                          <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-blue-700">
                            {categoryCounts.get(cat) ?? 0} صنف
                            <ArrowLeft className="w-3 h-3 transition-transform group-hover:-translate-x-1" />
                          </div>
                        </div>
                      </MotionLink>
                    </Reveal>
                  );
                })}
            </div>
          </div>
        </section>

        {/* ============ Picked products (the full catalog is /products) ============ */}
        <section id="catalog" className="scroll-mt-20 max-w-7xl mx-auto w-full px-4 sm:px-6 py-14 sm:py-20">
          <SectionHeading
            eyebrow="من المكتبة"
            title={
              <>
                منتجات مختارة <span className="text-blue-600">من كل قسم</span>
              </>
            }
            subtitle={`دي ${featured.length} منتج بس من أكتر من ${listable.length} صنف. كل المنتجات بالبحث والأقسام في صفحة المنتجات.`}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {featured.map((item, idx) => (
              <ProductCard key={item.id} item={item} index={idx} />
            ))}
          </div>
          <Reveal className="mt-8 text-center">
            <MotionLink
              href="/products"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="group relative inline-flex items-center gap-2.5 px-7 py-4 rounded-2xl bg-slate-900 text-white text-base font-black shadow-xl shadow-slate-900/20 overflow-hidden"
            >
              <span className="absolute inset-0 cc-shine" aria-hidden />
              شوف كل المنتجات ({listable.length})
              <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1.5" />
            </MotionLink>
          </Reveal>
        </section>

        {/* ============ How to order ============ */}
        <section id="how" className="scroll-mt-20 bg-linear-to-b from-white to-blue-50/50 border-y border-slate-200/80">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <SectionHeading
              eyebrow="سهلة جداً"
              title={
                <>
                  إزاي تطلب <span className="text-blue-600">في 3 خطوات</span>
                </>
              }
            />
            <div className="relative grid md:grid-cols-3 gap-5">
              <div className="hidden md:block absolute top-10 right-[16%] left-[16%] h-0.5 bg-linear-to-l from-blue-200 via-blue-400 to-emerald-300" />
              {ORDER_STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 0.12} className="relative text-center">
                  <motion.div
                    whileInView={{ scale: [0.6, 1.1, 1] }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 + i * 0.15, duration: 0.5 }}
                    className="relative mx-auto w-20 h-20 rounded-3xl bg-white border-2 border-blue-100 shadow-lg shadow-blue-900/5 flex items-center justify-center"
                  >
                    <s.icon className="w-8 h-8 text-blue-600" />
                    <span className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-black flex items-center justify-center ring-4 ring-white">
                      {(i + 1).toLocaleString("ar-EG")}
                    </span>
                  </motion.div>
                  <h3 className="mt-4 text-lg font-black text-slate-900">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600 max-w-xs mx-auto leading-relaxed">{s.text}</p>
                </Reveal>
              ))}
            </div>

            <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {WHY_US.map((w, i) => (
                <Reveal key={w.title} delay={i * 0.06}>
                  <div className="h-full bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-3 hover:border-blue-300 transition">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                      <w.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900">{w.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{w.text}</div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ============ FAQ ============ */}
        <FaqSection />

        {/* ============ Contact + WhatsApp CTA ============ */}
        <section id="contact" className="scroll-mt-20 max-w-7xl mx-auto w-full px-4 sm:px-6 py-14 sm:py-20">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2rem] bg-linear-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white p-6 sm:p-10 lg:p-12 shadow-2xl shadow-emerald-900/20">
              <motion.div
                aria-hidden
                className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/10 blur-2xl"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                aria-hidden
                className="absolute -bottom-24 right-1/3 w-80 h-80 rounded-full bg-teal-300/20 blur-3xl"
                animate={{ x: [0, 30, 0] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="relative grid lg:grid-cols-[1fr_auto] gap-8 items-center">
                <div className="text-center lg:text-right">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-bold">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    أسرع طريقة تطلب بيها
                  </span>
                  <h2 className="mt-4 text-3xl sm:text-4xl font-black leading-tight">
                    كلمنا على الواتساب
                    <br />
                    وطلبك يبقى جاهز قبل ما توصل
                  </h2>
                  <p className="mt-3 text-emerald-50/90 text-sm sm:text-base max-w-xl mx-auto lg:mx-0 leading-relaxed">
                    ابعت الملفات، اسأل عن أي منتج أو سعر، أو احجز صورك. بنرد في مواعيد العمل، والرسايل
                    اللي بتوصل بالليل بنجهزها أول ما نفتح.
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                    <WaLink
                      text="مرحباً مكتبة كوبي كات 👋"
                      className="relative inline-flex items-center gap-2 px-7 py-4 rounded-2xl bg-white text-emerald-800 text-base font-black shadow-xl hover:scale-[1.03] transition overflow-hidden"
                    >
                      <MessageCircle className="w-5 h-5" />
                      ابدأ محادثة واتساب
                    </WaLink>
                    {/*<a
                      href={`tel:${WHATSAPP_NUMBER}`}
                      className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/30 text-white text-base font-bold transition"
                    >
                      <Phone className="w-5 h-5" />
                      <span dir="ltr">{WHATSAPP_NUMBER}</span>
                    </a>*/ }
                  </div>
                </div>

                <div className="hidden sm:flex flex-col items-center gap-2 mx-auto">
                  <motion.div
                    whileHover={{ rotate: -3, scale: 1.04 }}
                    className="bg-white rounded-3xl p-3 shadow-2xl"
                  >
                    {qrDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qrDataUrl} alt="كود واتساب مكتبة كوبي كات" className="w-40 h-40" />
                    ) : (
                      <div className="w-40 h-40 rounded-xl cc-shimmer" />
                    )}
                  </motion.div>
                  <span className="text-xs text-emerald-50/90 font-semibold">صوّر الكود بكاميرا الموبايل</span>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ============ Map ============ */}
        <section id="location-map" className="max-w-7xl mx-auto w-full px-4 sm:px-6 pb-16">
          <Reveal>
            <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-sm space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-100">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>تعالى زورنا</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">مكان مكتبة كوبي كات</h2>
                  <p className="text-sm text-slate-500 max-w-2xl">{SITE_CONFIG.store.address}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={SITE_CONFIG.store.directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition"
                  >
                    <Navigation className="w-4 h-4 shrink-0" />
                    <span>وصّلني للمكتبة</span>
                  </a>
                  <a
                    href={SITE_CONFIG.store.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Google Maps</span>
                  </a>
                </div>
              </div>

              <div className="relative w-full h-[360px] sm:h-[460px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                <iframe
                  title="موقع مكتبة كوبي كات"
                  src={`https://maps.google.com/maps?q=${SITE_CONFIG.store.coordinates.lat},${SITE_CONFIG.store.coordinates.lng}+(%D9%85%D9%83%D8%AA%D8%A8%D8%A9+%D9%83%D9%88%D8%A8%D9%8A+%D9%83%D8%A7%D8%AA+Copy+Cat)&t=${mapType}&z=19&ie=UTF8&iwloc=B&output=embed`}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full h-full"
                />
                <div className="absolute top-3 right-3 flex gap-1 bg-white/95 backdrop-blur p-1 rounded-xl shadow-md">
                  {(
                    [
                      ["k", "قمر صناعي", Layers],
                      ["m", "شوارع", Compass],
                    ] as const
                  ).map(([key, label, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMapType(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${mapType === key ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"
                        }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  ["🕌", "مسجد المطافي", "على بُعد خطوات في نفس الشارع"],
                  ["🏥", "مركز نور الحياة", "المكتبة أمامه مباشرة"],
                  ["📍", "عرايشية مصر", "شارع الدقهلية - سهل الوصول بالعربية أو مشي"],
                ].map(([emoji, title, text]) => (
                  <div key={title} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-2.5">
                    <span className="text-xl shrink-0">{emoji}</span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{title}</h4>
                      <p className="text-xs text-slate-500">{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>
    </>
  );
}
