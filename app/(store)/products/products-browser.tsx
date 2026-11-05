"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ImageIcon,
  LayoutGrid,
  List,
  MessageCircle,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import type { InventoryItem } from "@/lib/inventory";
import { ALL_CATEGORY, POPULAR_SEARCHES, SORT_OPTIONS, categoryMeta, type SortKey } from "@/components/storefront/storefront-utils";
import { searchTokens, useStore } from "@/components/storefront/store-provider";
import { ProductCard } from "@/components/storefront/product-card";
import { CountUp, WaLink } from "@/components/storefront/ui";

/**
 * /products: the whole catalog. Search updates with every letter; the section list shows how many matches
 * each section has, so a word found in another section is never hidden behind "nothing here". Filters
 * live in the address (?q=&cat=&sort=) so a search can be shared or reloaded.
 */

const PAGE_SIZE = 24;

const PRICE_BANDS: { id: string; label: string; min: number; max: number }[] = [
  { id: "u10", label: "أقل من 10 ج", min: 0, max: 10 },
  { id: "10-25", label: "10 - 25 ج", min: 10, max: 25 },
  { id: "25-50", label: "25 - 50 ج", min: 25, max: 50 },
  { id: "50-100", label: "50 - 100 ج", min: 50, max: 100 },
  { id: "100+", label: "أكتر من 100 ج", min: 100, max: Infinity },
];

