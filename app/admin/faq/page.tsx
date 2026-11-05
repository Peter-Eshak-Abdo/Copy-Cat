"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, Eye, HelpCircle, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { syncLabel, useSyncedSetting } from "@/lib/admin-data";
import { DEFAULT_FAQ, FAQ_KEY, FAQ_TOPICS, isFaqList, type FaqItem } from "@/lib/faq";

/**
 * "أسئلة الزباين": the FAQ on the customer page. Edited here, saved to the shared settings, and shown on
 * the storefront within about a minute (the public endpoint is cached briefly at the edge).
 */
export default function FaqAdminPage() {
  const { toast } = useToast();
  const [saved, save, sync] = useSyncedSetting<FaqItem[]>(FAQ_KEY, "copycat_storefront_faq_v1", DEFAULT_FAQ, isFaqList);
  const [items, setItems] = useState<FaqItem[]>(saved);
  const [filter, setFilter] = useState<string>("الكل");
  const [saving, setSaving] = useState(false);

  // Show the server copy once it arrives (unless something was already edited here)
  const dirty = useMemo(() => JSON.stringify(items) !== JSON.stringify(saved), [items, saved]);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- follow the synced value until the first edit
    if (!touched) setItems(saved);
  }, [saved, touched]);

  const topics = useMemo(() => {
    const set = new Set<string>(FAQ_TOPICS);
    for (const it of items) if (it.topic.trim()) set.add(it.topic.trim());
    return [...set];
  }, [items]);

  const edit = (next: FaqItem[]) => {
    setTouched(true);
    setItems(next);
  };
  const set = (i: number, patch: Partial<FaqItem>) => edit(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    edit(next);
  };

  const onSave = async () => {
    const clean = items
      .map((it) => ({ q: it.q.trim(), a: it.a.trim(), topic: it.topic.trim() || FAQ_TOPICS[0] }))
      .filter((it) => it.q && it.a);
    if (!isFaqList(clean)) {
      toast.error("مقدرناش نحفظ", "في سؤال أو إجابة طويلين أوي.");
      return;
    }
    setSaving(true);
    const ok = await save(clean);
    setSaving(false);
    setItems(clean);
    setTouched(false);
    if (!ok) toast.error("متحفظش على السيرفر", "جرب تاني بعد شوية.");
    else if (sync === "local") toast.info("اتحفظ على الجهاز ده بس", "قاعدة البيانات مش متوصلة، فالزباين مش هيشوفوا التعديل.");
    else toast.success("اتحفظ", "الأسئلة هتظهر للزباين في الموقع خلال دقيقة.");
  };

  const label = syncLabel(sync);
  const shown = items.map((it, i) => ({ it, i })).filter(({ it }) => filter === "الكل" || it.topic === filter);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center gap-3">
        <HelpCircle className="w-6 h-6 text-violet-600" />
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-base font-black text-slate-900">أسئلة الزباين في الموقع</h1>
          <p className="text-xs text-slate-500">
            {items.length} سؤال •{" "}
            <span className={label.tone === "ok" ? "text-emerald-600" : label.tone === "warn" ? "text-amber-600" : ""}>{label.text}</span>
          </p>
        </div>
        <a
          href="/#faq"
          target="_blank"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
        >
          <Eye className="w-4 h-4" /> شوفها في الموقع
        </a>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("نرجّع الأسئلة الأصلية؟ التعديلات اللي متحفظتش هتروح.")) edit(DEFAULT_FAQ);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" /> الأسئلة الأصلية
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-black disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-4 h-4" /> {saving ? "بنحفظ..." : dirty ? "احفظ" : "محفوظ"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {["الكل", ...topics].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
              filter === t ? "bg-violet-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-violet-300"
            }`}
          >
            {t} ({t === "الكل" ? items.length : items.filter((x) => x.topic === t).length})
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        <AnimatePresence initial={false}>
          {shown.map(({ it, i }) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs space-y-2"
            >
              <div className="flex gap-2">
                <input
                  value={it.q}
                  onChange={(e) => set(i, { q: e.target.value })}
                  placeholder="السؤال"
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-violet-500"
                />
                <select
                  value={it.topic}
                  onChange={(e) => set(i, { topic: e.target.value })}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-700"
                >
                  {topics.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <textarea
                value={it.a}
                onChange={(e) => set(i, { a: e.target.value })}
                placeholder="الإجابة"
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 focus:bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-violet-500"
              />
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer" title="طلّعه فوق">
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer" title="نزّله تحت">
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => edit(items.filter((_, k) => k !== i))}
                  className="mr-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> امسح
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={() => edit([...items, { q: "", a: "", topic: filter === "الكل" ? FAQ_TOPICS[0] : filter }])}
        className="w-full py-3 rounded-2xl border-2 border-dashed border-violet-300 text-violet-700 text-sm font-black hover:bg-violet-50 flex items-center justify-center gap-2 cursor-pointer"
      >
        <Plus className="w-4 h-4" /> سؤال جديد
      </button>
    </div>
  );
}
