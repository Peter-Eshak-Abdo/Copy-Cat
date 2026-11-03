"use client";

import React from "react";
import { ADMIN_TOOLS } from "@/lib/admin-tools";

/**
 * "قبل / بعد" for one change-log entry: only the fields that changed, old value next to new value.
 * Products and InstaPay records are compared field by field; settings lists (calculator prices, addons,
 * shortcuts) item by item using each item's `id`; the banner as text; the tools order as two lists.
 */

type Rec = Record<string, unknown>;

const FIELD_LABEL: Record<string, string> = {
  name: "الاسم",
  label: "الاسم",
  title: "الاسم",
  category: "القسم",
  price: "السعر",
  cost_price: "سعر الشرا",
  wholesale_price: "سعر الجملة",
  wholesale_min_qty: "أقل كمية للجملة",
  stock_count: "الكمية",
  notes: "ملاحظات",
  image: "الصورة",
  images: "الصور",
  url: "الرابط",
  description: "الوصف",
  isPopular: "مثبّت",
  mode: "النوع",
  colorDot: "اللون",
  customer_name: "اسم العميل",
  phone: "الموبايل",
  amount: "المبلغ",
  sender_account: "حساب المحوّل",
  status: "الحالة",
  confirmed_by: "أكّده",
};

/** Fields shown, in this order; anything else (ids, timestamps, internal links) is left out */
const FIELD_ORDER = Object.keys(FIELD_LABEL);
const MONEY = new Set(["price", "cost_price", "wholesale_price", "amount"]);
const VALUE_LABEL: Record<string, string> = {
  pending: "مستني التأكيد",
  confirmed: "اتأكد",
  single: "وش بس",
  duplex: "وش وضهر",
  wire: "سلك",
  plastic: "بلاستيك",
  finishing: "تغليف",
};

const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const empty = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
const isImage = (v: unknown) => typeof v === "string" && /^(data:image\/|https?:\/\/|\/)/.test(v) && !/\s/.test(v);

function Value({ field, v }: { field: string; v: unknown }) {
  if (empty(v)) return <span className="text-slate-300">—</span>;
  if ((field === "image" || field === "images") && (isImage(v) || Array.isArray(v))) {
    const list = (Array.isArray(v) ? v : [v]).filter(isImage) as string[];
    return (
      <span className="flex flex-wrap gap-1">
        {list.slice(0, 6).map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- product photos are data: URLs or local paths
          <img key={i} src={src} alt="" className="w-10 h-10 rounded-md object-cover border border-slate-200 bg-slate-50" />
        ))}
        {list.length > 6 && <span className="text-xs text-slate-400 self-center">+{list.length - 6}</span>}
      </span>
    );
  }
  if (typeof v === "boolean") return <>{v ? "آه" : "لأ"}</>;
  if (typeof v === "number") return <span className="tabular-nums">{MONEY.has(field) ? `${v} ج.م` : v}</span>;
  if (typeof v === "string") {
    const text = VALUE_LABEL[v] ?? v;
    if (field === "colorDot")
      return (
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded-full border border-slate-300" style={{ background: v }} />
        </span>
      );
    return (
      <span className="break-words whitespace-pre-wrap" dir="auto">
        {text.length > 300 ? text.slice(0, 300) + "…" : text}
      </span>
    );
  }
  return <span className="text-xs text-slate-500 break-all" dir="ltr">{JSON.stringify(v).slice(0, 200)}</span>;
}

interface Row {
  key: string;
  label: string;
  field: string;
  before: unknown;
  after: unknown;
}

