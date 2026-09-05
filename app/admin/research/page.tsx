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
  User,
  GraduationCap,
  School,
} from "lucide-react";
import { generateResearchDocx, ResearchCoverInfo } from "@/lib/docx/research-docx";
import { useToast } from "@/components/toast-provider";
import { getFriendlyErrorMessage } from "@/lib/utils";

export default function ResearchPage() {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [targetPages, setTargetPages] = useState(5);
  const includeIntro = true;
  const [includeIndex, setIncludeIndex] = useState(true);
  const includeConclusion = true;
  const [includeRefs, setIncludeRefs] = useState(true);

  // Cover Information State (Item #13)
  const [studentName, setStudentName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [gradeOrClass, setGradeOrClass] = useState("");
  const [schoolOrUniversity, setSchoolOrUniversity] = useState("");
  const [academicYear, setAcademicYear] = useState("2025 - 2026");

  const [isLoading, setIsLoading] = useState(false);
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.warning(
        "أنت غير متصل بالإنترنت",
        "توليد محتوى جديد بالذكاء الاصطناعي يتطلب اتصالاً بالإنترنت. يرجى الاتصال بالشبكة للمتابعة."
      );
      return;
    }

    setIsLoading(true);
    setGeneratedText(null);
    setActiveProvider(null);

    try {
      const resp = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          targetPages,
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
      toast.success("تم توليد البحث بنجاح", `تم إنشاء مسودة بحث متكاملة عن "${topic}".`);
    } catch (err) {
      toast.error(
        "تعذر توليد محتوى البحث",
        getFriendlyErrorMessage(err, "حدث خطأ أثناء الاتصال بخدمة الذكاء الاصطناعي.")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadDocx = async () => {
    if (!generatedText || !topic) return;
    setIsExportingDocx(true);

    const coverInfo: ResearchCoverInfo = {
      studentName: studentName.trim() || undefined,
      teacherName: teacherName.trim() || undefined,
      gradeOrClass: gradeOrClass.trim() || undefined,
      schoolOrUniversity: schoolOrUniversity.trim() || undefined,
      academicYear: academicYear.trim() || undefined,
    };

    try {
      await generateResearchDocx({
        topic,
        rawText: generatedText,
        includeIndex,
        includeReferences: includeRefs,
        coverInfo,
        targetPages,
      });
      toast.success(
        "تم تنزيل ملف الوورد بنجاح",
        `تم حفظ البحث "${topic}" بتنسيق Word A4 منسق وجاهز للطباعة فوراً.`
      );
    } catch (err) {
      console.error(err);
      toast.error(
        "تعذر توليد ملف الوورد",
        getFriendlyErrorMessage(err, "يرجى المحاولة مرة أخرى.")
      );
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleCopy = () => {
    if (!generatedText) return;
    navigator.clipboard.writeText(generatedText);
    setCopied(true);
    toast.info("تم نسخ النص", "تم نسخ محتوى البحث كاملاً إلى الحافظة.");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 p-6 rounded-3xl border border-purple-500/20 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> صياغة أبحاث بأسلوب أكاديمي طبيعي وتنسيق Word A4 ضيق الهوامش
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white">
            مولد وتنسيق الأبحاث المدرسية والجامعية المتكامل
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-3xl leading-relaxed">
            صياغة بشرية متماسكة، غلاف رسمي كامل (اسم الطالب والمشرف والمدرسة)، فهرس محتويات بجدول منسق،
            وفواصل صفحات (Page Breaks) لمنع تلف التنسيق عند التعديل، مع هوامش ضيقة A4 وخطوط 18 / 20 / 22pt معتمدة!
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Panel */}
        <form
          onSubmit={handleGenerate}
          className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl p-6 space-y-5 h-fit shadow-xl"
        >
          {/* Topic */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 block">عنوان أو موضوع البحث المطلوب:</label>
            <textarea
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="مثال: الذكاء الاصطناعي وتطبيقاته في الطب الحديث..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-white focus:border-purple-500 focus:outline-none transition resize-none leading-relaxed"
              required
            />
          </div>

          {/* Target Pages */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">الحجم التقديري للبحث المطبوع:</label>
            <div className="grid grid-cols-4 gap-2">
              {[5, 8, 10, 15].map((pages) => (
                <button
                  key={pages}
                  type="button"
                  onClick={() => setTargetPages(pages)}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition cursor-pointer border ${
                    targetPages === pages
                      ? "bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/20"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {pages} صفحات
                </button>
              ))}
            </div>
          </div>

          {/* Cover Page Metadata Box (Item #13) */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-3">
            <span className="text-xs font-bold text-purple-400 block border-b border-slate-800 pb-1.5">
              بيانات صفحة الغلاف الرسمية:
            </span>

            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">اسم الطالب / الباحث:</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5" />
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="مثال: أحمد محمد علي"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-8 pl-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">اسم الأستاذ / المشرف:</label>
                <div className="relative">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5" />
                  <input
                    type="text"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    placeholder="مثال: أ.د / محمود عثمان"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-8 pl-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">الصف / الفرقة:</label>
                  <input
                    type="text"
                    value={gradeOrClass}
                    onChange={(e) => setGradeOrClass(e.target.value)}
                    placeholder="مثال: الصف الثالث الثانوي"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">العام الدراسي:</label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="2025 - 2026"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">المدرسة / الكلية والجامعة:</label>
                <div className="relative">
                  <School className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5" />
                  <input
                    type="text"
                    value={schoolOrUniversity}
                    onChange={(e) => setSchoolOrUniversity(e.target.value)}
                    placeholder="مثال: مدرسة المتفوقين / كلية الهندسة"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-8 pl-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2 pt-1 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIncludeIndex(!includeIndex)}
              className="w-full flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300 hover:border-purple-500/40 transition cursor-pointer"
            >
              <span>إدراج صفحة فهرس المحتويات (جدول منظم)</span>
              {includeIndex ? (
                <CheckSquare className="w-4 h-4 text-purple-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIncludeRefs(!includeRefs)}
              className="w-full flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300 hover:border-purple-500/40 transition cursor-pointer"
            >
              <span>إدراج صفحة المصادر والمراجع المعتمدة</span>
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
            className="w-full py-3.5 px-4 rounded-2xl bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-purple-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري صياغة وكتابة البحث الأكاديمي...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>توليد وصياغة البحث الأكاديمي</span>
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
                  <span className="font-bold text-white text-base">معاينة نص البحث</span>
                  {activeProvider && (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 flex items-center gap-1 font-medium">
                      <Server className="w-3 h-3" /> تم التوليد عبر: {activeProvider}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "تم النسخ" : "نسخ النص"}</span>
                  </button>

                  <button
                    onClick={handleDownloadDocx}
                    disabled={isExportingDocx}
                    className="flex items-center gap-2 py-2 px-5 rounded-xl bg-linear-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isExportingDocx ? "جاري تجهيز الوورد..." : "تنزيل مستند Word كامل (.docx)"}</span>
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
              <p className="text-xs max-w-md text-slate-400 leading-relaxed">
                أدخل عنوان البحث وبيانات الغلاف واضغط &quot;توليد وصياغة البحث&quot;. سيتكفل النظام بتوليد محتوى ثري وطبيعي
                وتصدير ملف Word مقاس A4 بهوامش ضيقة وخطوط معتمدة وفهرس وغلاف رسمي جاهز للطباعة والتسليم فوراً.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
