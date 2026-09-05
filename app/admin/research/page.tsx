"use client";

import { useState } from "react";
import {
  FileText,
  Sparkles,
  Download,
  Loader2,
  BookOpen,
  CheckSquare,
  Square,
  Zap,
  Server,
  Copy,
  Check,
} from "lucide-react";
import { generateResearchDocx } from "@/lib/docx/research-docx";

export default function ResearchPage() {
  const [topic, setTopic] = useState("");
  const [includeIntro, setIncludeIntro] = useState(true);
  const [includeIndex, setIncludeIndex] = useState(true);
  const [includeConclusion, setIncludeConclusion] = useState(true);
  const [includeRefs, setIncludeRefs] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsLoading(true);
    setGeneratedText(null);
    setActiveProvider(null);

    try {
      const resp = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          includeIntro,
          includeConclusion,
          includeRefs,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "فشل توليد البحث");
      }

      setGeneratedText(data.content);
      setActiveProvider(data.provider || "Gemini Flash");
    } catch (err: any) {
      alert(err.message || "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadDocx = async () => {
    if (!generatedText || !topic) return;
    setIsExportingDocx(true);
    try {
      await generateResearchDocx({
        topic,
        rawText: generatedText,
        includeIndex,
      });
    } catch (err) {
      console.error(err);
      alert("تعذر توليد ملف الوورد");
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleCopy = () => {
    if (!generatedText) return;
    navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 p-6 rounded-3xl border border-purple-500/20 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold mb-2">
            <Zap className="w-3.5 h-3.5" /> نظام Fallback ذكي مدمج مع 5 محركات فائقة السرعة
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">
            مولد الأبحاث والتقارير الأكاديمية الذكي
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            يعمل تلقائياً عبر محركات (Gemini 1.5 Flash + Groq Llama 3.3 + Llama 3.1 Instant + Cohere Command-R+) لضمان عدم توقف الخدمة وتوليد أبحاث كاملة مع غلاف وفهرس Word جاهز للطباعة.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Panel */}
        <form
          onSubmit={handleGenerate}
          className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl p-6 space-y-6 h-fit shadow-xl"
        >
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-200 block">عنوان أو موضوع البحث الأكاديمي:</label>
            <textarea
              rows={4}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="مثال: الأمن السيبراني والذكاء الاصطناعي في حماية البيانات الحيوية..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none transition resize-none leading-relaxed"
              required
            />
          </div>

          {/* Structure Options */}
          <div className="space-y-2.5 pt-2 border-t border-slate-800">
            <label className="text-xs font-bold text-slate-400 block mb-2">أقسام البحث التلقائية:</label>

            <button
              type="button"
              onClick={() => setIncludeIndex(!includeIndex)}
              className="w-full flex items-center justify-between text-sm py-2.5 px-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-slate-300 hover:border-purple-500/40 transition"
            >
              <span>صفحة فهرس المحتويات الأوتوماتيكي</span>
              {includeIndex ? (
                <CheckSquare className="w-4 h-4 text-purple-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIncludeIntro(!includeIntro)}
              className="w-full flex items-center justify-between text-sm py-2.5 px-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-slate-300 hover:border-purple-500/40 transition"
            >
              <span>مقدمة تمهيدية موسعة</span>
              {includeIntro ? (
                <CheckSquare className="w-4 h-4 text-purple-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIncludeConclusion(!includeConclusion)}
              className="w-full flex items-center justify-between text-sm py-2.5 px-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-slate-300 hover:border-purple-500/40 transition"
            >
              <span>خاتمة ونتائج وتوصيات</span>
              {includeConclusion ? (
                <CheckSquare className="w-4 h-4 text-purple-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIncludeRefs(!includeRefs)}
              className="w-full flex items-center justify-between text-sm py-2.5 px-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-slate-300 hover:border-purple-500/40 transition"
            >
              <span>قائمة مراجع ومصادر علمية موثوقة</span>
              {includeRefs ? (
                <CheckSquare className="w-4 h-4 text-purple-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600" />
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading || !topic.trim()}
            className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-purple-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري صياغة وكتابة البحث الأكاديمي...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>توليد البحث بالذكاء الاصطناعي</span>
              </>
            )}
          </button>
        </form>

        {/* Results Panel */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between min-h-[550px] shadow-xl">
          {generatedText ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-400" />
                  <span className="font-bold text-white text-base">معاينة البحث الناتج</span>
                  {activeProvider && (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 flex items-center gap-1 font-medium">
                      <Server className="w-3 h-3" /> تم التوليد عبر: {activeProvider}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "تم النسخ" : "نسخ النص"}</span>
                  </button>

                  <button
                    onClick={handleDownloadDocx}
                    disabled={isExportingDocx}
                    className="flex items-center gap-2 py-2 px-5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isExportingDocx ? "جاري التجهيز..." : "تحميل كملف Word منسق (.docx)"}</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 max-h-[600px] overflow-y-auto whitespace-pre-wrap text-slate-200 text-sm leading-relaxed font-sans select-text">
                {generatedText}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <div className="w-16 h-16 rounded-3xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4 shadow-inner">
                <FileText className="w-8 h-8" />
              </div>
              <p className="text-base font-bold text-slate-200 mb-1">جاهز لكتابة وتنسيق بحثك فوراً</p>
              <p className="text-xs max-w-sm text-slate-400 leading-relaxed">
                أدخل الموضوع وحدد الخيارات المطلوبة واضغط "توليد البحث". سيقوم النظام بالاتصال بأسرع خادم ذكاء اصطناعي متاح وإخراج ملف Word منسق بالكامل.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
