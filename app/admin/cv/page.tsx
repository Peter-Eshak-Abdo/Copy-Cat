"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { saveAs } from "file-saver";
import {
  ArrowLeftRight,
  FileDown,
  Camera,
  Download,
  FileText,
  ImagePlus,
  Languages,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { prepareOcrImage } from "@/lib/ocr-client";
import { emptyCv, isEmptyCv, normalizeCv, type CvData, type CvLang, type CvPair, type CvTemplate } from "@/lib/cv";
import { cvDocxBlob, cvFileName, type CvPhoto } from "@/lib/docx/cv-docx";
import { CvSheet, ScaledSheet, printSheet } from "./cv-sheet";

/**
 * "عمل CV": the customer's details (typed, or photos of a handwritten paper / an old CV) become the shop's
 * usual CV layout in Arabic, English or both (lib/docx/cv-docx.ts). Photos can also be the customer's certificates:
 * the AI recognises them and adds the course (and its grade when printed). The second language is written by
 * meaning; after editing one language, "ترجم" rewrites the other from it. The draft survives a reload.
 */

const DRAFT_KEY = "copycat_cv_draft_v1";
const TEMPLATE_KEY = "copycat_cv_template_v1";
const TEMPLATE_NAME: Record<CvTemplate, { label: string; hint: string }> = {
  classic: { label: "العادي (ملوّن)", hint: "شكل المكتبة: الشريط الكحلي جنب" },
  ats: { label: "ATS (أسود بسيط)", hint: "للشركات اللي بتقرا الـ CV بالكمبيوتر: عمود واحد وكله أسود، من غير صورة" },
};
const LANG_NAME: Record<CvLang, string> = { ar: "عربي", en: "English" };
/** Which languages this CV is made in */
type Langs = CvLang | "both";
const LANGS_CHOICE: [Langs, string][] = [
  ["both", "عربي + إنجليزي"],
  ["ar", "عربي بس"],
  ["en", "إنجليزي بس"],
];
const MAX_IMAGES = 10;

interface Draft {
  ar: CvData;
  en: CvData;
  photo: CvPhoto | null;
  langs: Langs;
}

const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

const imageAspect = (src: string) =>
  new Promise<number>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth / Math.max(1, img.naturalHeight));
    img.onerror = () => resolve(0.8);
    img.src = src;
  });

const lines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);

