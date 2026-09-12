"use client";

import React, { useState, useRef, useMemo } from "react";
import { useToast } from "@/components/toast-provider";
import { readFileAsDataURL } from "@/lib/utils";
import { generateOcrDocx } from "@/lib/docx/ocr-docx";

type OcrStage = "idle" | "vision" | "refinement" | "completed";

interface OcrPageItem {
  id: string;
  file: File;
  dataUrl: string;
  name: string;
  status: "pending" | "processing" | "done" | "error";
  extractedText?: string;
}

export default function MultiStageOcrPage() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pages, setPages] = useState<OcrPageItem[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [currentStage, setCurrentStage] = useState<OcrStage>("idle");
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoomPreview, setZoomPreview] = useState(false);

  const [rawText, setRawText] = useState<string>("");
  const [refinedText, setRefinedText] = useState<string>("");
  const [docTitle, setDocTitle] = useState<string>("مستند_نصوص_مستخرجة_مكتبة_كوبي_كات.docx");

  const activePage = pages[activePageIndex] || null;

  // Dynamic Word & Char counters
  const { wordCount, charCount } = useMemo(() => {
    const text = refinedText.trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const chars = text.length;
    return { wordCount: words, charCount: chars };
  }, [refinedText]);

  // Add files to pages list
  const addFilesToPages = async (fileList: File[]) => {
    const newItems: OcrPageItem[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.type.startsWith("image/")) continue;
      try {
        const dataUrl = await readFileAsDataURL(file);
        newItems.push({
          id: Math.random().toString(36).substring(2, 9),
          file,
          dataUrl,
          name: file.name,
          status: "pending",
        });
      } catch {
        // skip corrupted file
      }
    }

    if (newItems.length === 0) {
      toast.warning("تنبيه", "يرجى اختيار صور صالحة للمستندات (JPG / PNG / WEBP)");
      return;
    }

    setPages((prev) => {
      const updated = [...prev, ...newItems];
      if (prev.length === 0 && updated.length > 0) {
        const cleanName = updated[0].file.name.replace(/\.[^/.]+$/, "");
        setDocTitle(`مستند_مستخرج_${cleanName}.docx`);
      }
      return updated;
    });

    toast.success(
      "تمت إضافة الصفحات",
      `تمت إضافة ${newItems.length} صورة. يمكنك إعادة ترتيبها بالأسهم قبل بدء الاستخراج.`
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await addFilesToPages(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      await addFilesToPages(Array.from(e.dataTransfer.files));
    }
  };

  // Re-ordering pages
  const movePageUp = (index: number) => {
    if (index <= 0) return;
    setPages((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
    if (activePageIndex === index) {
      setActivePageIndex(index - 1);
    } else if (activePageIndex === index - 1) {
      setActivePageIndex(index);
    }
  };

  const movePageDown = (index: number) => {
    if (index >= pages.length - 1) return;
    setPages((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
    if (activePageIndex === index) {
      setActivePageIndex(index + 1);
    } else if (activePageIndex === index + 1) {
      setActivePageIndex(index);
    }
  };

  const removePage = (index: number) => {
    setPages((prev) => prev.filter((_, i) => i !== index));
    if (activePageIndex >= pages.length - 1 && activePageIndex > 0) {
      setActivePageIndex(activePageIndex - 1);
    }
  };

  // Multi-page sequential extraction
  const handleProcessOcr = async () => {
    if (pages.length === 0) {
      if (fileInputRef.current) fileInputRef.current.click();
      toast.warning("يرجى اختيار صور", "قم برفع صفحة واحدة أو أكثر من المستند أولاً");
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("لا يوجد اتصال بالإنترنت", "تحتاج ميزة التعرف الضوئي الذكي إلى اتصال بالإنترنت");
      return;
    }

    setIsProcessing(true);
    setCurrentStage("vision");
    setRawText("");
    setRefinedText("");

    let combinedRaw = "";

    try {
      for (let i = 0; i < pages.length; i++) {
        setActivePageIndex(i);
        setPages((prev) =>
          prev.map((p, idx) => (idx === i ? { ...p, status: "processing" } : p))
        );

        toast.info("جاري المعالجة", `جاري استخراج نصوص الصفحة (${i + 1} من ${pages.length})...`);

        const res = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "extract",
            imageBase64: pages[i].dataUrl,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `فشل استخراج نصوص الصفحة رقم ${i + 1}`);
        }

        const data = await res.json();
        const pageExtracted = data.extractedText || "";

        setPages((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, status: "done", extractedText: pageExtracted } : p
          )
        );

        if (pages.length > 1) {
          combinedRaw += `\n\n════════════════════════════════════════\n📄 الصفحة رقم (${i + 1}):\n════════════════════════════════════════\n\n${pageExtracted}`;
        } else {
          combinedRaw += pageExtracted;
        }

        setRawText(combinedRaw);
        setRefinedText(combinedRaw);
      }

      // Stage 2: Linguistic refinement
      setCurrentStage("refinement");
      toast.info("جاري التدقيق اللغوي", "جاري مراجعة وتنسيق الألفاظ وصياغة البنود...");

      const res2 = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refine",
          textToRefine: combinedRaw,
        }),
      });

      if (res2.ok) {
        const data2 = await res2.json();
        const refined = data2.refinedText || combinedRaw;
        setRefinedText(refined);
      }

      setCurrentStage("completed");
      toast.success(
        "اكتمل الاستخراج بنجاح",
        `تم استخراج وتدقيق نصوص ${pages.length} صفحة بنجاح وجاهزة للتصدير للوورد.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء معالجة الصفحات";
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

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  return (
    <div className="flex flex-col w-full" dir="rtl">
      {/* Hidden File Input (Multiple Supported) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex flex-col gap-space-lg w-full max-w-7xl mx-auto pb-space-3xl pt-space-sm">
        {/* Top Header Banner */}
        <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-space-lg shadow-xl border border-surface-container-high/40">
          <div className="absolute -right-24 -top-24 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
            <div className="flex items-start gap-space-md">
              <div className="p-space-sm rounded-xl bg-surface-container-high text-primary flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-3xl">document_scanner</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-space-xs">
                  <span className="font-headline-md text-headline-md text-on-surface">
                    الماسح الضوئي الذكي للمستندات والعقود
                  </span>
                  <span className="font-label-tag text-label-tag px-space-xs py-space-2xs rounded bg-primary/15 text-primary">
                    خط اليد والمطبوع
                  </span>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant mt-space-2xs max-w-3xl">
                  استخراج نصوص العقود، وعقود الإيجار والزواج، وإيصالات الأمانة، والمذكرات الدراسية المكتوبة بخط اليد مع الحفاظ على الترتيب، وتصديرها في مستند Word منسق جاهز للطباعة فوراً.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-space-sm self-stretch md:self-auto">
              <button
                onClick={handleUploadClick}
                className="flex items-center justify-center gap-space-xs px-space-md py-space-xs rounded-xl bg-primary hover:bg-primary/90 text-on-primary transition-all shadow-md active:scale-95 cursor-pointer font-bold text-sm"
                type="button"
              >
                <span className="material-symbols-outlined text-xl">add_photo_alternate</span>
                <span>+ إضافة صفحات / صور</span>
              </button>
            </div>
          </div>
        </div>

        {/* Core Workbench */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          {/* Left Column: Source Pages & Active Preview */}
          <div className="lg:col-span-5 flex flex-col gap-space-lg">
            {/* Pages Strip & Reordering */}
            <div className="flex flex-col rounded-xl bg-surface-container-low p-space-md shadow-lg border border-surface-container-high/40">
              <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high/60 mb-space-sm">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary text-xl">layers</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    صفحات المستند ({pages.length})
                  </span>
                </div>
                <span className="text-xs text-on-surface-variant">
                  يمكنك إعادة ترتيب الصفحات قبل البدء
                </span>
              </div>

              {pages.length > 0 ? (
                <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
                  {pages.map((page, idx) => (
                    <div
                      key={page.id}
                      onClick={() => setActivePageIndex(idx)}
                      className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                        activePageIndex === idx
                          ? "bg-primary/10 border-primary shadow-sm"
                          : "bg-surface-container border-surface-container-high hover:border-outline"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Thumbnail */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={page.dataUrl}
                          alt={page.name}
                          className="w-10 h-10 object-cover rounded-lg border border-surface-container-highest"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-on-surface">
                            صفحة ({idx + 1}): {page.name.slice(0, 22)}
                          </span>
                          <span className="text-[11px] text-on-surface-variant">
                            {page.status === "processing"
                              ? "⏳ جاري الاستخراج..."
                              : page.status === "done"
                              ? "✅ تم الاستخراج"
                              : "جاهز"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => movePageUp(idx)}
                          className="p-1 rounded hover:bg-surface-bright text-on-surface-variant disabled:opacity-30 cursor-pointer"
                          title="تحريك لأعلى"
                        >
                          <span className="material-symbols-outlined text-base">arrow_upward</span>
                        </button>
                        <button
                          type="button"
                          disabled={idx === pages.length - 1}
                          onClick={() => movePageDown(idx)}
                          className="p-1 rounded hover:bg-surface-bright text-on-surface-variant disabled:opacity-30 cursor-pointer"
                          title="تحريك لأسفل"
                        >
                          <span className="material-symbols-outlined text-base">arrow_downward</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removePage(idx)}
                          className="p-1 rounded hover:bg-error/20 text-error cursor-pointer"
                          title="حذف هذه الصفحة"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  onClick={handleUploadClick}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="p-6 text-center border-2 border-dashed border-primary/40 rounded-xl cursor-pointer hover:border-primary transition"
                >
                  <span className="material-symbols-outlined text-4xl text-primary mb-2">upload_file</span>
                  <p className="text-sm font-bold text-on-surface">اسحب وأفلت صور الصفحات هنا</p>
                  <p className="text-xs text-on-surface-variant mt-1">أو اضغط لاختيار صورة أو أكثر من جهازك</p>
                </div>
              )}
            </div>

            {/* Active Image Large Preview Card */}
            {activePage && (
              <div className="flex flex-col rounded-xl bg-surface-container-low p-space-md shadow-lg border border-surface-container-high/40">
                <div className="flex items-center justify-between pb-space-sm">
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-primary text-xl">visibility</span>
                    <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      معاينة: صفحة ({activePageIndex + 1})
                    </span>
                  </div>
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

                <div className="relative rounded-lg bg-surface-container-lowest overflow-hidden flex items-center justify-center p-space-xs">
                  <div className={`relative w-full overflow-hidden rounded bg-surface-dim flex items-center justify-center ${zoomPreview ? "max-h-[600px]" : "max-h-[380px]"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="w-full h-auto object-contain max-h-[360px] rounded"
                      src={activePage.dataUrl}
                      alt={activePage.name}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Action Start Button */}
            <button
              onClick={handleProcessOcr}
              disabled={isProcessing || pages.length === 0}
              className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">
                {isProcessing ? "sync" : "auto_read_play"}
              </span>
              <span>
                {isProcessing
                  ? `جاري استخراج صفحة (${activePageIndex + 1} من ${pages.length})...`
                  : pages.length > 1
                  ? `بدء الاستخراج والتدقيق لـ (${pages.length} صفحات)`
                  : "بدء الاستخراج والتدقيق اللغوي"}
              </span>
            </button>
          </div>

          {/* Right Column: Extracted Document & Export */}
          <div className="lg:col-span-7 flex flex-col gap-space-lg">
            <div className="flex flex-col rounded-xl bg-surface-container-low p-space-md shadow-lg border border-surface-container-high/40">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-space-sm border-b border-surface-container-high/60 mb-space-md">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary text-xl">description</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    النص المستخرج والمدقق
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-lg">
                    {wordCount} كلمة | {charCount} حرف
                  </span>
                  <button
                    onClick={handleCopyText}
                    className="flex items-center gap-1 py-1.5 px-3 rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface text-xs font-semibold transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">content_copy</span>
                    <span>نسخ</span>
                  </button>
                  <button
                    onClick={handleExportWord}
                    disabled={!refinedText.trim()}
                    className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-linear-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow"
                  >
                    <span className="material-symbols-outlined text-base">download</span>
                    <span>تصدير Word (.docx)</span>
                  </button>
                </div>
              </div>

              {/* Document Title Input */}
              <div className="mb-3">
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full bg-surface-container border border-surface-container-high rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                  placeholder="اسم ملف الوورد الناتج"
                />
              </div>

              {/* Text Area / Editor */}
              <textarea
                value={refinedText}
                onChange={(e) => setRefinedText(e.target.value)}
                placeholder="سيظهر هنا النص المستخرج من الصفحات بترتيبها بعد انتهاء القراءة والتدقيق..."
                rows={18}
                className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl p-4 text-sm text-on-surface leading-relaxed font-sans focus:outline-none focus:border-primary resize-y"
              />
            </div>
          </div>
        </div>

        {/* Clean, Honest Status Footer */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high/40 text-xs text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-bold text-on-surface">الماسح الضوئي جاهز</span>
            <span>— معالجة فائقة الدقة للوثائق الرسمية والمخطوطات</span>
          </div>
          <span>مطبعة وخدمات كوبي كات</span>
        </div>
      </div>
    </div>
  );
}
