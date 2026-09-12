"use client";

import { useState, useEffect } from "react";
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
  Plus,
  Trash2,
  RotateCcw,
  Layers,
  X,
} from "lucide-react";
import {
  generateResearchDocx,
  ResearchCoverInfo,
  TOP_ARABIC_ACADEMIC_SOURCES,
  CustomResearchSource,
} from "@/lib/docx/research-docx";
import { useToast } from "@/components/toast-provider";
import { getFriendlyErrorMessage } from "@/lib/utils";

interface GeneratedVersion {
  id: number;
  angle: string;
  title: string;
  content: string;
}

export default function ResearchPage() {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [targetPages, setTargetPages] = useState(5);
  const [customPages, setCustomPages] = useState("");
  const [isCustomPages, setIsCustomPages] = useState(false);
  const [customDetails, setCustomDetails] = useState("");
  const includeIntro = true;
  const [includeIndex, setIncludeIndex] = useState(true);
  const includeConclusion = true;
  const [includeRefs, setIncludeRefs] = useState(true);

  // Versions Count (Item #1)
  const [versionsCount, setVersionsCount] = useState(1);
  const [generatedVersions, setGeneratedVersions] = useState<GeneratedVersion[]>([]);
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(0);
  const [isBatchExporting, setIsBatchExporting] = useState(false);

  // Cover Information State (Item #13)
  const [studentName, setStudentName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [gradeOrClass, setGradeOrClass] = useState("");
  const [schoolOrUniversity, setSchoolOrUniversity] = useState("");
  const [academicYear, setAcademicYear] = useState("2026 / 2027");

  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [copied, setCopied] = useState(false);

  // Custom Sources Management State (Item #2)
  const [sources, setSources] = useState<CustomResearchSource[]>([]);
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceDesc, setNewSourceDesc] = useState("");
  const [newSourceCategory, setNewSourceCategory] = useState("دوريات محكمة وقواعد بيانات");
  const [newSourceCitation, setNewSourceCitation] = useState("");

  // Load sources from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("copycat_custom_research_sources_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSources(parsed);
          return;
        }
      }
    } catch {}
    // Default to Top 10 Arabic Academic Sources
    setSources(
      TOP_ARABIC_ACADEMIC_SOURCES.map((s) => ({
        id: s.id,
        name: s.name,
        desc: s.desc,
        category: s.category,
      }))
    );
  }, []);

  // Live timer for research generation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleAddSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim()) return;
    const newSource: CustomResearchSource = {
      id: "source-" + Date.now(),
      name: newSourceName.trim(),
      desc: newSourceDesc.trim() || "مصدر أكاديمي معتمد للتوثيق والاستشهاد",
      category: newSourceCategory.trim() || "مراجع متخصصة",
      citation: newSourceCitation.trim() || undefined,
    };
    const updated = [newSource, ...sources];
    setSources(updated);
    try {
      localStorage.setItem("copycat_custom_research_sources_v1", JSON.stringify(updated));
    } catch {}
    setShowAddSourceModal(false);
    setNewSourceName("");
    setNewSourceDesc("");
    setNewSourceCitation("");
    toast.success("تمت إضافة المصدر بنجاح", `تم إدراج "${newSource.name}" ضمن المصادر المعتمدة.`);
  };

  const handleDeleteSource = (id: string, name: string) => {
    const updated = sources.filter((s) => s.id !== id);
    setSources(updated);
    try {
      localStorage.setItem("copycat_custom_research_sources_v1", JSON.stringify(updated));
    } catch {}
    toast.info("تم حذف المصدر", `تمت إزالة "${name}" من قائمة المصادر.`);
  };

  const handleResetSources = () => {
    const defaults: CustomResearchSource[] = TOP_ARABIC_ACADEMIC_SOURCES.map((s) => ({
      id: s.id,
      name: s.name,
      desc: s.desc,
      category: s.category,
    }));
    setSources(defaults);
    try {
      localStorage.setItem("copycat_custom_research_sources_v1", JSON.stringify(defaults));
    } catch {}
    toast.success("تمت استعادة المصادر الافتراضية", "تمت استعادة الـ 10 مصادر الأكاديمية الرسمية المعتمدة.");
  };

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
    setGeneratedVersions([]);
    setActiveProvider(null);

    const effectivePages = isCustomPages
      ? Math.max(1, Math.min(60, parseInt(customPages) || 5))
      : targetPages;

    try {
      const resp = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          targetPages: effectivePages,
          includeIntro,
          includeIndex,
          includeConclusion,
          includeRefs,
          customDetails,
          versionsCount,
          customSources: sources.map((s) => ({
            name: s.name,
            category: s.category,
            desc: s.desc,
            citation: s.citation,
          })),
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "فشل توليد البحث");
      }

      if (data.versions && Array.isArray(data.versions) && data.versions.length > 0) {
        setGeneratedVersions(data.versions);
        setSelectedVersionIndex(0);
        setGeneratedText(data.versions[0].content);
      } else {
        const singleVersion: GeneratedVersion = {
          id: 1,
          angle: "النسخة الرئيسية",
          title: `بحث متكامل عن: ${topic}`,
          content: data.content,
        };
        setGeneratedVersions([singleVersion]);
        setSelectedVersionIndex(0);
        setGeneratedText(data.content);
      }

      setActiveProvider(data.provider || "Gemini Flash");
      toast.success(
        "تم توليد البحث بنجاح",
        versionsCount > 1
          ? `تم إنشاء (${data.versions?.length || versionsCount}) نسخ متباينة ومستقلة تماماً من البحث.`
          : `تم إنشاء مسودة بحث متكاملة عن "${topic}".`
      );
    } catch (err) {
      toast.error(
        "تعذر توليد محتوى البحث",
        getFriendlyErrorMessage(err, "حدث خطأ أثناء الاتصال بخدمة الذكاء الاصطناعي.")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadDocx = async (targetVersionIdx = selectedVersionIndex) => {
    const versionToExport = generatedVersions[targetVersionIdx];
    const textToExport = versionToExport?.content || generatedText;
    if (!textToExport || !topic) return;

    setIsExportingDocx(true);

    const effectivePages = isCustomPages
      ? Math.max(1, Math.min(60, parseInt(customPages) || 5))
      : targetPages;

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
        rawText: textToExport,
        includeIndex,
        includeReferences: includeRefs,
        coverInfo,
        targetPages: effectivePages,
        sources,
        versionNumber: generatedVersions.length > 1 ? targetVersionIdx + 1 : undefined,
      });
      toast.success(
        "تم تنزيل ملف الوورد بنجاح",
        `تم حفظ ${generatedVersions.length > 1 ? `النسخة (${targetVersionIdx + 1})` : "البحث"} بتنسيق Word A4 منسق وجاهز للطباعة فوراً.`
      );
    } catch (err) {
      console.error(err);
      toast.error("تعذر توليد ملف الوورد", getFriendlyErrorMessage(err, "يرجى المحاولة مرة أخرى."));
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleDownloadAllVersions = async () => {
    if (generatedVersions.length === 0 || !topic) return;
    setIsBatchExporting(true);

    const effectivePages = isCustomPages
      ? Math.max(1, Math.min(60, parseInt(customPages) || 5))
      : targetPages;

    const coverInfo: ResearchCoverInfo = {
      studentName: studentName.trim() || undefined,
      teacherName: teacherName.trim() || undefined,
      gradeOrClass: gradeOrClass.trim() || undefined,
      schoolOrUniversity: schoolOrUniversity.trim() || undefined,
      academicYear: academicYear.trim() || undefined,
    };

    try {
      for (let i = 0; i < generatedVersions.length; i++) {
        const v = generatedVersions[i];
        await generateResearchDocx({
          topic,
          rawText: v.content,
          includeIndex,
          includeReferences: includeRefs,
          coverInfo,
          targetPages: effectivePages,
          sources,
          versionNumber: i + 1,
        });
        // Small delay to allow browser to trigger each download smoothly
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      toast.success(
        "تم تنزيل جميع النسخ بنجاح",
        `تم تصدير وحفظ كل النسخ الـ (${generatedVersions.length}) كملفات Word مستقلة.`
      );
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء تنزيل النسخ", getFriendlyErrorMessage(err));
    } finally {
      setIsBatchExporting(false);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-linear-to-r from-purple-950/40 via-slate-900 to-slate-900 p-6 rounded-3xl border border-purple-500/20 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> صياغة أبحاث بأسلوب أكاديمي طبيعي وتنسيق Word A4 ضيق الهوامش
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white">
            مولد وتنسيق الأبحاث المدرسية والجامعية المتكامل
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-3xl leading-relaxed">
            صياغة بشرية متماسكة، غلاف رسمي كامل، فهرس محتويات تفاعلي، وتوليد حتى 15 نسخة مختلفة تماماً لنفس البحث بدون أي
            تطابق لمنع تكرار الواجبات بين الطلاب، مع إدارة كاملة للمصادر والمراجع الأكاديمية!
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

          {/* Versions Count (Item #1) */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-purple-950/25 border border-purple-500/30">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-purple-200 block flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-400" /> عدد النسخ المطلوبة للبحث (1 - 15):
              </label>
              <span className="text-xs font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                {versionsCount} {versionsCount === 1 ? "نسخة واحدة" : "نسخ مستقلة"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              لو طلب 15 طالباً نفس البحث، كل نسخة ستصدر بزاوية وهيكل ومقدمة وعناوين واستنتاجات فريدة تماماً لضمان عدم التطابق!
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="range"
                min="1"
                max="15"
                value={versionsCount}
                onChange={(e) => setVersionsCount(Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer h-2 bg-slate-950 rounded-lg"
              />
              <div className="flex items-center gap-1">
                {[1, 3, 5, 10, 15].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setVersionsCount(cnt)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                      versionsCount === cnt
                        ? "bg-purple-600 text-white border-purple-400"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Custom Requirements / Details */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">
              شروط وتفاصيل خاصة وملاحظات بالبحث (اختياري):
            </label>
            <textarea
              rows={2}
              value={customDetails}
              onChange={(e) => setCustomDetails(e.target.value)}
              placeholder="مثال: التركيز على 5 نقاط معينة، إضافة مقارنة أو إحصائيات، الالتزام بشروط الدكتور..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white focus:border-purple-500 focus:outline-none transition resize-none leading-relaxed"
            />
          </div>

          {/* Target Pages */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">الحجم التقديري للبحث المطبوع:</label>
            <div className="grid grid-cols-6 gap-1.5">
              {[5, 10, 15, 20, 30].map((pages) => (
                <button
                  key={pages}
                  type="button"
                  onClick={() => {
                    setTargetPages(pages);
                    setIsCustomPages(false);
                  }}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition cursor-pointer border ${
                    !isCustomPages && targetPages === pages
                      ? "bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/20"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {pages} ص
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsCustomPages(true)}
                className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition cursor-pointer border ${
                  isCustomPages
                    ? "bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/20"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
                }`}
              >
                أخرى
              </button>
            </div>

            {isCustomPages && (
              <div className="mt-2 flex items-center gap-2 p-2 rounded-xl bg-purple-950/20 border border-purple-500/30">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={customPages}
                  onChange={(e) => setCustomPages(e.target.value)}
                  placeholder="اكتب عدد الصفحات (مثلاً 25 أو 30)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-purple-400 focus:outline-none"
                />
                <span className="text-xs text-purple-300 whitespace-nowrap font-bold">صفحة</span>
              </div>
            )}
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
                    placeholder="2026 / 2027"
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
                <span>جاري صياغة وكتابة النسخ الأكاديمية ({versionsCount})...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>
                  توليد وصياغة البحث الأكاديمي {versionsCount > 1 ? `(${versionsCount} نسخ مختلفة)` : ""}
                </span>
              </>
            )}
          </button>
        </form>

        {/* Results Panel */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between min-h-[550px] shadow-xl">
          {generatedText ? (
            <div className="space-y-4">
              {/* Version Switcher Tabs if multiple versions generated */}
              {generatedVersions.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-400 shrink-0 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-purple-400" /> النسخ المُولدة:
                  </span>
                  {generatedVersions.map((v, idx) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setSelectedVersionIndex(idx);
                        setGeneratedText(v.content);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
                        selectedVersionIndex === idx
                          ? "bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                      }`}
                    >
                      <span>نسخة {v.id}</span>
                      <span className="text-[10px] opacity-80">({v.angle.split(" ")[1] || v.angle})</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-400" />
                  <span className="font-bold text-white text-base">
                    معاينة نص البحث {generatedVersions.length > 1 ? `(نسخة ${selectedVersionIndex + 1})` : ""}
                  </span>
                  {activeProvider && (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 flex items-center gap-1 font-medium">
                      <Server className="w-3 h-3" /> تم التوليد عبر: {activeProvider}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "تم النسخ" : "نسخ النص"}</span>
                  </button>

                  <button
                    onClick={() => handleDownloadDocx(selectedVersionIndex)}
                    disabled={isExportingDocx || isBatchExporting}
                    className="flex items-center gap-2 py-2 px-4 rounded-xl bg-linear-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      {isExportingDocx
                        ? "جاري التجهيز..."
                        : generatedVersions.length > 1
                        ? `تنزيل النسخة (${selectedVersionIndex + 1})`
                        : "تنزيل مستند Word كامل (.docx)"}
                    </span>
                  </button>

                  {generatedVersions.length > 1 && (
                    <button
                      onClick={handleDownloadAllVersions}
                      disabled={isBatchExporting || isExportingDocx}
                      className="flex items-center gap-2 py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5 text-purple-400" />
                      <span>
                        {isBatchExporting ? "جاري تنزيل كل النسخ..." : `تنزيل كل النسخ (${generatedVersions.length})`}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 max-h-[600px] overflow-y-auto whitespace-pre-wrap text-slate-200 text-sm leading-relaxed font-sans select-text">
                {generatedText}
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto w-full">
              {/* Spinner & Glow */}
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-3xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 animate-pulse shadow-xl shadow-purple-600/20">
                  <Sparkles className="w-10 h-10 animate-spin text-purple-400" style={{ animationDuration: "3s" }} />
                </div>
                <div className="absolute -inset-2 bg-linear-to-r from-purple-500/30 to-indigo-500/30 rounded-3xl blur-xl -z-10" />
              </div>

              <h3 className="text-lg font-bold text-white mb-2">
                جاري صياغة وكتابة البحث الأكاديمي {versionsCount > 1 ? `(${versionsCount} نسخ مستقلة)...` : "..."}
              </h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                يقوم محرك الذكاء الاصطناعي الآن بصياغة محتوى علمي متعمق بدون حشو، منسق بالهيكل الجامعي المعتمد وزوايا تناول
                متباينة.
              </p>

              {/* Live Timer Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-950/60 border border-purple-800/50 text-purple-300 text-xs font-bold mb-5 shadow-inner">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                <span>الوقت المستغرق: {elapsedSeconds} ثانية</span>
              </div>

              {/* Visual Progress Bar */}
              <div className="w-full bg-slate-950 rounded-full h-3 p-0.5 border border-slate-800 mb-6 overflow-hidden">
                <div
                  className="bg-linear-to-r from-purple-500 via-indigo-400 to-purple-400 h-full rounded-full transition-all duration-1000 shadow-lg shadow-purple-500/40"
                  style={{ width: `${Math.min(96, Math.max(15, elapsedSeconds * 2.8))}%` }}
                />
              </div>

              {/* Step Checklist */}
              <div className="w-full bg-slate-950/80 rounded-2xl border border-slate-800/80 p-4 text-right space-y-2.5 text-xs">
                <div
                  className={`flex items-center justify-between gap-2 ${
                    elapsedSeconds >= 0 ? "text-purple-300 font-bold" : "text-slate-500"
                  }`}
                >
                  <span>1. تحليل الموضوع وإعداد الهيكلية الأكاديمية والزوايا المتباينة</span>
                  <span className="text-[11px]">{elapsedSeconds > 10 ? "✓ تم" : "جاري..."}</span>
                </div>
                <div
                  className={`flex items-center justify-between gap-2 ${
                    elapsedSeconds >= 12 ? "text-purple-300 font-bold" : "text-slate-500"
                  }`}
                >
                  <span>2. صياغة المقدمة والمنهجية والأهداف وإشكالية البحث لكل نسخة</span>
                  <span className="text-[11px]">
                    {elapsedSeconds > 28 ? "✓ تم" : elapsedSeconds >= 12 ? "جاري..." : "قيد الانتظار"}
                  </span>
                </div>
                <div
                  className={`flex items-center justify-between gap-2 ${
                    elapsedSeconds >= 30 ? "text-purple-300 font-bold" : "text-slate-500"
                  }`}
                >
                  <span>3. كتابة المباحث ومناقشة المحتوى العلمي والمراجع المعتمدة</span>
                  <span className="text-[11px]">
                    {elapsedSeconds > 60 ? "✓ تم" : elapsedSeconds >= 30 ? "جاري..." : "قيد الانتظار"}
                  </span>
                </div>
                <div
                  className={`flex items-center justify-between gap-2 ${
                    elapsedSeconds >= 62 ? "text-purple-300 font-bold" : "text-slate-500"
                  }`}
                >
                  <span>4. صياغة الخاتمة والتوصيات وتدقيق قائمة المراجع لكل نسخة</span>
                  <span className="text-[11px]">
                    {elapsedSeconds > 80 ? "✓ تم" : elapsedSeconds >= 62 ? "جاري..." : "قيد الانتظار"}
                  </span>
                </div>
                <div
                  className={`flex items-center justify-between gap-2 ${
                    elapsedSeconds >= 82 ? "text-purple-300 font-bold" : "text-slate-500"
                  }`}
                >
                  <span>5. مراجعة التنسيقات وتجهيز ملفات Word (DOCX) للتحميل</span>
                  <span className="text-[11px]">{elapsedSeconds >= 82 ? "جاري..." : "قيد الانتظار"}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <div className="w-16 h-16 rounded-3xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4 shadow-inner">
                <FileText className="w-8 h-8" />
              </div>
              <p className="text-base font-bold text-slate-200 mb-1">جاهز لكتابة وتنسيق بحثك فوراً</p>
              <p className="text-xs max-w-md text-slate-400 leading-relaxed">
                أدخل عنوان البحث وبيانات الغلاف وعدد النسخ واضغط &quot;توليد وصياغة البحث&quot;. سيتكفل النظام بتوليد
                محتوى ثري وطبيعي ومستقل وتصدير ملفات Word مقاس A4 بهوامش ضيقة وغلاف رسمي وفهرس جاهزة للطباعة فوراً.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Custom Sources Management Card (Item #2) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-inner">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm md:text-base font-bold text-white">
                  المصادر وقواعد البيانات البحثية المعتمدة للتوثيق
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                  {sources.length} مصدر
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                يمكنك كمسؤول إضافة مصادر ودوريات جديدة أو حذف مصادر موجودة، وسيتم الاستشهاد بها تلقائياً في نص ومراجع
                البحث وملف Word!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setShowAddSourceModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-md shadow-purple-600/20 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> إضافة مصدر جديد
            </button>
            <button
              type="button"
              onClick={handleResetSources}
              title="استعادة المصادر الافتراضية الأصلية"
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer border border-slate-700"
            >
              <RotateCcw className="w-3 h-3" /> استعادة الافتراضي
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {sources.map((source, index) => (
            <div
              key={source.id}
              className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-purple-500/40 hover:bg-slate-950/90 transition-all flex flex-col justify-between text-right space-y-2 group relative"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-black text-purple-400 group-hover:text-purple-300">#{index + 1}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] px-2 py-0.5 rounded-md bg-purple-950/50 text-purple-300 border border-purple-800/40 truncate max-w-[105px]">
                    {source.category}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteSource(source.id, source.name)}
                    title={`حذف مصدر "${source.name}"`}
                    className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200 group-hover:text-white leading-snug">
                  {source.name}
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{source.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Source Modal */}
      {showAddSourceModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">إضافة مصدر أو قاعدة بيانات بحثية</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSourceModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSource} className="space-y-3.5 text-right">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">اسم المصدر أو الدورية العلمية:</label>
                <input
                  type="text"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  placeholder="مثال: مجلة كلية الآداب - جامعة الإسكندرية"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">التصنيف أو التخصص:</label>
                <input
                  type="text"
                  value={newSourceCategory}
                  onChange={(e) => setNewSourceCategory(e.target.value)}
                  placeholder="مثال: دورية محكمة / مستودع جامعي"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">نبذة موجزة عن المصدر:</label>
                <textarea
                  rows={2}
                  value={newSourceDesc}
                  onChange={(e) => setNewSourceDesc(e.target.value)}
                  placeholder="مثال: مجلة علمية فصلية محكمة تنشر أحدث الأبحاث والدراسات في العلوم الإنسانية..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-purple-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  صيغة الاستشهاد المخصصة (اختياري):
                </label>
                <input
                  type="text"
                  value={newSourceCitation}
                  onChange={(e) => setNewSourceCitation(e.target.value)}
                  placeholder="مثال: القاهرة، دراسات محكمة 2024"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddSourceModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> حفظ وإدراج المصدر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