function fieldRows(before: Rec | null, after: Rec | null, prefix = ""): Row[] {
  const rows: Row[] = [];
  for (const f of FIELD_ORDER) {
    const b = before?.[f];
    const a = after?.[f];
    if (empty(b) && empty(a)) continue;
    // A new or deleted record: show all its fields; an edit: only what changed
    if (before && after && same(a, b)) continue;
    // `image` is the first of `images`: when the record has a photo list, show the photos once
    if (f === "image" && (!empty(before?.images) || !empty(after?.images))) continue;
    rows.push({ key: prefix + f, label: FIELD_LABEL[f], field: f, before: before ? b : undefined, after: after ? a : undefined });
  }
  return rows;
}

function DiffTable({ rows, showBefore, showAfter }: { rows: Row[]; showBefore: boolean; showAfter: boolean }) {
  if (!rows.length) return <p className="text-xs text-slate-400 font-bold">مفيش فرق.</p>;
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="text-xs text-slate-500">
          <th className="text-right font-bold py-1 pl-3 w-32"></th>
          {showBefore && <th className="text-right font-bold py-1 pl-3">قبل</th>}
          {showAfter && <th className="text-right font-bold py-1">بعد</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-t border-slate-100 align-top">
            <td className="py-1.5 pl-3 text-xs font-bold text-slate-500 whitespace-nowrap">{r.label}</td>
            {showBefore && (
              <td className="py-1.5 pl-3 text-rose-700">
                <span className={showAfter ? "bg-rose-50 rounded px-1.5 py-0.5 inline-block" : ""}>
                  <Value field={r.field} v={r.before} />
                </span>
              </td>
            )}
            {showAfter && (
              <td className="py-1.5 text-emerald-700">
                <span className={showBefore ? "bg-emerald-50 rounded px-1.5 py-0.5 inline-block" : ""}>
                  <Value field={r.field} v={r.after} />
                </span>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Tool ids (the dashboard order) shown by their names */
const TOOL_TITLE = new Map(ADMIN_TOOLS.map((t) => [t.id, t.title]));
const itemName = (x: unknown) =>
  isRec(x) ? String(x.label || x.name || x.title || x.id || "") : TOOL_TITLE.get(String(x)) ?? String(x ?? "");

/** Lists of settings items (each with an `id`): added, removed, and changed items */
function ListDiff({ before, after }: { before: unknown[]; after: unknown[] }) {
  const keyOf = (x: unknown, i: number) => (isRec(x) && x.id ? String(x.id) : `#${i}`);
  const b = new Map(before.map((x, i) => [keyOf(x, i), x]));
  const a = new Map(after.map((x, i) => [keyOf(x, i), x]));
  const added = [...a.keys()].filter((k) => !b.has(k));
  const removed = [...b.keys()].filter((k) => !a.has(k));
  const changed = [...a.keys()].filter((k) => b.has(k) && !same(a.get(k), b.get(k)));
  const reordered =
    !added.length && !removed.length && !changed.length && !same([...b.keys()], [...a.keys()]);

  if (!added.length && !removed.length && !changed.length && !reordered)
    return <p className="text-xs text-slate-400 font-bold">مفيش فرق.</p>;

  return (
    <div className="space-y-3">
      {changed.map((k) => {
        const bi = b.get(k);
        const ai = a.get(k);
        return (
          <div key={k}>
            <p className="text-xs font-black text-slate-700 mb-1" dir="auto">
              اتعدّل: {itemName(ai) || itemName(bi)}
            </p>
            {isRec(bi) && isRec(ai) ? (
              <DiffTable rows={fieldRows(bi, ai, k)} showBefore showAfter />
            ) : (
              <DiffTable
                rows={[{ key: k, label: "القيمة", field: "", before: bi, after: ai }]}
                showBefore
                showAfter
              />
            )}
          </div>
        );
      })}
      {added.length > 0 && (
        <div>
          <p className="text-xs font-black text-emerald-700 mb-1">اتضاف ({added.length})</p>
          <ul className="space-y-0.5">
            {added.map((k) => (
              <li key={k} className="text-sm text-emerald-800 bg-emerald-50 rounded px-2 py-1" dir="auto">
                {summaryOf(a.get(k))}
              </li>
            ))}
          </ul>
        </div>
      )}
      {removed.length > 0 && (
        <div>
          <p className="text-xs font-black text-rose-700 mb-1">اتشال ({removed.length})</p>
          <ul className="space-y-0.5">
            {removed.map((k) => (
              <li key={k} className="text-sm text-rose-800 bg-rose-50 rounded px-2 py-1 line-through decoration-rose-300" dir="auto">
                {summaryOf(b.get(k))}
              </li>
            ))}
          </ul>
        </div>
      )}
      {reordered && <OrderDiff before={before} after={after} />}
    </div>
  );
}

/** One line for a whole settings item: its name plus price / link */
function summaryOf(x: unknown): string {
  if (!isRec(x)) return String(x ?? "");
  const parts = [itemName(x)];
  if (typeof x.price === "number") parts.push(`${x.price} ج.م`);
  if (typeof x.mode === "string") parts.push(VALUE_LABEL[x.mode] ?? x.mode);
  if (typeof x.url === "string") parts.push(x.url);
  return parts.filter(Boolean).join(" · ");
}

function OrderDiff({ before, after }: { before: unknown[]; after: unknown[] }) {
  // Tools whose place changed are bold
  const col = (title: string, list: unknown[], other: unknown[], tone: string) => (
    <div className="flex-1 min-w-0">
      <p className={`text-xs font-black mb-1 ${tone}`}>{title}</p>
      <ol className="text-sm text-slate-700 list-decimal ps-5 space-y-0.5">
        {list.map((x, i) => (
          <li key={i} className={same(x, other[i]) ? "" : "font-bold"}>
            <span dir="auto">{itemName(x)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
  return (
    <div className="flex gap-4">
      {col("الترتيب قبل", before, after, "text-rose-700")}
      {col("الترتيب بعد", after, before, "text-emerald-700")}
    </div>
  );
}

export interface DiffEntry {
  action: string;
  entity: string;
  before: unknown;
  after: unknown;
}

/** Whether an entry has anything to show under it */
export function hasDiff(e: DiffEntry): boolean {
  return e.entity !== "session" && !(empty(e.before) && empty(e.after));
}

export default function AuditDiff({ entry }: { entry: DiffEntry }) {
  const { before, after, entity } = entry;

  if (entity === "inventory" || entity === "instapay" || (isRec(before) || isRec(after))) {
    const b = isRec(before) ? before : null;
    const a = isRec(after) ? after : null;
    // InstaPay "confirm" only stores the record after: its status went from pending to confirmed
    if (entity === "instapay" && entry.action === "confirm" && a && !b) {
      return (
        <DiffTable
          rows={[
            { key: "status", label: FIELD_LABEL.status, field: "status", before: "pending", after: a.status ?? "confirmed" },
            ...(a.confirmed_by ? [{ key: "cb", label: FIELD_LABEL.confirmed_by, field: "confirmed_by", before: undefined, after: a.confirmed_by }] : []),
          ]}
          showBefore
          showAfter
        />
      );
    }
    return <DiffTable rows={fieldRows(b, a)} showBefore={!!b} showAfter={!!a} />;
  }

  if (Array.isArray(before) || Array.isArray(after)) {
    const b = Array.isArray(before) ? before : [];
    const a = Array.isArray(after) ? after : [];
    // Plain lists (the dashboard tools order): two numbered lists side by side
    if ([...a, ...b].every((x) => !isRec(x))) {
      return same(a, b) ? <p className="text-xs text-slate-400 font-bold">مفيش فرق.</p> : <OrderDiff before={b} after={a} />;
    }
    return <ListDiff before={b} after={a} />;
  }

  // Text values (the storefront banner)
  return (
    <DiffTable
      rows={[{ key: "v", label: "النص", field: "", before, after }]}
      showBefore={before !== undefined}
      showAfter={after !== undefined}
    />
  );
}
