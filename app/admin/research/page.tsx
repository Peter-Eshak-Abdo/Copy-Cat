"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Layers,
  ListOrdered,
  Loader2,
  Minus,
  Palette,
  Plus,
  Sparkles,
  User,
} from "lucide-react";
import { generateResearchDocx, type ResearchCoverInfo } from "@/lib/docx/research-docx";
import { researchToText, type ResearchDoc } from "@/lib/research/types";
import { useToast } from "@/components/toast-provider";
import { getFriendlyErrorMessage } from "@/lib/utils";

const PAGE_CHOICES = [5, 10, 15, 20, 30];

interface Stage {
  text: string;
  progress: number;
  at: number;
}

/** One switch row: label, explanation and a toggle */
function Toggle({
  checked,
  onChange,
  icon,
  title,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-right transition cursor-pointer ${
        checked ? "bg-indigo-50 border-indigo-300" : "bg-white border-slate-200 hover:border-slate-300"
      }`}
      aria-pressed={checked}
    >
      <span className={`p-2 rounded-lg ${checked ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-bold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
      <span className={`w-10 h-6 rounded-full p-0.5 transition ${checked ? "bg-indigo-600" : "bg-slate-300"}`}>
        <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "-translate-x-4" : ""}`} />
      </span>
    </button>
  );
}

export default function ResearchPage() {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [pages, setPages] = useState(10);
  const [customPages, setCustomPages] = useState("");
  const [versionsCount, setVersionsCount] = useState(1);
  const [details, setDetails] = useState("");
  const [colors, setColors] = useState(false);
  const [withImages, setWithImages] = useState(false);
  const [includeIndex, setIncludeIndex] = useState(true);
  const [showCover, setShowCover] = useState(false);
  const [cover, setCover] = useState<ResearchCoverInfo>({ academicYear: "2026 / 2027" });

  const [isLoading, setIsLoading] = useState(false);
  const [stages, setStages] = useState<Stage[]>([]);
  const [now, setNow] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [versions, setVersions] = useState<ResearchDoc[]>([]);
  const [selected, setSelected] = useState(0);
  const [exporting, setExporting] = useState<number | "all" | null>(null);
  const [copied, setCopied] = useState(false);

  const effectivePages = customPages ? Math.max(1, Math.min(60, parseInt(customPages) || pages)) : pages;
  const doc = versions[selected];

  // Conditions written in the notes ("بالألوان", "فيه صور") switch the matching option on
  const onDetails = (text: string) => {
    setDetails(text);
    if (/ألوان|الوان|ملون/.test(text)) setColors(true);
    if (/صور|صوره|صورة/.test(text)) setWithImages(true);
  };

  useEffect(() => {
    if (!isLoading) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [isLoading]);

  const progress = stages.length ? stages[stages.length - 1].progress : 0;
  const elapsed = isLoading && startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.warning("النت فاصل", "عمل البحث محتاج إنترنت. وصّل النت وجرب تاني.");
      return;
    }
    setIsLoading(true);
    setVersions([]);
    setSelected(0);
    const t0 = Date.now();
    setStartedAt(t0);
    setNow(t0);
    setStages([{ text: "بنبعت الطلب", progress: 2, at: t0 }]);

    try {
      const resp = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, targetPages: effectivePages, versionsCount, withImages, customDetails: details }),
      });
      if (!resp.ok || !resp.body) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || "البحث متعملش");
      }
      // The server streams one JSON line per real step
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result: ResearchDoc[] | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "stage") setStages((s) => [...s, { text: ev.text, progress: ev.progress, at: Date.now() }]);
          else if (ev.type === "done") result = ev.versions;
          else if (ev.type === "error") throw new Error(ev.error);
        }
      }
      if (!result || result.length === 0) throw new Error("البحث متعملش");
      setVersions(result);
      const fromWiki = result[0].source === "wikipedia";
      toast.success(
        "البحث جاهز",
        `${result.length > 1 ? `${result.length} نسخ مختلفة` : "نسخة واحدة"}${fromWiki ? "، الكلام من ويكيبيديا" : ""}. نزّل ملف Word.`
      );
    } catch (err) {
      toast.error("البحث متعملش", getFriendlyErrorMessage(err, "جرب تاني بعد شوية."));
    } finally {
      setIsLoading(false);
    }
  };

  const coverInfo = (): ResearchCoverInfo => ({
    studentName: cover.studentName?.trim() || undefined,
    teacherName: cover.teacherName?.trim() || undefined,
    gradeOrClass: cover.gradeOrClass?.trim() || undefined,
    schoolOrUniversity: cover.schoolOrUniversity?.trim() || undefined,
    academicYear: cover.academicYear?.trim() || undefined,
  });

  const download = async (index: number) => {
    setExporting(index);
    try {
      await generateResearchDocx({ doc: versions[index], coverInfo: coverInfo(), includeIndex, colors });
      toast.success("ملف Word نزل", versions.length > 1 ? `النسخة ${index + 1}` : "البحث جاهز للطباعة");
    } catch (err) {
      toast.error("ملف Word منزلش", getFriendlyErrorMessage(err, "جرب تاني."));
    } finally {
      setExporting(null);
    }
  };

  const downloadAll = async () => {
    setExporting("all");
    try {
      for (const v of versions) {
        await generateResearchDocx({ doc: v, coverInfo: coverInfo(), includeIndex, colors });
        await new Promise((r) => setTimeout(r, 400));
      }
      toast.success("كل النسخ نزلت", `${versions.length} ملفات Word، كل نسخة لوحدها.`);
    } catch (err) {
      toast.error("النسخ منزلتش", getFriendlyErrorMessage(err));
    } finally {
      setExporting(null);
    }
  };

  const copyText = () => {
    if (!doc) return;
    navigator.clipboard.writeText(researchToText(doc));
    setCopied(true);
    toast.info("اتنسخ", "نص البحث كله اتنسخ.");
    setTimeout(() => setCopied(false), 2000);
  };

  const stats = useMemo(() => {
    if (!doc) return null;
    const images = doc.sections.reduce((n, s) => n + s.images.length, 0);
    return { sections: doc.sections.length, images, refs: doc.references.length };
  }, [doc]);

  const navy = colors ? "text-[#1F3864]" : "text-slate-900";
  const steel = colors ? "text-[#2E5C8A]" : "text-slate-800";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
      {/* ── Form ── */}
      <form onSubmit={handleGenerate} className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 space-y-5 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-indigo-600 text-white">
            <BookOpen className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-lg font-black text-slate-900">عمل الأبحاث</h1>
            <p className="text-xs text-slate-500">الكلام من مقالات ويكيبيديا الحقيقية، وكل نسخة مختلفة عن التانية</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-bold text-slate-900 block">عنوان البحث</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="مثلاً: التلوث البيئي"
            required
            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3.5 py-3 text-base font-bold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none transition"
          />
          <p className="text-[11px] text-slate-500">العنوان القصير الواضح بيجيب كلام أكتر وأدق.</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-900 block">
            كام صفحة؟ <span className="font-normal text-slate-500 text-xs">(من غير الغلاف والفهرس والمقدمة والخاتمة والمراجع)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {PAGE_CHOICES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setPages(n);
                  setCustomPages("");
                }}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition cursor-pointer ${
                  !customPages && pages === n ? "bg-indigo-600 border-indigo-600 text-white shadow-sm" : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300"
                }`}
              >
                {n}
              </button>
            ))}
            <input
              value={customPages}
              onChange={(e) => setCustomPages(e.target.value.replace(/\D/g, "").slice(0, 2))}
              placeholder="عدد تاني"
              inputMode="numeric"
              className={`w-24 px-3 py-2 rounded-xl text-sm font-bold border text-center focus:outline-none ${
                customPages ? "border-indigo-500 bg-indigo-50" : "border-slate-200"
              }`}
            />
          </div>
          <p className="text-[11px] text-slate-500">الملف كله هيطلع حوالي {effectivePages + 5} صفحة.</p>
        </div>

        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" /> عدد النسخ
            </span>
            <span className="text-[11px] text-slate-500">لو كذا طالب عايزين نفس البحث، كل واحد ياخد نسخة مختلفة</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVersionsCount((n) => Math.max(1, n - 1))}
              className="p-2 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 cursor-pointer"
              aria-label="نسخة أقل"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center text-lg font-black text-indigo-700">{versionsCount}</span>
            <button
              type="button"
              onClick={() => setVersionsCount((n) => Math.min(15, n + 1))}
              className="p-2 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 cursor-pointer"
              aria-label="نسخة زيادة"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Toggle checked={colors} onChange={setColors} icon={<Palette className="w-4 h-4" />} title="بالألوان" hint="العناوين كحلي والباقي بدرجات أزرق هادية" />
          <Toggle checked={withImages} onChange={setWithImages} icon={<ImageIcon className="w-4 h-4" />} title="فيه صور" hint="صور حقيقية من ويكيبيديا، صورة كل صفحتين أو تلاتة" />
          <Toggle checked={includeIndex} onChange={setIncludeIndex} icon={<ListOrdered className="w-4 h-4" />} title="فيه فهرس" hint="صفحة فهرس بعد الغلاف" />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-bold text-slate-900 block">شروط المدرس (مش لازم)</label>
          <textarea
            rows={2}
            value={details}
            onChange={(e) => onDetails(e.target.value)}
            placeholder="مثلاً: بالألوان وفيه صور، يركز على الأسباب والحلول"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none resize-none"
          />
        </div>

        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCover((v) => !v)}
            className="w-full flex items-center justify-between p-3 bg-slate-50 text-sm font-bold text-slate-900 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600" /> بيانات الغلاف
              {cover.studentName && <span className="text-xs font-normal text-slate-500">({cover.studentName})</span>}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showCover ? "rotate-180" : ""}`} />
          </button>
          {showCover && (
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 cc-fade-up">
              {(
                [
                  ["studentName", "اسم الطالب", "أحمد محمد علي"],
                  ["teacherName", "اسم المدرس", "أ/ محمود عثمان"],
                  ["gradeOrClass", "السنة / الصف", "الصف الأول الثانوي"],
                  ["academicYear", "العام الدراسي", "2026 / 2027"],
                  ["schoolOrUniversity", "المدرسة / الكلية", "مدرسة الإسماعيلية الثانوية"],
                ] as const
              ).map(([key, label, ph]) => (
                <label key={key} className={`block ${key === "schoolOrUniversity" ? "sm:col-span-2" : ""}`}>
                  <span className="text-xs font-bold text-slate-600">{label}</span>
                  <input
                    value={cover[key] || ""}
                    onChange={(e) => setCover((c) => ({ ...c, [key]: e.target.value }))}
                    placeholder={ph}
                    className="mt-1 w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !topic.trim()}
          className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {isLoading ? "شغالين على البحث..." : versionsCount > 1 ? `اعمل البحث (${versionsCount} نسخ)` : "اعمل البحث"}
        </button>
      </form>

      {/* ── Progress / result ── */}
      <div className="xl:col-span-3 space-y-4">
        {isLoading && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 cc-fade-up" role="status" aria-live="polite">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-slate-900">بنجهز البحث عن «{topic}»</span>
              <span className="text-xs font-mono text-slate-500">{elapsed} ث</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-indigo-600 transition-all duration-700" style={{ width: `${Math.max(3, progress)}%` }} />
            </div>
            <ol className="space-y-2">
              {stages.map((s, i) => {
                const current = i === stages.length - 1;
                return (
                  <li key={i} className="flex items-center gap-2.5 text-sm cc-fade-up">
                    {current ? (
                      <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    <span className={current ? "font-bold text-slate-900" : "text-slate-500"}>{s.text}</span>
                  </li>
                );
              })}
            </ol>
            <div className="space-y-2 pt-1">
              <div className="h-4 w-2/3 rounded cc-shimmer" />
              <div className="h-3 w-full rounded cc-shimmer" />
              <div className="h-3 w-5/6 rounded cc-shimmer" />
            </div>
          </div>
        )}

        {!isLoading && !doc && (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center space-y-3">
            <FileText className="w-12 h-12 text-slate-300 mx-auto" />
            <h2 className="text-base font-black text-slate-800">البحث هيظهر هنا</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              اكتب العنوان واختار عدد الصفحات ودوس «اعمل البحث». هيطلعلك ملف Word فيه غلاف وفهرس ومقدمة والموضوع وخاتمة في صفحة لوحدها ومراجع.
            </p>
          </div>
        )}

        {!isLoading && doc && stats && (
          <div className="space-y-4 cc-fade-up">
            {versions.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {versions.map((v, i) => (
                  <button
                    key={v.versionNumber}
                    type="button"
                    onClick={() => setSelected(i)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      i === selected ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300"
                    }`}
                  >
                    نسخة {v.versionNumber} <span className="opacity-75">({v.font})</span>
                  </button>
                ))}
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center gap-3 justify-between">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-bold text-slate-700">{stats.sections} عنوان</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-bold text-slate-700">حوالي {effectivePages} صفحة موضوع</span>
                {stats.images > 0 && <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-bold text-slate-700">{stats.images} صور</span>}
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-bold text-slate-700">الخط: {doc.font}</span>
                <span className={`px-2.5 py-1 rounded-lg font-bold ${doc.source === "wikipedia" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {doc.source === "wikipedia" ? "الكلام من ويكيبيديا" : "مكتوب بالذكاء الاصطناعي (ويكيبيديا مكانش فيها كفاية)"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={copyText} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "اتنسخ" : "انسخ النص"}
                </button>
                <button
                  type="button"
                  onClick={() => download(selected)}
                  disabled={exporting !== null}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-60 cursor-pointer"
                >
                  {exporting === selected ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {exporting === selected ? (stats.images ? "بننزل الصور ونجهز الملف..." : "بنجهز الملف...") : versions.length > 1 ? `نزّل النسخة ${selected + 1}` : "نزّل Word"}
                </button>
                {versions.length > 1 && (
                  <button
                    type="button"
                    onClick={downloadAll}
                    disabled={exporting !== null}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-60 cursor-pointer"
                  >
                    {exporting === "all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    نزّل الكل ({versions.length})
                  </button>
                )}
              </div>
            </div>

            {/* Preview, laid out like the Word file */}
            <article
              key={doc.versionNumber}
              dir="rtl"
              className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs max-h-[70vh] overflow-y-auto space-y-4 cc-fade-up text-right"
              style={{ fontFamily: `"${doc.font}", Arial, sans-serif` }}
            >
              <h2 className={`text-2xl font-black text-center ${navy}`}>{doc.topic}</h2>
              <section className="space-y-2">
                <h3 className={`text-lg font-black ${navy} ${colors ? "border-b border-[#8EAADB] pb-1" : ""}`}>المقدمة</h3>
                {doc.intro.map((p, i) => (
                  <p key={i} className="text-[15px] leading-8 text-slate-800">{p}</p>
                ))}
              </section>
              {doc.sections.map((s, si) => (
                <section key={si} className="space-y-2">
                  <h3 className={`text-lg font-black ${navy} ${colors ? "border-b border-[#8EAADB] pb-1" : ""}`}>{s.title}</h3>
                  {s.paragraphs.map((p, pi) => (
                    <div key={pi} className="space-y-2">
                      <p className="text-[15px] leading-8 text-slate-800">{p}</p>
                      {s.images
                        .filter((im) => im.afterParagraph === pi)
                        .map((im) => (
                          <figure key={im.url} className="text-center">
                            {/* eslint-disable-next-line @next/next/no-img-element -- Wikimedia thumbnail */}
                            <img src={im.url} alt={im.caption} loading="lazy" className="mx-auto max-h-64 rounded-lg border border-slate-200" />
                            <figcaption className="text-xs text-slate-500 mt-1">{im.caption}</figcaption>
                          </figure>
                        ))}
                    </div>
                  ))}
                  {s.subsections.map((sub, k) => (
                    <div key={k} className="space-y-2">
                      <h4 className={`text-base font-bold ${steel}`}>{sub.title}</h4>
                      {sub.paragraphs.map((p, pi) => (
                        <p key={pi} className="text-[15px] leading-8 text-slate-800">{p}</p>
                      ))}
                    </div>
                  ))}
                </section>
              ))}
              <section className="space-y-2 pt-4 border-t border-dashed border-slate-200">
                <h3 className={`text-lg font-black ${navy}`}>الخاتمة <span className="text-xs font-normal text-slate-400">(في صفحة لوحدها في الملف)</span></h3>
                {doc.conclusion.map((p, i) => (
                  <p key={i} className="text-[15px] leading-8 text-slate-800">{p}</p>
                ))}
              </section>
              {doc.references.length > 0 && (
                <section className="space-y-2">
                  <h3 className={`text-lg font-black ${navy}`}>المراجع</h3>
                  <ol className="list-decimal pr-5 space-y-1 text-sm text-slate-700">
                    {doc.references.map((r) => (
                      <li key={r.url}>
                        {r.title}، {r.site}.{" "}
                        <a href={r.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline break-all" dir="ltr">
                          {decodeURIComponent(r.url)}
                        </a>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </article>
          </div>
        )}
      </div>
    </div>
  );
}