export function ProductsBrowser() {
  const { listable, categories, search } = useStore();
  const params = useSearchParams();
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [category, setCategory] = useState(() => params.get("cat") ?? ALL_CATEGORY);
  const [sortKey, setSortKey] = useState<SortKey>(() => (SORT_OPTIONS.some((o) => o.key === params.get("sort")) ? (params.get("sort") as SortKey) : "default"));
  const [band, setBand] = useState<string | null>(null);
  const [photosOnly, setPhotosOnly] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const tokens = useMemo(() => searchTokens(query), [query]);

  // Remember grid / list per device
  useEffect(() => {
    try {
      const v = localStorage.getItem("copycat_products_view");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- per-device preference, client only
      if (v === "list" || v === "grid") setView(v);
    } catch {}
    if (params.get("focus")) searchRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the address in step with the filters (no navigation, no scroll)
  useEffect(() => {
    const sp = new URLSearchParams();
    if (query.trim()) sp.set("q", query.trim());
    if (category !== ALL_CATEGORY) sp.set("cat", category);
    if (sortKey !== "default") sp.set("sort", sortKey);
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `/products?${qs}` : "/products");
  }, [query, category, sortKey]);

  /* Search over every section, then the other filters (price, photos) */
  const matches = useMemo(() => {
    const b = PRICE_BANDS.find((x) => x.id === band);
    return search(query).filter((p) => (!b || (p.price >= b.min && p.price < b.max)) && (!photosOnly || Boolean(p.image)));
  }, [search, query, band, photosOnly]);

  /** Matches per section: the section list shows these while searching */
  const countByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of matches) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return m;
  }, [matches]);

  const results = useMemo(() => {
    const list = category === ALL_CATEGORY ? [...matches] : matches.filter((p) => p.category === category);
    if (sortKey === "price-asc") list.sort((a, b) => a.price - b.price);
    else if (sortKey === "price-desc") list.sort((a, b) => b.price - a.price);
    else if (sortKey === "name") list.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    return list;
  }, [matches, category, sortKey]);

  /** Same search found in other sections (shown when the chosen section has few or none) */
  const elsewhere = useMemo(
    () => (category === ALL_CATEGORY || !query.trim() ? [] : [...countByCat.entries()].filter(([c]) => c !== category).sort((a, b) => b[1] - a[1])),
    [countByCat, category, query]
  );

  /* Infinite scroll */
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = visible < results.length;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setVisible((v) => v + PAGE_SIZE), { rootMargin: "700px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, visible]);

  const resetPaging = () => setVisible(PAGE_SIZE);
  const pickCategory = (c: string) => {
    setCategory(c);
    resetPaging();
    setFiltersOpen(false);
    document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const clearAll = () => {
    setQuery("");
    setCategory(ALL_CATEGORY);
    setSortKey("default");
    setBand(null);
    setPhotosOnly(false);
    resetPaging();
  };
  const setViewMode = (v: "grid" | "list") => {
    setView(v);
    try {
      localStorage.setItem("copycat_products_view", v);
    } catch {}
  };

  const total = (c: string) => (c === ALL_CATEGORY ? matches.length : countByCat.get(c) ?? 0);
  const activeMeta = categoryMeta(category);
  const filtersOn = query.trim() !== "" || category !== ALL_CATEGORY || band !== null || photosOnly || sortKey !== "default";

  const categoryList = (compact: boolean) => (
    <LayoutGroup id={compact ? "cats-m" : "cats-d"}>
      <div className={compact ? "flex gap-1.5 overflow-x-auto scrollbar-none pb-1" : "space-y-1"}>
        {categories.map((c) => {
          const meta = categoryMeta(c);
          const n = total(c);
          const active = category === c;
          const dim = query.trim() !== "" && n === 0;
          return (
            <button
              key={c}
              onClick={() => pickCategory(c)}
              className={`relative flex items-center gap-2 rounded-xl text-right transition-colors cursor-pointer ${
                compact ? "shrink-0 px-3 py-2 text-xs font-bold" : "w-full px-3 py-2.5 text-sm font-bold"
              } ${active ? "text-white" : dim ? "text-slate-400" : "text-slate-700 hover:bg-slate-100"}`}
            >
              {active && (
                <motion.span layoutId="cat-active" className="absolute inset-0 rounded-xl bg-blue-600 shadow-md shadow-blue-600/30" transition={{ type: "spring", stiffness: 420, damping: 32 }} />
              )}
              <span className={`relative w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${active ? "bg-white/20" : meta.tone}`}>
                <meta.icon className="w-4 h-4" />
              </span>
              <span className={`relative ${compact ? "whitespace-nowrap" : "flex-1 min-w-0 truncate"}`}>{c}</span>
              <motion.span
                key={n}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`relative text-[10px] min-w-6 px-1.5 py-0.5 rounded-md text-center tabular-nums ${
                  active ? "bg-white/25" : query.trim() && n > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"
                }`}
              >
                {n}
              </motion.span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );

  const priceFilters = (
    <div className="flex flex-wrap gap-1.5">
      {PRICE_BANDS.map((b) => (
        <button
          key={b.id}
          onClick={() => {
            setBand(band === b.id ? null : b.id);
            resetPaging();
          }}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
            band === b.id ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-emerald-400"
          }`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex-1">
      {/* ============ Page header ============ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-700 via-indigo-700 to-indigo-800 text-white">
        {categories.slice(1, 9).map((c, i) => {
          const Icon = categoryMeta(c).icon;
          return (
            <motion.span
              key={c}
              aria-hidden
              className="absolute text-white/10"
              style={{ top: `${12 + ((i * 37) % 70)}%`, left: `${(i * 13 + 4) % 96}%` }}
              animate={{ y: [0, -12, 0], rotate: [0, i % 2 ? 12 : -12, 0] }}
              transition={{ duration: 5 + (i % 3), repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
            >
              <Icon className="w-10 h-10 sm:w-14 sm:h-14" />
            </motion.span>
          );
        })}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-10 sm:pt-12 sm:pb-14">
          <Link href="/" className="inline-flex items-center gap-1 text-xs font-bold text-blue-100 hover:text-white">
            <ArrowRight className="w-3.5 h-3.5" /> الرئيسية
          </Link>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight"
          >
            كل منتجات المكتبة
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-2 text-sm sm:text-base text-blue-100">
            <span className="font-black text-white">
              <CountUp to={listable.length} />
            </span>{" "}
            صنف في{" "}
            <span className="font-black text-white">
              <CountUp to={Math.max(categories.length - 1, 1)} />
            </span>{" "}
            قسم، بالأسعار. ضيف للسلة وابعت الطلب كله على الواتساب مرة واحدة.
          </motion.p>

          {/* Search: results change with every letter */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6 max-w-2xl">
            <div className="relative flex items-center bg-white rounded-2xl shadow-2xl shadow-indigo-950/30 focus-within:ring-4 focus-within:ring-white/30">
              <Search className="w-5 h-5 text-slate-400 absolute right-4 pointer-events-none" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  resetPaging();
                }}
                placeholder="اكتب اسم المنتج... (كشكول، قلم، ألوان، ملف)"
                className="flex-1 min-w-0 bg-transparent border-0 rounded-2xl pr-12 pl-3 py-4 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                aria-label="ابحث عن منتج"
                autoComplete="off"
              />
              <AnimatePresence>
                {query && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    onClick={() => {
                      setQuery("");
                      searchRef.current?.focus();
                    }}
                    className="ml-2 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
                    aria-label="امسح البحث"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                )}
              </AnimatePresence>
              <motion.span
                key={`${query}-${results.length}`}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="ml-2 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-sm font-black tabular-nums whitespace-nowrap"
              >
                {results.length} صنف
              </motion.span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-blue-100 font-bold ml-1">جرب:</span>
              {POPULAR_SEARCHES.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setQuery(s);
                    resetPaging();
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                    query === s ? "bg-white text-indigo-700" : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <div id="results" className="scroll-mt-16 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 grid lg:grid-cols-[250px_minmax(0,1fr)] gap-6 items-start">
        {/* ============ Side filters (desktop) ============ */}
        <aside className="hidden lg:block sticky top-20 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm">
            <h2 className="px-2 pb-2 text-xs font-black text-slate-500 flex items-center justify-between">
              الأقسام
              {query.trim() && <span className="text-[10px] text-amber-700 font-bold">الأرقام = نتايج البحث</span>}
            </h2>
            {categoryList(false)}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm space-y-3">
            <h2 className="px-1 text-xs font-black text-slate-500">السعر</h2>
            {priceFilters}
            <label className="flex items-center gap-2 px-1 text-sm font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={photosOnly}
                onChange={(e) => {
                  setPhotosOnly(e.target.checked);
                  resetPaging();
                }}
                className="w-4 h-4 accent-blue-600"
              />
              <ImageIcon className="w-4 h-4 text-slate-400" /> اللي ليها صور بس
            </label>
          </div>
          <WaLink
            text="مرحباً مكتبة كوبي كات، بدور على منتج مش لاقيه في الموقع: "
            className="block bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-4 shadow-lg shadow-emerald-900/10"
          >
            <MessageCircle className="w-6 h-6" />
            <div className="mt-2 text-sm font-black">مش لاقي حاجة؟</div>
            <div className="text-xs text-emerald-50/90 mt-0.5">مش كل اللي في المكتبة متصور على الموقع. اسألنا واتساب.</div>
          </WaLink>
        </aside>

        {/* ============ Results ============ */}
        <div className="min-w-0 space-y-4">
          {/* Toolbar */}
          <div className="sticky top-16 z-30 -mx-4 sm:mx-0 px-4 sm:px-0 py-2 bg-slate-50/90 backdrop-blur-xl">
            <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-sm space-y-2.5">
              <div className="lg:hidden">{categoryList(true)}</div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setFiltersOpen((o) => !o)}
                  className={`lg:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                    band || photosOnly ? "border-emerald-500 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-700"
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" /> السعر والصور
                </button>
                <div className="relative">
                  <ArrowUpDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={sortKey}
                    onChange={(e) => {
                      setSortKey(e.target.value as SortKey);
                      resetPaging();
                    }}
                    className="appearance-none bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-8 py-2 text-xs sm:text-sm font-bold text-slate-700 focus:outline-none cursor-pointer"
                    aria-label="ترتيب المنتجات"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <div className="flex rounded-xl bg-slate-100 p-1 mr-auto">
                  {(
                    [
                      ["grid", LayoutGrid, "شبكة"],
                      ["list", List, "قائمة"],
                    ] as const
                  ).map(([v, Icon, label]) => (
                    <button
                      key={v}
                      onClick={() => setViewMode(v)}
                      className={`relative px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${view === v ? "text-blue-700" : "text-slate-500"}`}
                      aria-label={label}
                    >
                      {view === v && <motion.span layoutId="view-pill" className="absolute inset-0 rounded-lg bg-white shadow-sm" />}
                      <Icon className="relative w-4 h-4" />
                      <span className="relative hidden sm:inline">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <AnimatePresence initial={false}>
                {filtersOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="lg:hidden overflow-hidden space-y-2"
                  >
                    {priceFilters}
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input type="checkbox" checked={photosOnly} onChange={(e) => setPhotosOnly(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                      اللي ليها صور بس
                    </label>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Chosen section */}
          <AnimatePresence mode="wait">
            {category !== ALL_CATEGORY && (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-3`}
              >
                <div className={`absolute inset-0 bg-gradient-to-l ${activeMeta.glow} to-transparent opacity-60`} />
                <motion.span
                  initial={{ rotate: -20, scale: 0.6 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 14 }}
                  className={`relative w-12 h-12 rounded-2xl flex items-center justify-center ${activeMeta.tone}`}
                >
                  <activeMeta.icon className="w-6 h-6" />
                </motion.span>
                <div className="relative flex-1 min-w-0">
                  <div className="text-lg font-black text-slate-900">{category}</div>
                  <div className="text-xs text-slate-600">{activeMeta.blurb}</div>
                </div>
                <button onClick={() => pickCategory(ALL_CATEGORY)} className="relative text-xs font-bold text-blue-700 hover:underline cursor-pointer">
                  كل الأقسام
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result line + active filters */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 px-1">
            <span>
              {query.trim() ? (
                <>
                  نتائج <span className="font-black text-slate-900">«{query.trim()}»</span>:{" "}
                </>
              ) : null}
              <span className="font-black text-slate-900 tabular-nums">{results.length}</span> صنف
              {category !== ALL_CATEGORY && <> في {category}</>}
            </span>
            {band && (
              <FilterChip label={PRICE_BANDS.find((b) => b.id === band)?.label ?? ""} onClear={() => setBand(null)} />
            )}
            {photosOnly && <FilterChip label="بصور بس" onClear={() => setPhotosOnly(false)} />}
            {filtersOn && (
              <button onClick={clearAll} className="mr-auto text-xs font-bold text-blue-700 hover:underline cursor-pointer">
                مسح كل الفلاتر
              </button>
            )}
          </div>

          {/* The same search in other sections */}
          <AnimatePresence>
            {elsewhere.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div
                  className={`rounded-2xl border p-4 ${
                    results.length === 0 ? "border-amber-300 bg-amber-50" : "border-blue-100 bg-blue-50/60"
                  }`}
                >
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className={`w-4 h-4 ${results.length === 0 ? "text-amber-600" : "text-blue-600"}`} />
                    {results.length === 0 ? (
                      <>
                        مفيش «{query.trim()}» في قسم {category}، بس لقيناه في{" "}
                        {elsewhere.length === 1 ? "قسم تاني" : `${elsewhere.length} أقسام تانية`}:
                      </>
                    ) : (
                      <>ولقينا «{query.trim()}» كمان في:</>
                    )}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {elsewhere.map(([c, n], i) => {
                      const meta = categoryMeta(c);
                      return (
                        <motion.button
                          key={c}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.05 }}
                          whileHover={{ y: -2 }}
                          onClick={() => pickCategory(c)}
                          className="inline-flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-sm font-bold text-slate-800 shadow-sm cursor-pointer"
                        >
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${meta.tone}`}>
                            <meta.icon className="w-4 h-4" />
                          </span>
                          {c}
                          <span className="px-2 py-0.5 rounded-lg bg-blue-600 text-white text-xs tabular-nums">{n}</span>
                        </motion.button>
                      );
                    })}
                    <button onClick={() => pickCategory(ALL_CATEGORY)} className="px-3 py-1.5 rounded-xl text-sm font-bold text-blue-700 hover:underline cursor-pointer">
                      اعرضهم كلهم ({matches.length})
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Grid / list */}
          <motion.div
            layout
            className={
              view === "grid"
                ? "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4"
                : "grid grid-cols-1 md:grid-cols-2 gap-2.5"
            }
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {results.slice(0, visible).map((item: InventoryItem, idx) => (
                <motion.div key={`${view}-${item.id}`} layout exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }}>
                  <ProductCard item={item} index={idx} tokens={tokens} view={view} animateIn="now" />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          <div ref={sentinelRef} className="h-1" />
          {hasMore && (
            <div className="text-center">
              <button
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="px-6 py-3 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-bold shadow-sm cursor-pointer"
              >
                عرض المزيد ({results.length - visible} صنف متبقي)
              </button>
            </div>
          )}

          {results.length === 0 && elsewhere.length === 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="py-14 px-4 text-center bg-white rounded-3xl border border-dashed border-slate-300">
              <motion.div animate={{ rotate: [0, -12, 12, 0] }} transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.5 }} className="text-5xl mb-3 inline-block">
                🔍
              </motion.div>
              <p className="text-base font-black text-slate-800">مش لاقيين «{query.trim() || category}» على الموقع</p>
              <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">مش كل حاجة عندنا متصورة على الموقع. اسألنا على الواتساب وهنرد عليك بالتوفر والسعر.</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <WaLink
                  text={`مرحباً مكتبة كوبي كات، هل متوفر عندكم: ${query.trim() || category}؟`}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition"
                >
                  <MessageCircle className="w-4 h-4" />
                  اسأل عنه على الواتساب
                </WaLink>
                <button onClick={clearAll} className="px-5 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
                  اعرض كل المنتجات
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <BackToTop />
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="inline-flex items-center gap-1 pl-1 pr-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800"
    >
      {label}
      <button onClick={onClear} className="w-5 h-5 rounded-full hover:bg-emerald-100 flex items-center justify-center cursor-pointer" aria-label={`شيل ${label}`}>
        <X className="w-3 h-3" />
      </button>
    </motion.span>
  );
}

function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 1200);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed right-4 bottom-24 sm:bottom-6 z-40 w-12 h-12 rounded-full bg-white border border-slate-200 shadow-xl text-slate-700 hover:text-blue-700 flex items-center justify-center cursor-pointer"
          aria-label="لفوق"
        >
          <ArrowUp className="w-5 h-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
