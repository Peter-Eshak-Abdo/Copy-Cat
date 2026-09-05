"use client";

import React, { useState, useRef } from "react";
import NextImage from "next/image";
import {
  FileText,
  Upload,
  Sparkles,
  Copy,
  Download,
  CheckCircle2,
  RefreshCw,
  Clock,
} from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { readFileAsDataURL } from "@/lib/utils";
import { generateOcrDocx } from "@/lib/docx/ocr-docx";

type Step = "idle" | "stage1" | "stage2" | "completed";

export default function MultiStageOcrPage() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>("idle");
  const [isProcessing, setIsProcessing] = useState(false);

  const [rawText, setRawText] = useState<string>("");
  const [refinedText, setRefinedText] = useState<string>("");
  const [docTitle, setDocTitle] = useState<string>("مستند نصوص مستخرجة");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("صيغة غير مدعومة", "يرجى رفع صورة واضحة للمستند (JPG / PNG / WEBP)");
      return;
    }

    try {
      const dataUrl = await readFileAsDataURL(file);
      setSelectedFile(file);
      setImagePreview(dataUrl);
      setCurrentStep("idle");
      setRawText("");
      setRefinedText("");
    } catch {
      toast.error("خطأ", "تعذر قراءة ملف الصورة المحدد");
    }
  };

  const handleProcessOcr = async () => {
    if (!imagePreview) {
      toast.warning("تنبيه", "يرجى اختيار صورة أولاً");
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("لا يوجد اتصال بالإنترنت", "تحتاج ميزة التعرف الضوئي الذكي إلى اتصال بالإنترنت");
      return;
    }

    setIsProcessing(true);
    setCurrentStep("stage1");

    try {
      // Stage 1: Computer Vision Extraction
      const res1 = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extract",
          imageBase64: imagePreview,
        }),
      });

      if (!res1.ok) {
        const errData = await res1.json().catch(() => ({}));
        throw new Error(errData.error || "فشل استخراج النصوص في المرحلة الأولى");
      }

      const data1 = await res1.json();
      const extractedRaw = data1.text || "";
      setRawText(extractedRaw);

      if (!extractedRaw.trim()) {
        throw new Error("لم يتم العثور على نصوص واضحة في الصورة");
      }

      // Stage 2: Contextual Grammar & Arabic Refinement
      setCurrentStep("stage2");

      const res2 = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refine",
          rawText: extractedRaw,
        }),
      });

      if (!res2.ok) {
        // Fallback: Stage 2 failed, keep raw
        toast.warning("تنبيه التدقيق", "تعذر التدقيق اللغوي، سيتم استخدام النص الخام المستخرج");
        setRefinedText(extractedRaw);
      } else {
        const data2 = await res2.json();
        setRefinedText(data2.text || extractedRaw);
      }

      setCurrentStep("completed");
      toast.success("تم بنجاح", "تم استخراج النص وتدقيقه لغوياً بدقة عالية");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع أثناء معالجة المستند";
      toast.error("خطأ في المعالجة", msg);
      setCurrentStep("idle");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyText = async () => {
    const textToCopy = refinedText || rawText;
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success("تم النسخ", "تم نسخ النص إلى الحافظة بنجاح");
    } catch {
      toast.error("خطأ", "تعذر نسخ النص");
    }
  };

  const handleDownloadDocx = async () => {
    const textToExport = refinedText || rawText;
    if (!textToExport) return;

    try {
      await generateOcrDocx({
        title: docTitle || "مستند مستخرج",
        content: textToExport,
        fileName: `${docTitle || "ocr-document"}.docx`,
      });
      toast.success("تم التصدير", "تم تنزيل ملف Word بمسافات ضيقة وخط 18pt وإطار متقن");
    } catch {
      toast.error("خطأ في التصدير", "تعذر إنشاء ملف Word، حاول مجدداً");
    }
  };

  const displayText = refinedText || rawText;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">الماسح الضوئي الذكي (Multi-Stage OCR)</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            استخراج نصوص الأوراق والملازم العربية على مرحلتين: استخراج بصري دقيق يتبعه تدقيق نحوي وإملائي، ثم تصدير Word منسق جاهز للطباعة.
          </p>
        </div>

        {selectedFile && (
          <button
            onClick={() => {
              setSelectedFile(null);
              setImagePreview(null);
              setRawText("");
              setRefinedText("");
              setCurrentStep("idle");
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-xl transition"
          >
            <RefreshCw className="w-4 h-4" />
            صورة جديدة
          </button>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Image Upload & Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-card/70 backdrop-blur-md border border-border rounded-2xl p-5 shadow-sm">
            <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              صورة الورقة أو المستند
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
                className="border-2 border-dashed border-border hover:border-primary/50 transition cursor-pointer rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3 bg-muted/20 hover:bg-muted/40 min-h-[280px]"
              >
                <div className="p-4 bg-primary/10 text-primary rounded-full">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">اضغط أو اسحب صورة المستند هنا</p>
                  <p className="text-xs text-muted-foreground mt-1">يدعم صور الكاميرا والمستندات (JPG, PNG, WEBP)</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative w-full h-80 rounded-xl overflow-hidden border border-border bg-black/5">
                  <NextImage
                    src={imagePreview}
                    alt="معاينة المستند"
                    fill
                    className="object-contain"
                  />
                </div>

                <button
                  disabled={isProcessing}
                  onClick={handleProcessOcr}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition shadow-md disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      جاري المعالجة والتدقيق...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      بدء الاستخراج والتدقيق اللغوي
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Stepper Progress */}
          <div className="bg-card/70 backdrop-blur-md border border-border rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              مراحل المعالجة الذكية
            </h3>

            <div className="space-y-3 text-sm">
              {/* Step 1 */}
              <div
                className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                  currentStep === "stage1"
                    ? "bg-primary/10 border-primary text-primary font-medium"
                    : currentStep === "stage2" || currentStep === "completed"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted/30 border-transparent text-muted-foreground"
                }`}
              >
                {currentStep === "stage2" || currentStep === "completed" ? (
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                ) : currentStep === "stage1" ? (
                  <RefreshCw className="w-5 h-5 animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/40 flex items-center justify-center text-xs">
                    1
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-semibold">المرحلة الأولى: الاستخراج البصري (Vision OCR)</div>
                  <div className="text-xs opacity-80">استخراج الحروف والكلمات العربية بدقة بصرية متقدمة</div>
                </div>
              </div>

              {/* Step 2 */}
              <div
                className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                  currentStep === "stage2"
                    ? "bg-primary/10 border-primary text-primary font-medium"
                    : currentStep === "completed"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted/30 border-transparent text-muted-foreground"
                }`}
              >
                {currentStep === "completed" ? (
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                ) : currentStep === "stage2" ? (
                  <RefreshCw className="w-5 h-5 animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/40 flex items-center justify-center text-xs">
                    2
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-semibold">المرحلة الثانية: التدقيق السياقي والإملائي</div>
                  <div className="text-xs opacity-80">تصحيح الكلمات غير المكتملة وعلامات الترقيم وتنسيق الفقرات</div>
                </div>
              </div>

              {/* Step 3 */}
              <div
                className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                  currentStep === "completed"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold"
                    : "bg-muted/30 border-transparent text-muted-foreground"
                }`}
              >
                {currentStep === "completed" ? (
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/40 flex items-center justify-center text-xs">
                    3
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-semibold">المرحلة الثالثة: جاهز للنسخ والتصدير</div>
                  <div className="text-xs opacity-80">إنشاء ملف Word مقاس A4 بمسافات ضيقة وخط 18pt وإطار</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Extracted Text & Export Options */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-card/70 backdrop-blur-md border border-border rounded-2xl p-5 shadow-sm flex flex-col h-full min-h-[520px]">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-foreground">النص المستخرج والمدقق</h2>
                {refinedText && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium">
                    مدقق لغوياً
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={!displayText}
                  onClick={handleCopyText}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-muted hover:bg-muted/80 text-foreground transition disabled:opacity-40"
                  title="نسخ النص كاملاً"
                >
                  <Copy className="w-3.5 h-3.5" />
                  نسخ النص
                </button>

                <button
                  disabled={!displayText}
                  onClick={handleDownloadDocx}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm disabled:opacity-40"
                  title="تصدير ملف Word جاهز للطباعة"
                >
                  <Download className="w-3.5 h-3.5" />
                  تصدير Word (.docx)
                </button>
              </div>
            </div>

            {/* Document Title Input */}
            <div className="pt-3">
              <label className="text-xs text-muted-foreground mb-1 block">عنوان المستند لملف Word:</label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="أدخل عنواناً للمستند..."
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Text Editor / Preview */}
            <div className="flex-1 mt-4 relative flex flex-col">
              <textarea
                value={displayText}
                onChange={(e) => {
                  if (refinedText) setRefinedText(e.target.value);
                  else setRawText(e.target.value);
                }}
                placeholder={
                  isProcessing
                    ? "جاري تحليل النصوص، يرجى الانتظار ثوانٍ معدودة..."
                    : "سيظهر النص المستخرج هنا تلقائياً، ويمكنك تعديله مباشرة قبل التصدير..."
                }
                className="w-full flex-1 p-4 rounded-xl border border-border bg-background font-sans text-base leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                dir="rtl"
              />

              {/* Footer info */}
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground px-1">
                <span>
                  عدد الكلمات: {displayText.trim() ? displayText.trim().split(/\s+/).length : 0} | عدد الأحرف: {displayText.length}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  المسافات ضيقة (12.7mm) • خط 18pt • إطار صفحة
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