export default function CvPage() {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<CvLang>("ar");
  const [langsChoice, setLangsChoice] = useState<Langs>("both");
  const [stage, setStage] = useState<string | null>(null);
  const [translating, setTranslating] = useState<CvLang | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  // Bumped when the AI replaces the text, so the editor boxes show the new values
  const [version, setVersion] = useState(0);
  const [template, setTemplate] = useState<CvTemplate>("classic");
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- per-device preference, client only
      if (localStorage.getItem(TEMPLATE_KEY) === "ats") setTemplate("ats");
    } catch {}
  }, []);
  const chooseTemplate = (t: CvTemplate) => {
    setTemplate(t);
    try {
      localStorage.setItem(TEMPLATE_KEY, t);
    } catch {}
  };
  const imageInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  // Restore an unfinished CV after a reload
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (saved?.ar && saved?.en) {
        const langs: Langs = saved.langs === "ar" || saved.langs === "en" ? saved.langs : "both";
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restore once after hydration (localStorage is client-only)
        setDraft({ ar: normalizeCv(saved.ar, "ar"), en: normalizeCv(saved.en, "en"), photo: saved.photo ?? null, langs });
        setLangsChoice(langs);
        if (langs === "en") setTab("en");
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      else localStorage.removeItem(DRAFT_KEY);
    } catch {
      // A big photo can overflow the storage quota: keep the text at least
      try {
        if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, photo: null }));
      } catch {}
    }
  }, [draft]);

  const addImages = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    const ready = await Promise.all(imgs.map(async (f) => prepareOcrImage(await readFile(f), 1800)));
    setImages((prev) => [...prev, ...ready].slice(0, MAX_IMAGES));
    toast.success("الصور وصلت", `${ready.length} صورة جاهزة للقراية.`);
  };

  const setPhoto = async (file: File) => {
    const src = await prepareOcrImage(await readFile(file), 700);
    const aspect = await imageAspect(src);
    setDraft((d) => ({ ...(d ?? { ar: emptyCv("ar"), en: emptyCv("en"), langs: langsChoice }), photo: { dataUrl: src, aspect } }));
  };

  const build = async () => {
    if (!text.trim() && images.length === 0) {
      toast.error("مفيش بيانات", "اكتب بيانات الزبون أو ارفع صورة الورقة.");
      return;
    }
    if (draft && !(isEmptyCv(draft.ar) && isEmptyCv(draft.en)) && !window.confirm("في CV مفتوح. نعمل واحد جديد مكانه؟")) return;
    const langs = langsChoice;
    setStage(images.length ? "بنقرا الصور والشهادات ونرتب البيانات" : "بنرتب البيانات");
    const slow = window.setTimeout(
      () => setStage(langs === "both" ? "بنكتب العربي والإنجليزي بالمعنى" : `بنكتب الـ CV ${LANG_NAME[langs]}`),
      6000
    );
    try {
      const res = await fetch("/api/ai/cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "build", text, images, langs }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.error("الـ CV مطلعش", data.error || "جرب تاني.");
        return;
      }
      setDraft((d) => ({ ar: normalizeCv(data.ar, "ar"), en: normalizeCv(data.en, "en"), photo: d?.photo ?? null, langs }));
      setTab(langs === "en" ? "en" : "ar");
      setVersion((v) => v + 1);
      const certs: { course: string; grade: string }[] = Array.isArray(data.certificates) ? data.certificates : [];
      toast.success(
        "الـ CV جاهز",
        certs.length
          ? `لقينا ${certs.length} شهادة واتحطت في الكورسات: ${certs.map((c) => (c.grade ? `${c.course} (${c.grade})` : c.course)).join("، ")}. راجعها في الخانات.`
          : "راجع البيانات في الخانات، والشكل بيتحدث قدامك على طول."
      );
    } catch {
      toast.error("حصلت مشكلة", "اتأكد من النت وجرب تاني.");
    } finally {
      window.clearTimeout(slow);
      setStage(null);
    }
  };

  /** Rewrite the other language from the one on screen (after editing it) */
  const translateFrom = async (from: CvLang) => {
    if (!draft) return;
    const to: CvLang = from === "ar" ? "en" : "ar";
    setTranslating(to);
    try {
      const res = await fetch("/api/ai/cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "translate", from, cv: draft[from] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.error("الترجمة مطلعتش", data.error || "جرب تاني.");
        return;
      }
      // Keep the section names already chosen for that language
      // Keep the section names already chosen for that language; a one-language CV now has both
      setDraft((d) => (d ? { ...d, [to]: { ...normalizeCv(data.cv, to), headings: d[to].headings }, langs: "both" } : d));
      setTab(to);
      setVersion((v) => v + 1);
      toast.success("اتترجم", `النسخة ${LANG_NAME[to]} اتكتبت من ${LANG_NAME[from]}.`);
    } catch {
      toast.error("حصلت مشكلة", "جرب تاني.");
    } finally {
      setTranslating(null);
    }
  };

  const download = async (lang: CvLang) => {
    if (!draft) return;
    const blob = await cvDocxBlob(draft[lang], lang, draft.photo ?? undefined, template);
    saveAs(blob, cvFileName(draft[lang], lang));
  };

  const startBlank = () => {
    setDraft({ ar: emptyCv("ar"), en: emptyCv("en"), photo: null, langs: langsChoice });
    setVersion((v) => v + 1);
    setTab(langsChoice === "en" ? "en" : "ar");
  };

  const clearAll = () => {
    if (!window.confirm("نمسح الـ CV ده ونبدأ من الأول؟")) return;
    setDraft(null);
    setText("");
    setImages([]);
  };

  const cv = draft?.[tab];
  const shownLangs: CvLang[] = !draft || draft.langs === "both" ? ["ar", "en"] : [draft.langs];
  const other: CvLang = tab === "ar" ? "en" : "ar";
  const update = (patch: Partial<CvData>) => setDraft((d) => (d ? { ...d, [tab]: { ...d[tab], ...patch } } : d));

  return (
    <div className="space-y-5" dir="rtl">
      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addImages([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setPhoto(f);
          e.target.value = "";
        }}
      />

      {/* 1. The customer's details */}
      <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-700" /> بيانات الزبون
          </h2>
          <span className="text-xs text-slate-500 font-medium">اكتبها بأي شكل، أو صوّر الورقة (حتى بخط الإيد) أو الـ CV القديم أو الشهادات</span>
        </div>
        <div className="grid lg:grid-cols-[1fr_280px] gap-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={"مثال:\nالاسم: ...\nمواليد ... الجنسية ... العنوان ...\nالمؤهل: بكالوريوس ... جامعة ... سنة ... تقدير ...\nالخبرات: ...\nالكورسات: ...\nاللغات: ..."}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white p-3 text-sm leading-relaxed text-slate-900 focus:outline-none focus:border-sky-500"
          />
          <div
            onClick={() => imageInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              addImages([...e.dataTransfer.files]);
            }}
            className={`rounded-xl border-2 border-dashed p-3 cursor-pointer transition-colors flex flex-col ${
              isDragOver ? "border-sky-500 bg-sky-50" : "border-slate-300 hover:border-sky-400 bg-slate-50"
            }`}
          >
            {images.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-1.5 py-4">
                <ImagePlus className="w-8 h-8 text-sky-600" />
                <span className="text-sm font-bold text-slate-800">صور الورقة أو الشهادات</span>
                <span className="text-[11px] text-slate-500">اسحبها هنا أو دوس. لحد {MAX_IMAGES} صور</span>
                <span className="text-[11px] text-sky-700 font-semibold">صورة الشهادة بتتقري لوحدها: اسم الكورس والتقدير لو مكتوب</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {images.map((src, i) => (
                  <div key={i} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-slate-200 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImages((prev) => prev.filter((_, k) => k !== i));
                      }}
                      className="absolute top-1 left-1 w-5 h-5 rounded-full bg-slate-800/80 text-white flex items-center justify-center"
                      title="شيل الصورة"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {images.length < MAX_IMAGES && (
                  <div className="aspect-[3/4] rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                    <Plus className="w-5 h-5" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="لغة الـ CV">
            {LANGS_CHOICE.map(([l, label]) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={langsChoice === l}
                onClick={() => setLangsChoice(l)}
                className={`px-3 py-1.5 rounded-lg text-sm font-black cursor-pointer transition ${
                  langsChoice === l ? "bg-white text-sky-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={build}
            disabled={!!stage}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-sm font-black shadow-sm disabled:opacity-60 cursor-pointer"
          >
            {stage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {stage ? `${stage}...` : `اعمل الـ CV (${LANGS_CHOICE.find(([l]) => l === langsChoice)?.[1]})`}
          </button>
          {!draft && (
            <button
              type="button"
              onClick={startBlank}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold cursor-pointer"
            >
              أكتبه بإيدي من غير AI
            </button>
          )}
          {draft && (
            <button
              type="button"
              onClick={clearAll}
              className="mr-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> CV جديد
            </button>
          )}
        </div>
      </section>

      {/* 2. Edit + preview */}
      <AnimatePresence>
        {draft && cv && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 items-start">
            <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-xl bg-slate-100 p-1">
                  {shownLangs.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setTab(l)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-black cursor-pointer transition ${
                        tab === l ? "bg-white text-sky-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {LANG_NAME[l]}
                      {translating === l && <Loader2 className="inline w-3.5 h-3.5 animate-spin mr-1.5" />}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => translateFrom(tab)}
                  disabled={!!translating || isEmptyCv(cv)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold disabled:opacity-50 cursor-pointer"
                  title={draft.langs === "both" ? "بعد ما تعدّل في النسخة دي، اعمل النسخة التانية منها من جديد" : "يعمل نسخة باللغة التانية من النسخة دي"}
                >
                  {translating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}
                  {draft.langs !== "both"
                    ? `اعمل نسخة ${LANG_NAME[other]} كمان`
                    : tab === "ar"
                      ? "ترجم العربي ده للإنجليزي"
                      : "ترجم الإنجليزي ده للعربي"}
                </button>
                <button
                  type="button"
                  onClick={() => photoInput.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" /> {draft.photo ? "غيّر الصورة الشخصية" : "صورة شخصية (اختياري)"}
                </button>
                {draft.photo && (
                  <button
                    type="button"
                    onClick={() => setDraft((d) => (d ? { ...d, photo: null } : d))}
                    className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    شيل الصورة
                  </button>
                )}
              </div>

              <CvEditor key={`${tab}-${version}`} cv={cv} lang={tab} onChange={update} />
            </section>

            <section className="xl:sticky xl:top-4 space-y-3">
              <div className="flex rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="شكل الـ CV">
                {(["classic", "ats"] as CvTemplate[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={template === t}
                    onClick={() => chooseTemplate(t)}
                    title={TEMPLATE_NAME[t].hint}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-black cursor-pointer transition ${
                      template === t ? "bg-white text-sky-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {TEMPLATE_NAME[t].label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => download(tab)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black shadow-sm cursor-pointer"
                >
                  <Download className="w-4 h-4" /> نزّل Word {LANG_NAME[tab]}
                </button>
                {draft.langs === "both" && (
                <button
                  type="button"
                  onClick={async () => {
                    await download("ar");
                    await new Promise((r) => setTimeout(r, 300));
                    await download("en");
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold cursor-pointer"
                >
                  <ArrowLeftRight className="w-4 h-4" /> نزّل الاتنين
                </button>
                )}
                <button
                  type="button"
                  onClick={() => sheetRef.current && printSheet(sheetRef.current, cvFileName(cv, tab, "pdf").replace(/\.pdf$/, ""))}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-rose-300 text-rose-700 text-sm font-bold cursor-pointer"
                  title="بيفتح شاشة الطباعة: اختار «Save as PDF» / «حفظ كـ PDF»"
                >
                  <FileDown className="w-4 h-4" /> PDF احتياطي
                </button>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-100 p-3">
                <ScaledSheet>
                  <CvSheet ref={sheetRef} cv={cv} lang={tab} template={template} photo={draft.photo} />
                </ScaledSheet>
                <p className="text-center text-[11px] text-slate-500 mt-2">
                  ده شكل الصفحة بالظبط، ولو البيانات كتير الخط والمسافات بيصغروا لوحدهم عشان يفضل صفحة واحدة.
                  {template === "ats" && draft.photo ? " (الـ ATS من غير صورة.)" : ""}
                </p>
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-slate-50 focus:bg-white px-2.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-sky-500";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-black text-slate-700">
        {label} {hint && <span className="font-medium text-slate-400">({hint})</span>}
      </span>
      {children}
    </label>
  );
}

/** A list edited as one textarea, one item per line (the text is kept as typed until the box loses focus) */
function LinesBox({ value, onChange, rows = 4, dir }: { value: string[]; onChange: (v: string[]) => void; rows?: number; dir: string }) {
  const [text, setText] = useState(value.join("\n"));
  return (
    <textarea
      dir={dir}
      rows={Math.max(rows, value.length + 1)}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(lines(e.target.value));
      }}
      className={inputCls}
    />
  );
}

function PairsBox({ value, onChange, dir, labelHint }: { value: CvPair[]; onChange: (v: CvPair[]) => void; dir: string; labelHint: string }) {
  const set = (i: number, patch: Partial<CvPair>) => onChange(value.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  return (
    <div className="space-y-1.5" dir={dir}>
      {value.map((p, i) => (
        <div key={i} className="flex gap-1.5">
          <input value={p.label} onChange={(e) => set(i, { label: e.target.value })} placeholder={labelHint} className={`${inputCls} w-2/5`} />
          <input value={p.value} onChange={(e) => set(i, { value: e.target.value })} className={inputCls} />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, k) => k !== i))}
            className="shrink-0 w-9 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer"
            title="امسح"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, { label: "", value: "" }])}
        className="text-xs font-bold text-sky-700 hover:underline cursor-pointer flex items-center gap-1"
      >
        <Plus className="w-3.5 h-3.5" /> سطر
      </button>
    </div>
  );
}

function CvEditor({ cv, lang, onChange }: { cv: CvData; lang: CvLang; onChange: (patch: Partial<CvData>) => void }) {
  const dir = lang === "ar" ? "rtl" : "ltr";
  const h = cv.headings;
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="الاسم">
          <input dir={dir} value={cv.name} onChange={(e) => onChange({ name: e.target.value })} className={inputCls} />
        </Field>
        <Field label="المسمى الوظيفي" hint="اختياري، تحت الاسم">
          <input dir={dir} value={cv.jobTitle} onChange={(e) => onChange({ jobTitle: e.target.value })} className={inputCls} />
        </Field>
      </div>

      <Field label={h.personal}>
        <PairsBox value={cv.personal} onChange={(personal) => onChange({ personal })} dir={dir} labelHint={lang === "ar" ? "مثلاً: التليفون" : "e.g. Phone"} />
      </Field>

      <Field label={h.objective}>
        <textarea dir={dir} rows={3} value={cv.objective} onChange={(e) => onChange({ objective: e.target.value })} className={inputCls} />
      </Field>

      <Field label={h.education}>
        <div className="space-y-2" dir={dir}>
          {cv.education.map((e, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-2.5 space-y-1.5 bg-slate-50/50">
              <div className="flex gap-1.5">
                <input
                  value={e.title}
                  onChange={(ev) => onChange({ education: cv.education.map((x, k) => (k === i ? { ...x, title: ev.target.value } : x)) })}
                  placeholder={lang === "ar" ? "المؤهل والجامعة" : "Degree, University"}
                  className={`${inputCls} font-bold`}
                />
                <button
                  type="button"
                  onClick={() => onChange({ education: cv.education.filter((_, k) => k !== i) })}
                  className="shrink-0 w-9 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer"
                  title="امسح"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <LinesBox
                dir={dir}
                rows={3}
                value={e.details}
                onChange={(details) => onChange({ education: cv.education.map((x, k) => (k === i ? { ...x, details } : x)) })}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ education: [...cv.education, { title: "", details: [] }] })}
            className="text-xs font-bold text-sky-700 hover:underline cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> مؤهل
          </button>
        </div>
      </Field>

      <Field label={h.experience} hint="سطر لكل خبرة">
        <LinesBox dir={dir} value={cv.experience} onChange={(experience) => onChange({ experience })} />
      </Field>
      <Field label={h.courses} hint="سطر لكل كورس">
        <LinesBox dir={dir} rows={3} value={cv.courses} onChange={(courses) => onChange({ courses })} />
      </Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label={h.skills} hint="سطر لكل مهارة">
          <LinesBox dir={dir} rows={3} value={cv.skills} onChange={(skills) => onChange({ skills })} />
        </Field>
        <Field label={h.languages}>
          <PairsBox value={cv.languages} onChange={(languages) => onChange({ languages })} dir={dir} labelHint={lang === "ar" ? "اللغة" : "Language"} />
        </Field>
      </div>

      {cv.extra.map((s, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-2.5 space-y-1.5" dir={dir}>
          <div className="flex gap-1.5">
            <input
              value={s.heading}
              onChange={(e) => onChange({ extra: cv.extra.map((x, k) => (k === i ? { ...x, heading: e.target.value } : x)) })}
              className={`${inputCls} font-bold`}
            />
            <button
              type="button"
              onClick={() => onChange({ extra: cv.extra.filter((_, k) => k !== i) })}
              className="shrink-0 w-9 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <LinesBox dir={dir} rows={2} value={s.items} onChange={(items) => onChange({ extra: cv.extra.map((x, k) => (k === i ? { ...x, items } : x)) })} />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange({ extra: [...cv.extra, { heading: lang === "ar" ? "قسم جديد" : "New Section", items: [] }] })}
        className="text-xs font-bold text-sky-700 hover:underline cursor-pointer flex items-center gap-1"
      >
        <Plus className="w-3.5 h-3.5" /> قسم زيادة (هوايات، معرفين...)
      </button>

      <details className="rounded-xl border border-slate-200 p-3">
        <summary className="text-xs font-black text-slate-700 cursor-pointer">أسماء الأقسام في الـ CV</summary>
        <div className="grid sm:grid-cols-2 gap-2 mt-3" dir={dir}>
          {(Object.keys(h) as (keyof typeof h)[]).map((k) => (
            <input key={k} value={h[k]} onChange={(e) => onChange({ headings: { ...h, [k]: e.target.value } })} className={inputCls} />
          ))}
        </div>
      </details>
    </div>
  );
}
