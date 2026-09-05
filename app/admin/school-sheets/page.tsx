"use client";

import React, { useState, useRef } from "react";
import NextImage from "next/image";
import {
  GraduationCap,
  Upload,
  Sparkles,
  Shuffle,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  RefreshCw,
  FileText,
  HelpCircle,
} from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { readFileAsDataURL } from "@/lib/utils";
import { generateSchoolSheetsDocx, SchoolSheetConfig } from "@/lib/docx/school-sheets-docx";

export default function SchoolSheetsPage() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  // Extracted Vocabulary Words
  const [words, setWords] = useState<string[]>([]);
  const [newWordInput, setNewWordInput] = useState("");

  // Exam Configuration
  const [schoolName, setSchoolName] = useState("مدرسة النور الخاصة");
  const [grade, setGrade] = useState("الصف الرابع الابتدائي");
  const [subject, setSubject] = useState("اللغة العربية - معاني المفردات");
  const [instructions, setInstructions] = useState("اكتب معنى أو مرادف كل كلمة من الكلمات الآتية:");

  // Generated Models
  const [modelA, setModelA] = useState<string[]>([]);
  const [modelB, setModelB] = useState<string[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("صيغة غير مدعومة", "يرجى رفع صورة لصفحة المعاني أو المفردات من الكتاب");
      return;
    }

    try {
      const dataUrl = await readFileAsDataURL(file);
      setImagePreview(dataUrl);
    } catch {
      toast.error("خطأ", "تعذر قراءة ملف الصورة المحدد");
    }
  };

  const handleExtractWords = async () => {
    if (!imagePreview) {
      toast.warning("تنبيه", "يرجى اختيار صورة الدرس أو المفردات أولاً");
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("لا يوجد اتصال بالإنترنت", "يتطلب استخراج المفردات بالذكاء الاصطناعي اتصالاً بالإنترنت");
      return;
    }

    setIsExtracting(true);

    try {
      const res = await fetch("/api/school-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: imagePreview }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "فشل استخراج المفردات من الصفحة");
      }

      const data = await res.json();
      const extractedList: string[] = Array.isArray(data.words) ? data.words : [];

      if (extractedList.length === 0) {
        toast.warning("تنبيه", "لم يتم العثور على كلمات واضحة، يمكنك إضافة الكلمات يدوياً");
      } else {
        setWords(extractedList);
        // Auto randomize initial models
        randomizeModels(extractedList);
        toast.success("تم الاستخراج", `تم استخراج ${extractedList.length} كلمة بنجاح`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء الاتصال بالنظام الذكي";
      toast.error("خطأ في الاستخراج", msg);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAddWord = () => {
    const trimmed = newWordInput.trim();
    if (!trimmed) return;
    if (words.includes(trimmed)) {
      toast.warning("موجودة مسبقاً", "هذه الكلمة موجودة بالفعل في القائمة");
      return;
    }

    const updated = [...words, trimmed];
    setWords(updated);
    setNewWordInput("");
    if (hasGenerated) randomizeModels(updated);
    toast.success("تمت الإضافة", `تمت إضافة كلمة "${trimmed}"`);
  };

  const handleDeleteWord = (targetWord: string) => {
    const updated = words.filter((w) => w !== targetWord);
    setWords(updated);
    if (hasGenerated) randomizeModels(updated);
  };

  const handleCopyWord = async (word: string) => {
    try {
      await navigator.clipboard.writeText(word);
      toast.success("تم النسخ", `تم نسخ: ${word}`);
    } catch {
      toast.error("خطأ", "تعذر النسخ إلى الحافظة");
    }
  };

  const randomizeModels = (sourceWords: string[] = words) => {
    if (sourceWords.length === 0) {
      toast.warning("تنبيه", "لا توجد كلمات لتوليد النماذج منها");
      return;
    }

    // Shuffle helper
    const shuffleArray = (arr: string[]) => {
      const shuffled = [...arr];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    const shuffledA = shuffleArray(sourceWords);
    // Ensure Model B is distinctly shuffled
    let shuffledB = shuffleArray(sourceWords);
    if (sourceWords.length > 2 && JSON.stringify(shuffledA) === JSON.stringify(shuffledB)) {
      shuffledB = shuffledB.reverse();
    }

    setModelA(shuffledA);
    setModelB(shuffledB);
    setHasGenerated(true);
    toast.success("تم التوليد", "تم إنشاء نماذج الاختبار (نموذج أ ونموذج ب) بترتيب عشوائي");
  };

  const handleExportDocx = async () => {
    if (modelA.length === 0 || modelB.length === 0) {
      toast.warning("تنبيه", "يرجى توليد النماذج أولاً قبل التصدير");
      return;
    }

    try {
      const config: SchoolSheetConfig = {
        schoolName,
        grade,
        subject,
        instructions,
        modelAWords: modelA,
        modelBWords: modelB,
      };

      await generateSchoolSheetsDocx(config);
      toast.success("تم التصدير", "تم تنزيل نماذج Word (نموذج أ + نموذج ب) جاهزة للطباعة والتصوير");
    } catch {
      toast.error("خطأ", "تعذر إنشاء ملف Word، حاول مجدداً");
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">مولد شيتات المفردات المدرسية (School Sheets)</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            استخراج معاني الكلمات من صور كتب وملازم المدرسين وتوليد نموذجين امتحانيين (نموذج أ / نموذج ب) بترتيب عشوائي وتصدير Word فوري.
          </p>
        </div>

        {hasGenerated && (
          <button
            onClick={handleExportDocx}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition shadow-md"
          >
            <Download className="w-4 h-4" />
            تصدير النماذج Word (.docx)
          </button>
        )}
      </div>

      {/* Grid: 3 columns layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Column 1: Upload & Settings (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Upload card */}
          <div className="bg-card/70 backdrop-blur-md border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              صورة درس المفردات
            </h2>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {!imagePreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-primary/50 transition cursor-pointer rounded-xl p-6 flex flex-col items-center justify-center text-center gap-2 bg-muted/20 hover:bg-muted/40"
              >
                <Upload className="w-7 h-7 text-primary/80" />
                <p className="text-sm font-semibold text-foreground">رفع صفحة المفردات</p>
                <p className="text-xs text-muted-foreground">التقط صورة لصفحة الكلمة ومعناها</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative w-full h-44 rounded-xl overflow-hidden border border-border bg-black/5">
                  <NextImage src={imagePreview} alt="معاينة الصفحة" fill className="object-contain" />
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={isExtracting}
                    onClick={handleExtractWords}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition shadow disabled:opacity-50"
                  >
                    {isExtracting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        جاري الاستخراج...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        استخراج الكلمات ذكياً
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setImagePreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition"
                    title="حذف الصورة"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Exam Header Settings */}
          <div className="bg-card/70 backdrop-blur-md border border-border rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 pb-2 border-b border-border">
              <FileText className="w-4 h-4 text-primary" />
              بيانات ترويسة الاختبار
            </h3>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">اسم المدرسة أو الأستاذ:</label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">الصف الدراسي:</label>
              <input
                type="text"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">المادة / الموضوع:</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">صيغة السؤال:</label>
              <input
                type="text"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
              />
            </div>
          </div>
        </div>

        {/* Column 2: Words List & Chips (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-card/70 backdrop-blur-md border border-border rounded-2xl p-5 shadow-sm space-y-4 min-h-[500px] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h2 className="font-bold text-foreground">قائمة المفردات</h2>
                <p className="text-xs text-muted-foreground">
                  اضغط على أي كلمة لنسخها فوراً
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 bg-primary/10 text-primary font-bold rounded-lg">
                {words.length} كلمة
              </span>
            </div>

            {/* Add word manually */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newWordInput}
                onChange={(e) => setNewWordInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddWord()}
                placeholder="أضف كلمة جديدة..."
                className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                onClick={handleAddWord}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition text-sm font-semibold flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                إضافة
              </button>
            </div>

            {/* Chips Container */}
            <div className="flex-1 overflow-y-auto max-h-[360px] p-2 bg-muted/20 rounded-xl border border-border">
              {words.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                  <HelpCircle className="w-8 h-8 opacity-40 mb-2" />
                  <p className="text-sm">لا توجد كلمات حتى الآن</p>
                  <p className="text-xs mt-1">ارفع صورة الدرس لاستخراجها أو أضفها يدوياً</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {words.map((w, idx) => (
                    <div
                      key={idx}
                      className="group flex items-center gap-1.5 px-3 py-1.5 bg-background border border-border hover:border-primary/50 text-foreground text-sm rounded-xl shadow-xs transition"
                    >
                      <button
                        onClick={() => handleCopyWord(w)}
                        className="hover:text-primary transition font-medium"
                        title="اضغط للنسخ"
                      >
                        {w}
                      </button>
                      <button
                        onClick={() => handleDeleteWord(w)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition p-0.5"
                        title="حذف الكلمة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Randomize Action Button */}
            <button
              disabled={words.length === 0}
              onClick={() => randomizeModels()}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition shadow flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Shuffle className="w-4 h-4" />
              توليد / خلط نماذج (أ) و (ب)
            </button>
          </div>
        </div>

        {/* Column 3: Model A & Model B Preview (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-card/70 backdrop-blur-md border border-border rounded-2xl p-5 shadow-sm space-y-4 min-h-[500px] flex flex-col">
            <h2 className="font-bold text-foreground pb-2 border-b border-border flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              معاينة نماذج الاختبار
            </h2>

            {!hasGenerated ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                <Shuffle className="w-8 h-8 opacity-40 mb-2" />
                <p className="text-sm">اضغط &ldquo;توليد النماذج&rdquo; لمعاينة الترتيب العشوائي للنموذجين</p>
              </div>
            ) : (
              <div className="space-y-4 flex-1 overflow-y-auto max-h-[460px]">
                {/* Model A Preview */}
                <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-primary">نموذج (أ) - Model A</span>
                    <span className="text-xs text-muted-foreground">{modelA.length} أسئلة</span>
                  </div>
                  <ol className="list-decimal list-inside text-xs space-y-1.5 text-foreground/90 max-h-40 overflow-y-auto">
                    {modelA.map((word, i) => (
                      <li key={i} className="py-0.5 border-b border-border/30 last:border-0">
                        <span className="font-semibold">{word}</span>
                        <span className="text-muted-foreground mr-2">..............................</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Model B Preview */}
                <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-blue-600 dark:text-blue-400">نموذج (ب) - Model B</span>
                    <span className="text-xs text-muted-foreground">{modelB.length} أسئلة</span>
                  </div>
                  <ol className="list-decimal list-inside text-xs space-y-1.5 text-foreground/90 max-h-40 overflow-y-auto">
                    {modelB.map((word, i) => (
                      <li key={i} className="py-0.5 border-b border-border/30 last:border-0">
                        <span className="font-semibold">{word}</span>
                        <span className="text-muted-foreground mr-2">..............................</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
