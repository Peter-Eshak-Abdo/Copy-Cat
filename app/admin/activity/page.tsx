"use client";

import React, { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { History, Loader2, Lock, RefreshCw, Undo2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/toast-provider";
import { api, ApiError } from "@/lib/admin-data";
import AuditDiff, { hasDiff } from "./audit-diff";

/**
 * Change log for the engineer: every change made from the admin pages in the last 30 days, who made it,
 * and what it was before (a "قبل / بعد" table under each entry, audit-diff.tsx). Product and settings
 * changes can be undone with one click.
 */
interface Entry {
  id: string;
  created_at: string;
  actor: string;
  role: string;
  action: string;
  entity: string;
  entity_id: string | null;
  before: unknown;
  after: unknown;
}

const ENTITY_LABEL: Record<string, string> = {
  inventory: "منتج",
  instapay: "إنستا باي",
  session: "تسجيل دخول",
  "settings:calculator.paper": "أسعار الورق",
  "settings:calculator.addons": "أسعار التجليد",
  "settings:shortcuts.list": "المواقع",
  "settings:storefront.banner": "إعلان صفحة الزباين",
  "settings:dashboard.tools-order": "ترتيب الأدوات",
};

const ACTION_LABEL: Record<string, { text: string; tone: string }> = {
  create: { text: "ضاف", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  update: { text: "عدّل", tone: "bg-blue-50 text-blue-700 border-blue-200" },
  delete: { text: "مسح", tone: "bg-rose-50 text-rose-700 border-rose-200" },
  confirm: { text: "أكّد", tone: "bg-violet-50 text-violet-700 border-violet-200" },
  revert: { text: "رجّع", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  login: { text: "دخل", tone: "bg-slate-50 text-slate-600 border-slate-200" },
};

const FILTERS: { id: string; label: string }[] = [
  { id: "", label: "الكل" },
  { id: "inventory", label: "المنتجات" },
  { id: "settings", label: "الأسعار والإعدادات" },
  { id: "instapay", label: "إنستا باي" },
  { id: "session", label: "الدخول" },
];

function describe(e: Entry): string {
  const name = (v: unknown) => (v && typeof v === "object" && "name" in v ? String((v as { name: unknown }).name) : "");
  if (e.entity === "inventory") {
    const b = e.before as Record<string, unknown> | null;
    const a = e.after as Record<string, unknown> | null;
    const label = name(a) || name(b) || `#${e.entity_id}`;
    if (e.action === "update" && a && b) {
      const changed = ["name", "price", "category", "wholesale_price", "notes", "image"]
        .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
        .map((k) =>
          k === "price"
            ? `السعر ${b.price} ← ${a.price}`
            : k === "image"
            ? "الصورة"
            : k === "name"
            ? "الاسم"
            : k === "category"
            ? "القسم"
            : k === "notes"
            ? "الملاحظات"
            : "سعر الجملة"
        );
      return `${label}${changed.length ? `: ${changed.join("، ")}` : ""}`;
    }
    return label;
  }
  if (e.entity === "instapay") {
    const r = (e.after || e.before) as Record<string, unknown> | null;
    return r ? `${r.customer_name} · ${r.amount} ج.م` : "";
  }
  return "";
}

export default function ActivityPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [reverting, setReverting] = useState<string | null>(null);

  const load = useCallback(
    async (append = false, beforeId?: string) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        if (filter) qs.set("entity", filter);
        if (beforeId) qs.set("before", beforeId);
        const data = await api<{ entries: Entry[]; next: string | null }>(`/api/admin/audit?${qs}`);
        setEntries((prev) => (append ? [...prev, ...data.entries] : data.entries));
        setNext(data.next);
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError && err.status === 503
            ? "قاعدة البيانات مش متوصلة، فمفيش سجل تعديلات."
            : err instanceof Error
            ? err.message
            : "حصلت مشكلة"
        );
      } finally {
        setLoading(false);
      }
    },
    [filter]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- (re)load when the filter changes
    if (isAdmin) load();
  }, [isAdmin, load]);

  const revert = async (e: Entry) => {
    if (!confirm("ترجّع التعديل ده للقيمة اللي كانت قبله؟")) return;
    setReverting(e.id);
    try {
      await api("/api/admin/audit", { method: "POST", body: JSON.stringify({ id: e.id }) });
      toast.success("رجع زي ما كان");
      load();
    } catch (err) {
      toast.error("مرجعش", err instanceof Error ? err.message : "");
    } finally {
      setReverting(null);
    }
  };

  if (!authLoading && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <Lock className="w-10 h-10 text-slate-300" />
        <p className="text-lg font-black text-slate-700">الصفحة دي للباشمهندس بس</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <History className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-lg font-black text-slate-900">سجل التعديلات</h1>
            <p className="text-xs text-slate-500 font-medium">كل اللي اتغير في آخر 30 يوم، ومين غيّره. القديم بيتمسح لوحده.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                filter === f.id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => load()}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            title="حدّث"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 font-bold text-sm text-center">{error}</div>
      ) : entries.length === 0 && !loading ? (
        <div className="p-10 rounded-2xl bg-white border border-dashed border-slate-200 text-slate-400 font-bold text-center">مفيش تعديلات</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100">
          {entries.map((e, i) => {
            const act = ACTION_LABEL[e.action] || { text: e.action, tone: "bg-slate-50 text-slate-600 border-slate-200" };
            const canRevert =
              (e.entity === "inventory" || e.entity.startsWith("settings:")) && e.action !== "revert" && e.action !== "login";
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 15) * 0.02 }}
                className="p-3.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <span className="text-xs text-slate-500 font-bold w-36 shrink-0 tabular-nums" dir="ltr">
                    {new Date(e.created_at).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full border w-fit ${act.tone}`}>{act.text}</span>
                  <span className="text-sm font-bold text-slate-800 w-40 shrink-0">{ENTITY_LABEL[e.entity] || e.entity}</span>
                  <span className="flex-1 text-sm text-slate-600 truncate" dir="auto">{describe(e)}</span>
                  <span className="text-xs text-slate-500 font-medium shrink-0" dir="ltr">
                    {e.actor} {e.role === "admin" ? "(admin)" : ""}
                  </span>
                  {canRevert && (
                    <button
                      type="button"
                      disabled={reverting === e.id}
                      onClick={() => revert(e)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {reverting === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                      رجّعه
                    </button>
                  )}
                </div>
                {hasDiff(e) && (
                  <div className="mt-2.5 sm:mr-40 rounded-xl bg-slate-50 border border-slate-100 p-3 overflow-x-auto">
                    <AuditDiff entry={e} />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {next && !error && (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => load(true, next)}
            className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-800 border border-slate-200 cursor-pointer"
          >
            {loading ? "بنحمّل..." : "اعرض أقدم"}
          </button>
        </div>
      )}
    </div>
  );
}
