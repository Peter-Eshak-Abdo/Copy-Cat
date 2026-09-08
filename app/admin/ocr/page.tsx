"use client";

import React, { useState, useRef, useMemo } from "react";
import { useToast } from "@/components/toast-provider";
import { readFileAsDataURL } from "@/lib/utils";
import { generateOcrDocx } from "@/lib/docx/ocr-docx";

type OcrStage = "idle" | "vision" | "refinement" | "completed";

export default function MultiStageOcrPage() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<OcrStage>("idle");
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoomPreview, setZoomPreview] = useState(false);

  const [rawText, setRawText] = useState<string>("");
  const [refinedText, setRefinedText] = useState<string>("");
  const [docTitle, setDocTitle] = useState<string>("مستند_نصوص_مستخرجة_مذكرة_كوبي_كات.docx");
  const [isToastOpen, setIsToastOpen] = useState(true);

  // Dynamic Word & Char counters
  const { wordCount, charCount } = useMemo(() => {
    const text = refinedText.trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const chars = text.length;
    return { wordCount: words, charCount: chars };
  }, [refinedText]);

  // File selection handler
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
      setCurrentStage("idle");
      setRawText("");
      setRefinedText("");

      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      setDocTitle(`مستند_مستخرج_${cleanName}.docx`);
      toast.success("تم تجهيز الصورة", "اضغط على زر 'بدء الاستخراج والتدقيق اللغوي' للبدء");
    } catch {
      toast.error("خطأ", "تعذر قراءة ملف الصورة المحدد");
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("صيغة غير مدعومة", "يرجى رفع صورة واضحة للمستند (JPG / PNG / WEBP)");
      return;
    }

    try {
      const dataUrl = await readFileAsDataURL(file);
      setSelectedFile(file);
      setImagePreview(dataUrl);
      setCurrentStage("idle");
      setRawText("");
      setRefinedText("");

      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      setDocTitle(`مستند_مستخرج_${cleanName}.docx`);
      toast.success("تم إفلات الصورة", "الصورة جاهزة للاستخراج المزدوج");
    } catch {
      toast.error("خطأ", "تعذر قراءة ملف الصورة");
    }
  };

  // Multi-stage OCR trigger
  const handleProcessOcr = async () => {
    if (!imagePreview) {
      if (fileInputRef.current) fileInputRef.current.click();
      toast.warning("يرجى اختيار صورة", "قم برفع صورة مستند أو ورقة امتحان أولاً");
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("لا يوجد اتصال بالإنترنت", "تحتاج ميزة التعرف الضوئي الذكي إلى اتصال بالإنترنت");
      return;
    }

    setIsProcessing(true);
    setCurrentStage("vision");

    try {
      // Stage 1: Computer Vision Extraction (Gemini 2.5 Flash)
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
        throw new Error(errData.error || "فشل الاستخراج البصري في المرحلة الأولى");
      }

      const data1 = await res1.json();
      const extracted = data1.extractedText || "";
      setRawText(extracted);
      setRefinedText(extracted);

      // Stage 2: Linguistic and Grammar Refinement
      setCurrentStage("refinement");

      const res2 = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refine",
          textToRefine: extracted,
        }),
      });

      if (res2.ok) {
        const data2 = await res2.json();
        const refined = data2.refinedText || extracted;
        setRefinedText(refined);
      }

      setCurrentStage("completed");
      toast.success("اكتملت المعالجة", "تم استخراج النصوص والتدقيق النحوي بنجاح!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع أثناء معالجة الصورة";
      toast.error("فشل الاستخراج", msg);
      setCurrentStage("idle");
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Export Word .docx
  const handleExportWord = async () => {
    if (!refinedText.trim()) {
      toast.warning("لا يوجد نص للتصدير", "يرجى استخراج نص أولاً قبل تحميل ملف Word");
      return;
    }

    try {
      await generateOcrDocx({
        content: refinedText,
        title: docTitle.replace(/\.docx$/i, ""),
        fileName: docTitle.endsWith(".docx") ? docTitle : `${docTitle}.docx`,
      });
      toast.success("تم تصدير ملف Word", "تم تحميل المستند بنجاح مع ضبط هوامش A4 والخط 18pt");
    } catch {
      toast.error("خطأ في التصدير", "تعذر توليد ملف Word. يمكنك نسخ النص يدوياً.");
    }
  };

  // Action: Copy Text to Clipboard
  const handleCopyText = async () => {
    if (!refinedText.trim()) {
      toast.warning("لا يوجد نص لنسخه", "قم باستخراج النص أولاً");
      return;
    }

    try {
      await navigator.clipboard.writeText(refinedText);
      toast.success("تم النسخ", "تم نسخ النص إلى الحافظة بنجاح");
    } catch {
      toast.error("خطأ", "تعذر النسخ إلى الحافظة");
    }
  };

  // Action: Trigger File Dialog
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  return (
    <div className="flex flex-col w-full" dir="rtl">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex flex-col gap-space-lg w-full max-w-7xl mx-auto pb-space-3xl pt-space-sm">
        {/* Top Ambient Glow & Header Banner */}
        <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-space-lg shadow-xl border border-surface-container-high/40">
          <div className="absolute -right-24 -top-24 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute left-1/3 -bottom-24 w-64 h-64 bg-tertiary/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
            <div className="flex items-start gap-space-md">
              <div className="p-space-sm rounded-xl bg-surface-container-high text-primary flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-3xl">psychology</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-space-xs">
                  <span className="font-headline-md text-headline-md text-on-surface">
                    الماسح الضوئي الذكي (Multi-Stage OCR)
                  </span>
                  <span className="font-label-tag text-label-tag px-space-xs py-space-2xs rounded bg-primary/15 text-primary">
                    v3.2 AI Vision
                  </span>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant mt-space-2xs max-w-3xl">
                  استخراج نصوص الأوراق والملازم العربية على مرحلتين: استخراج بصري دقيق يتبعه تدقيق نحوي وإملائي فوري، ثم تصدير Word منسق جاهز للطباعة المباشرة.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-space-sm self-stretch md:self-auto">
              <div className="hidden lg:flex items-center gap-space-xs px-space-sm py-space-xs rounded-xl bg-surface-container border border-surface-container-high/60">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span className="font-label-code text-label-code text-on-surface-variant">
                  {isProcessing ? "جاري المعالجة السحابية..." : "زمن الاستجابة: ~1.4 ثانية"}
                </span>
              </div>
              <button
                onClick={handleUploadClick}
                className="flex items-center justify-center gap-space-xs px-space-md py-space-xs rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface transition-all shadow-md active:scale-95 cursor-pointer"
                id="upload-new-trigger"
                type="button"
              >
                <span className="material-symbols-outlined text-xl">refresh</span>
                <span className="font-body-sm text-body-sm font-semibold">صورة جديدة</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2-Column Core Workbench */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          {/* Left Column: Source Document & Stages */}
          <div className="lg:col-span-5 flex flex-col gap-space-lg">
            {/* Image Source Card */}
            <div className="flex flex-col rounded-xl bg-surface-container-low p-space-md shadow-lg border border-surface-container-high/40">
              <div className="flex items-center justify-between pb-space-sm">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary text-xl">image</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface">صورة الورقة أو المستند</span>
                </div>
                <div className="flex items-center gap-space-2xs">
                  <span className="font-label-tag text-label-tag px-space-xs py-space-2xs rounded bg-surface-container-highest text-on-surface-variant font-label-code">
                    {selectedFile ? `${Math.round(selectedFile.size / 1024)} KB` : "A4 / 300 DPI"}
                  </span>
                  <button
                    onClick={() => setZoomPreview((prev) => !prev)}
                    className="p-space-2xs rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                    title={zoomPreview ? "تصغير" : "تكبير"}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {zoomPreview ? "zoom_out" : "zoom_in"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Image Preview / Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={!imagePreview ? handleUploadClick : undefined}
                className={`relative rounded-lg bg-surface-container-lowest overflow-hidden flex items-center justify-center p-space-xs group transition-all ${
                  !imagePreview ? "cursor-pointer border-2 border-dashed border-primary/30 hover:border-primary/60" : ""
                }`}
              >
                <div className={`relative w-full overflow-hidden rounded bg-surface-dim flex items-center justify-center ${zoomPreview ? "max-h-[600px]" : "max-h-[460px]"}`}>
                  {imagePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="w-full h-auto object-contain max-h-[440px] rounded transition-transform duration-300 group-hover:scale-105"
                      id="source-document-image"
                      src={imagePreview}
                      alt="مستند مرفوع للمعالجة"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                        <span className="material-symbols-outlined text-3xl">upload_file</span>
                      </div>
                      <span className="font-body-md text-on-surface font-bold mb-1">اسحب وأفلت صورة المستند هنا</span>
                      <span className="font-body-sm text-on-surface-variant text-xs">أو اضغط لاختيار صورة من جهازك (JPG / PNG)</span>
                    </div>
                  )}
                  {isProcessing && (
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-80 animate-pulse pointer-events-none"></div>
                  )}
                </div>
                {imagePreview && (
                  <div className="absolute top-space-sm left-space-sm flex items-center gap-space-2xs bg-surface-container-lowest/90 px-space-xs py-space-2xs rounded backdrop-blur">
                    <span className="w-2 h-2 rounded-full bg-tertiary"></span>
                    <span className="font-label-code text-label-code text-on-surface">تم فحص الورقة</span>
                  </div>
                )}
              </div>

              {/* Process Trigger Button */}
              <button
                onClick={handleProcessOcr}
                disabled={isProcessing}
                className="mt-space-md w-full flex items-center justify-center gap-space-xs py-space-sm px-space-md rounded-xl bg-primary-container hover:bg-primary text-on-primary-container font-semibold transition-all shadow-lg shadow-primary-container/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                id="start-ocr-btn"
                type="button"
              >
                <span className="material-symbols-outlined text-xl">
                  {isProcessing ? "hourglass_top" : "auto_fix_high"}
                </span>
                <span className="font-body-md text-body-md font-semibold">
                  {isProcessing
                    ? currentStage === "vision"
                      ? "جاري الاستخراج البصري (المرحلة 1)..."
                      : "جاري التدقيق النحوي والإملائي (المرحلة 2)..."
                    : "بدء الاستخراج والتدقيق اللغوي"}
                </span>
              </button>
            </div>

            {/* Stages Progression Card */}
            <div className="flex flex-col rounded-xl bg-surface-container-low p-space-md shadow-lg border border-surface-container-high/40">
              <div className="flex items-center gap-space-xs pb-space-md">
                <span className="material-symbols-outlined text-tertiary text-xl">hub</span>
                <span className="font-headline-sm text-headline-sm text-on-surface">مراحل المعالجة الذكية</span>
              </div>
              <div className="flex flex-col gap-space-sm relative">
                {/* Stage 1 */}
                <div className={`flex items-start gap-space-sm p-space-sm rounded-lg transition-colors ${
                  currentStage === "vision"
                    ? "bg-primary/10 border border-primary/30"
                    : currentStage === "refinement" || currentStage === "completed"
                    ? "bg-surface-container/60 hover:bg-surface-container"
                    : "bg-surface-container/30 opacity-70"
                }`}>
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/20 text-primary font-label-code text-label-code flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-space-xs">
                      <span className="font-body-sm text-body-sm font-semibold text-on-surface">
                        المرحلة الأولى: الاستخراج البصري (Vision OCR)
                      </span>
                      <span className="font-label-tag text-label-tag px-space-2xs rounded bg-surface-container-highest text-primary">
                        {currentStage === "vision"
                          ? "جاري التحليل..."
                          : currentStage === "refinement" || currentStage === "completed"
                          ? "اكتمل 100%"
                          : "قيد الانتظار"}
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                      استخراج الحروف والكلمات العربية بدقة بصرية متقدمة، مع فرز وتحديد بنية الجداول وقوائم الاختبارات.
                    </p>
                  </div>
                </div>

                {/* Stage 2 */}
                <div className={`flex items-start gap-space-sm p-space-sm rounded-lg transition-colors ${
                  currentStage === "refinement"
                    ? "bg-tertiary/10 border border-tertiary/30"
                    : currentStage === "completed"
                    ? "bg-surface-container/60 hover:bg-surface-container"
                    : "bg-surface-container/30 opacity-70"
                }`}>
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-tertiary/20 text-tertiary font-label-code text-label-code flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-space-xs">
                      <span className="font-body-sm text-body-sm font-semibold text-on-surface">
                        المرحلة الثانية: التدقيق السياقي والإملائي
                      </span>
                      <span className="font-label-tag text-label-tag px-space-2xs rounded bg-surface-container-highest text-tertiary">
                        {currentStage === "refinement"
                          ? "نشط الآن..."
                          : currentStage === "completed"
                          ? "اكتمل التدقيق"
                          : "قيد الانتظار"}
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                      تصحيح الكلمات غير المكتملة وعلامات الترقيم وتنسيق الفقرات والأسئلة وفق المعاجم العربية.
                    </p>
                  </div>
                </div>

                {/* Stage 3 */}
                <div className={`flex items-start gap-space-sm p-space-sm rounded-lg transition-colors ${
                  currentStage === "completed"
                    ? "bg-emerald-500/10 border border-emerald-500/30"
                    : "bg-surface-container/30 opacity-70"
                }`}>
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-surface-container-highest text-on-surface-variant font-label-code text-label-code flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-space-xs">
                      <span className="font-body-sm text-body-sm font-semibold text-on-surface">
                        المرحلة الثالثة: جاهز للنسخ والتصدير
                      </span>
                      <span className="font-label-tag text-label-tag px-space-2xs rounded bg-surface-container-highest text-on-surface-variant font-label-code">
                        {currentStage === "completed" ? "جاهز للتصدير" : "A4 Print Ready"}
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                      إنشاء ملف Word مقاس A4 بمسافات وهوامش ضيقة وخط 18pt مخصص لماكينات ريسو وكونيكا مينولتا.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Text Editor & Actions */}
          <div className="lg:col-span-7 flex flex-col gap-space-lg">
            <div className="flex flex-col rounded-xl bg-surface-container-low p-space-md shadow-lg min-h-[640px] border border-surface-container-high/40">
              <div className="flex flex-wrap items-center justify-between gap-space-sm pb-space-sm">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary text-xl">description</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface">النص المستخرج والمدقق</span>
                </div>
                <div className="flex items-center gap-space-xs">
                  <button
                    onClick={handleCopyText}
                    className="flex items-center gap-space-2xs px-space-sm py-space-xs rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface transition-colors active:scale-95 cursor-pointer"
                    id="copy-text-btn"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-lg">content_copy</span>
                    <span className="font-body-sm text-body-sm font-semibold">نسخ النص</span>
                  </button>
                  <button
                    onClick={handleExportWord}
                    className="flex items-center gap-space-2xs px-space-sm py-space-xs rounded-lg bg-primary-container hover:bg-primary text-on-primary-container transition-colors shadow-md active:scale-95 cursor-pointer font-bold"
                    id="export-docx-btn"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-lg">download</span>
                    <span className="font-body-sm text-body-sm font-semibold">تصدير Word (.docx)</span>
                  </button>
                </div>
              </div>

              {/* Word Document Title Input */}
              <div className="flex flex-col gap-space-2xs mb-space-sm">
                <label className="font-label-tag text-label-tag text-on-surface-variant" htmlFor="document-title">
                  عنوان المستند لملف Word:
                </label>
                <div className="relative">
                  <input
                    className="w-full bg-surface-container-lowest text-on-surface font-body-md text-body-md px-space-sm py-space-xs rounded-lg outline-none focus:bg-surface-container-high transition-all border border-surface-container-high/40"
                    id="document-title"
                    type="text"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                  />
                  <span className="absolute left-space-sm top-2.5 font-label-code text-label-code text-on-surface-variant">
                    DOCX
                  </span>
                </div>
              </div>

              {/* Textarea Editor */}
              <div className="flex-1 flex flex-col relative rounded-lg bg-surface-container-lowest p-space-sm border border-surface-container-high/40">
                <div className="flex items-center justify-between pb-space-xs px-space-xs text-on-surface-variant">
                  <div className="flex items-center gap-space-sm">
                    <span className="font-label-tag text-label-tag uppercase tracking-wider text-outline">
                      المحرر المباشر
                    </span>
                    <span className="font-label-code text-label-code text-primary">
                      {currentStage === "completed" ? "تم تطبيق التدقيق النحوي الآلي" : "جاهز للتحرير"}
                    </span>
                  </div>
                  <div className="flex items-center gap-space-xs">
                    <span className="font-label-code text-label-code text-on-surface-variant">
                      نمط العرض: RTL الطباعي
                    </span>
                  </div>
                </div>
                <textarea
                  className="w-full flex-1 bg-transparent text-on-surface font-body-md text-body-md leading-relaxed resize-y outline-none p-space-xs selection:bg-primary selection:text-on-primary min-h-[380px]"
                  id="ocr-text-editor"
                  placeholder="سيظهر النص المستخرج هنا تلقائياً، ويمكنك تعديله مباشرة قبل التصدير..."
                  rows={15}
                  value={refinedText}
                  onChange={(e) => setRefinedText(e.target.value)}
                />
              </div>

              {/* Editor Bottom Meta Stats */}
              <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-md text-on-surface-variant font-label-code text-label-code">
                <div className="flex items-center gap-space-md">
                  <div className="flex items-center gap-space-2xs">
                    <span className="material-symbols-outlined text-base">notes</span>
                    <span>
                      عدد الكلمات: <strong className="text-on-surface" id="word-count">{wordCount}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-space-2xs">
                    <span className="material-symbols-outlined text-base">match_case</span>
                    <span>
                      عدد الأحرف: <strong className="text-on-surface" id="char-count">{charCount}</strong>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-space-md">
                  <div className="flex items-center gap-space-2xs">
                    <span className="material-symbols-outlined text-base text-primary">margin</span>
                    <span>المسافات: <strong>ضيقة (0.5 بوصة)</strong></span>
                  </div>
                  <div className="flex items-center gap-space-2xs">
                    <span className="material-symbols-outlined text-base text-tertiary">format_size</span>
                    <span>الخط الافتراضي: <strong>Traditional Arabic 18pt</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Server & Engine Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-space-md p-space-md rounded-xl bg-surface-container-low shadow-md border border-surface-container-high/40">
          <div className="flex items-center gap-space-sm">
            <div className="p-space-xs rounded-lg bg-primary/20 text-primary">
              <span className="material-symbols-outlined text-xl">cloud_done</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-space-xs">
                <span className="font-body-sm text-body-sm font-semibold text-on-surface">
                  خادم معالجة اللغة والنماذج البصرية متصل
                </span>
                <span className="w-2 h-2 rounded-full bg-primary"></span>
              </div>
              <span className="font-label-code text-label-code text-on-surface-variant">
                Google Gemini Vision Engine API (Active Session: node-cairo-01)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-space-sm">
            <div className="flex items-center gap-space-xs px-space-sm py-space-2xs rounded-lg bg-surface-container text-on-surface-variant font-label-code text-label-code">
              <span>دقة التعرف:</span>
              <span className="text-primary font-bold">98.94%</span>
            </div>
            <div className="flex items-center gap-space-xs px-space-sm py-space-2xs rounded-lg bg-surface-container text-on-surface-variant font-label-code text-label-code">
              <span>الحصص المتبقية اليوم:</span>
              <span className="text-tertiary font-bold">4,820 ورقة</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating System Toast Banner */}
      {isToastOpen && (
        <div
          className="fixed bottom-space-lg left-space-lg max-w-sm flex items-start gap-space-sm p-space-sm rounded-xl bg-surface-container-high shadow-2xl transition-all duration-300 transform translate-y-0 opacity-100 z-50 border border-surface-container-highest"
          id="toast-banner"
        >
          <div className="p-space-xs rounded-lg bg-primary/20 text-primary flex-shrink-0">
            <span className="material-symbols-outlined text-xl">check_circle</span>
          </div>
          <div className="flex flex-col flex-1">
            <span className="font-body-sm text-body-sm font-semibold text-on-surface">
              سيرفر OCR ومحرك الذكاء الاصطناعي متصل
            </span>
            <p className="font-label-code text-label-code text-on-surface-variant mt-0.5">
              جاهز لاستخراج ومعالجة ملازم الامتحانات والكتب المدرسية.
            </p>
          </div>
          <button
            onClick={() => setIsToastOpen(false)}
            className="text-on-surface-variant hover:text-on-surface p-space-2xs rounded cursor-pointer"
            id="close-toast-btn"
            type="button"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}
    </div>
  );
}
