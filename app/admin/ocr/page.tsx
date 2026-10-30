"use client";

import React, { useState, useRef, useMemo } from "react";
import { useToast } from "@/components/toast-provider";
import { readFileAsDataURL } from "@/lib/utils";
import { generateOcrDocx, PageBorderKind } from "@/lib/docx/ocr-docx";
import {
  Layers,
  ImagePlus,
  ArrowUp,
  ArrowDown,
  Trash2,
  UploadCloud,
  Eye,
  ZoomIn,
  ZoomOut,
  Loader2,
  Sparkles,
  FileText,
  Copy,
  Download,
} from "lucide-react";


// Strips inline markup for the on-screen preview and lays out " || " trailing labels at the far edge
function previewLine(text: string): React.ReactNode {
  const clean = text.replace(/<\/?u>/gi, "").replace(/\*\*/g, "");
  const parts = clean.split(/\s*\|\|\s*/);
  if (parts.length < 2) return clean;
  return (
    <span className="flex justify-between gap-4">
      <span>{parts.slice(0, -1).join(" ")}</span>
      <span className="shrink-0">{parts[parts.length - 1]}</span>
    </span>
  );
}

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoomPreview, setZoomPreview] = useState(false);

  const [refinedText, setRefinedText] = useState<string>("");
  const [docTitle, setDocTitle] = useState<string>("مستند_نصوص_مستخرجة_مكتبة_كوبي_كات.docx");
  const [viewMode, setViewMode] = useState<"visual" | "raw">("visual");

  // Requirement #4: Font detection, Arial fallback, and Language / Direction Settings
  const [selectedFont, setSelectedFont] = useState<string>("Arial");
  const [fontManuallyChanged, setFontManuallyChanged] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("auto");
  // Page frame and body weight are detected from the scan, and can be overridden before export
  const [borderStyle, setBorderStyle] = useState<PageBorderKind>("none");
  const [boldBody, setBoldBody] = useState<boolean>(false);

  const activePage = pages[activePageIndex] || null;

  // Render extracted markdown text preserving tables, headings, and alignments visually
  // Render extracted markdown text preserving tables, headings, and alignments visually (Requirement #4)
  const renderVisualDocument = (text: string) => {
    if (!text.trim()) {
      return (
        <div className="py-20 text-center text-slate-400 text-xs sm:text-sm">
          سيظهر هنا النص والمستند المستخرج مع الحفاظ التام على الجداول والعناوين والتنسيق الأصلي...
        </div>
      );
    }

    const isDocAr =
      selectedLanguage === "ar"
        ? true
        : selectedLanguage === "en" || selectedLanguage === "fr"
        ? false
        : /[\u0600-\u06FF]/.test(text);

    const lines = text.split(/\r?\n/);
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();
      if (!line) {
        i++;
        continue;
      }

      // 1. Markdown Table
      if (line.startsWith("|") && line.endsWith("|")) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
          tableLines.push(lines[i].trim());
          i++;
        }

        const validRows = tableLines.filter((l) => {
          const clean = l.replace(/\|/g, "").replace(/[-:\s]/g, "");
          return clean.length > 0;
        });

        if (validRows.length > 0) {
          const tableIsAr = /[\u0600-\u06FF]/.test(validRows.join(" ")) || isDocAr;
          const headerCells = validRows[0]
            .split("|")
            .map((c) => c.trim())
            .slice(1, -1);
          const dataRows = validRows.slice(1).map((r) =>
            r
              .split("|")
              .map((c) => c.trim())
              .slice(1, -1)
          );

          elements.push(
            <div key={`table-${i}`} dir={tableIsAr ? "rtl" : "ltr"} className="my-4 overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
              <table className={`w-full text-xs border-collapse ${tableIsAr ? "text-right" : "text-left"}`}>
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    {headerCells.map((cell, cIdx) => (
                      <th
                        key={cIdx}
                        className={`p-2.5 sm:p-3 font-black text-slate-900 border-l border-slate-200 last:border-l-0 ${tableIsAr ? "text-right" : "text-left"}`}
                      >
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {dataRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/70 transition">
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className={`p-2.5 text-slate-800 border-l border-slate-200 last:border-l-0 leading-relaxed font-sans ${tableIsAr ? "text-right" : "text-left"}`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        continue;
      }

      const lineIsAr = /[\u0600-\u06FF]/.test(line) || (isDocAr && !/^[A-Za-z0-9\s.,'?!:;()\-*]+$/.test(line));

      // 2. Heading Level 1
      if (line.startsWith("# ")) {
        elements.push(
          <h2 key={`h1-${i}`} dir={lineIsAr ? "rtl" : "ltr"} className="text-lg font-black text-slate-900 mt-4 mb-2 pb-1 border-b border-slate-200 text-center">
            {line.replace(/^#\s+/, "")}
          </h2>
        );
        i++;
        continue;
      }

      // 3. Heading Level 2
      if (line.startsWith("## ")) {
        elements.push(
          <h3 key={`h2-${i}`} dir={lineIsAr ? "rtl" : "ltr"} className="text-base font-bold text-slate-800 mt-3 mb-1.5 text-center">
            {previewLine(line.replace(/^##\s+/, ""))}
          </h3>
        );
        i++;
        continue;
      }

      // 4. Heading Level 3
      if (line.startsWith("### ")) {
        elements.push(
          <h4 key={`h3-${i}`} dir={lineIsAr ? "rtl" : "ltr"} className={`text-sm font-bold text-slate-700 mt-2 mb-1 ${lineIsAr ? "text-right" : "text-left"}`}>
            {previewLine(line.replace(/^###\s+/, ""))}
          </h4>
        );
        i++;
        continue;
      }

      // 5. Short heading with colon
      if (line.length < 60 && (line.endsWith(":") || line.endsWith(":-")) && !line.includes(".")) {
        elements.push(
          <h5 key={`h4-${i}`} dir={lineIsAr ? "rtl" : "ltr"} className={`text-xs sm:text-sm font-black text-slate-900 mt-3 mb-1 ${lineIsAr ? "text-right" : "text-left"}`}>
            {line}
          </h5>
        );
        i++;
        continue;
      }

      // 6. Bullet lists
      if (line.startsWith("- ") || line.startsWith("* ") || line.startsWith("• ")) {
        elements.push(
          <div key={`li-${i}`} dir={lineIsAr ? "rtl" : "ltr"} className={`flex items-start gap-2 ${lineIsAr ? "mr-2 text-right" : "ml-2 text-left"} text-xs sm:text-sm text-slate-800 my-1`}>
            <span className="text-blue-600 font-bold">•</span>
            <span>{line.replace(/^[-*•]\s+/, "")}</span>
          </div>
        );
        i++;
        continue;
      }

      // 7. Regular paragraph (Requirement #4: Right align for Arabic, Left align for English/French)
      elements.push(
        <p key={`p-${i}`} dir={lineIsAr ? "rtl" : "ltr"} className={`text-xs sm:text-sm text-slate-800 leading-relaxed my-1.5 whitespace-pre-wrap ${lineIsAr ? "text-right" : "text-left"}`}>
          {previewLine(line)}
        </p>
      );
      i++;
    }

    return <div className="space-y-1">{elements}</div>;
  };

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

        if (data.detectedFont && !fontManuallyChanged) {
          setSelectedFont(data.detectedFont);
        }
        if (data.detectedLang && selectedLanguage === "auto") {
          setSelectedLanguage(data.detectedLang);
        }
        if (i === 0) {
          if (["none", "single", "double", "decorative"].includes(data.detectedBorder)) {
            setBorderStyle(data.detectedBorder);
          }
          // Framed legal forms are printed bold almost without exception
          setBoldBody(data.detectedWeight === "bold" || data.detectedBorder === "decorative");
        }

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

        setRefinedText(combinedRaw);
      }

      // Stage 2: Linguistic refinement
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

      toast.success(
        "اكتمل الاستخراج بنجاح",
        `تم استخراج وتدقيق نصوص ${pages.length} صفحة بنجاح وجاهزة للتصدير للوورد.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء معالجة الصفحات";
      toast.error("فشل الاستخراج", msg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Action: Export Word .docx (Requirement #4)
  const handleExportWord = async () => {
    if (!refinedText.trim()) {
      toast.warning("لا يوجد نص للتصدير", "يرجى استخراج نص أولاً قبل تحميل ملف Word");
      return;
    }

    try {
      await generateOcrDocx({
        content: refinedText,
        fileName: docTitle.endsWith(".docx") ? docTitle : `${docTitle}.docx`,
        font: selectedFont || "Arial",
        borderStyle,
        boldBody,
        language: selectedLanguage as "ar" | "en" | "fr" | "auto",
      });
      toast.success("تم تصدير ملف Word", `تم تحميل المستند بنجاح بخط ${selectedFont || "Arial"} والتنسيق المطلوب`);
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

      <div className="flex flex-col gap-space-lg w-full pb-space-3xl pt-space-xs">
        {/* Core Workbench */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          {/* Left Column: Source Pages & Active Preview */}
          <div className="lg:col-span-5 flex flex-col gap-space-lg">
            {/* Pages Strip & Reordering */}
            <div className="flex flex-col rounded-xl bg-surface-container-low p-space-md shadow-lg border border-surface-container-high/40">
              <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high/60 mb-space-sm">
                <div className="flex items-center gap-space-xs">
                  <Layers className="text-primary w-5 h-5" />
                  <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    صفحات المستند ({pages.length})
                  </span>
                </div>
                <button
                  onClick={handleUploadClick}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-xs cursor-pointer"
                  type="button"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span>+ إضافة صفحات</span>
                </button>
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
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === pages.length - 1}
                          onClick={() => movePageDown(idx)}
                          className="p-1 rounded hover:bg-surface-bright text-on-surface-variant disabled:opacity-30 cursor-pointer"
                          title="تحريك لأسفل"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removePage(idx)}
                          className="p-1 rounded hover:bg-error/20 text-error cursor-pointer"
                          title="حذف هذه الصفحة"
                        >
                          <Trash2 className="w-4 h-4" />
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
                  <UploadCloud className="w-10 h-10 text-primary mx-auto mb-2" />
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
                    <Eye className="w-5 h-5 text-primary" />
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
                    {zoomPreview ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
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
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
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
            <div className="flex flex-col rounded-2xl bg-white p-space-md shadow-sm border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span className="text-base font-bold text-slate-900">
                    النص المستخرج والمدقق
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* View Mode Toggle: Visual Tables vs Raw Textarea */}
                  <div className="flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setViewMode("visual")}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        viewMode === "visual"
                          ? "bg-white text-blue-600 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      التنسيق والجداول
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("raw")}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        viewMode === "raw"
                          ? "bg-white text-blue-600 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      محرر النص
                    </button>
                  </div>

                  <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg font-mono">
                    {wordCount} كلمة | {charCount} حرف
                  </span>
                  <button
                    onClick={handleCopyText}
                    className="flex items-center gap-1 py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer border border-slate-200"
                  >
                    <Copy className="w-4 h-4" />
                    <span>نسخ</span>
                  </button>
                  <button
                    onClick={handleExportWord}
                    disabled={!refinedText.trim()}
                    className="flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>تصدير Word (.docx)</span>
                  </button>
                </div>
              </div>

              {/* Document Configuration Toolbar (Requirement #4) */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl mb-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Font Selector with Arial as default fallback */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-700">نوع الخط (Font):</span>
                    <select
                      value={selectedFont}
                      onChange={(e) => {
                        setSelectedFont(e.target.value);
                        setFontManuallyChanged(true);
                      }}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
                    >
                      <option value="Arial">Arial (الافتراضي العام)</option>
                      <option value="Simplified Arabic">Simplified Arabic (عقود ومحررات)</option>
                      <option value="Traditional Arabic">Traditional Arabic (عربي رسمي)</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Calibri">Calibri</option>
                      <option value="Amiri">Amiri (أميري)</option>
                      <option value="Cairo">Cairo (كايرو)</option>
                      <option value="Tahoma">Tahoma</option>
                    </select>
                  </div>

                  {/* Language Selector */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-700">اتجاه النص:</span>
                    <select
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
                    >
                      <option value="auto">تلقائي (حسب المستند)</option>
                      <option value="ar">العربية (RTL - يمين)</option>
                      <option value="en">English (LTR - يسار)</option>
                      <option value="fr">Français (LTR - يسار)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Page Border (auto-detected from the scan) */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-700">إطار الصفحة:</span>
                    <select
                      value={borderStyle}
                      onChange={(e) => setBorderStyle(e.target.value as PageBorderKind)}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
                    >
                      <option value="none">بدون إطار</option>
                      <option value="single">خط مفرد</option>
                      <option value="double">خط مزدوج</option>
                      <option value="decorative">إطار مزخرف (عقود)</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={boldBody}
                      onChange={(e) => setBoldBody(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                    />
                    <span>نص عريض (Bold)</span>
                  </label>
                </div>
              </div>

              {/* Document Title Input */}
              <div className="mb-3">
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
                  placeholder="اسم ملف الوورد الناتج"
                />
              </div>

              {/* Main Content Area: Visual Formatted with real tables OR Raw Textarea */}
              {viewMode === "visual" ? (
                <div
                  dir={
                    selectedLanguage === "ar"
                      ? "rtl"
                      : selectedLanguage === "en" || selectedLanguage === "fr"
                      ? "ltr"
                      : /[\u0600-\u06FF]/.test(refinedText)
                      ? "rtl"
                      : "ltr"
                  }
                  style={{
                    fontFamily:
                      selectedFont === "Traditional Arabic"
                        ? "'Traditional Arabic', Arial, sans-serif"
                        : `${selectedFont}, Arial, sans-serif`,
                  }}
                  className="w-full min-h-[380px] max-h-[600px] overflow-y-auto bg-slate-50/70 border border-slate-200 rounded-xl p-4 text-slate-900 shadow-inner"
                >
                  {renderVisualDocument(refinedText)}
                </div>
              ) : (
                <textarea
                  value={refinedText}
                  onChange={(e) => setRefinedText(e.target.value)}
                  dir={
                    selectedLanguage === "ar"
                      ? "rtl"
                      : selectedLanguage === "en" || selectedLanguage === "fr"
                      ? "ltr"
                      : /[\u0600-\u06FF]/.test(refinedText)
                      ? "rtl"
                      : "ltr"
                  }
                  style={{
                    fontFamily:
                      selectedFont === "Traditional Arabic"
                        ? "'Traditional Arabic', Arial, sans-serif"
                        : `${selectedFont}, Arial, sans-serif`,
                  }}
                  placeholder="سيظهر هنا النص المستخرج من الصفحات بترتيبها بعد انتهاء القراءة والتدقيق..."
                  rows={18}
                  className={`w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs sm:text-sm text-slate-900 leading-relaxed focus:bg-white focus:outline-none focus:border-blue-500 resize-y ${
                    selectedLanguage === "ar" ||
                    (selectedLanguage === "auto" && /[\u0600-\u06FF]/.test(refinedText))
                      ? "text-right"
                      : "text-left"
                  }`}
                />
              )}
            </div>
          </div>
        </div>

        {/* Clean, Honest Status Footer */}
        {/* <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high/40 text-xs text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-bold text-on-surface">الماسح الضوئي جاهز</span>
            <span>— معالجة فائقة الدقة للوثائق الرسمية والمخطوطات</span>
          </div>
          <span>مطبعة وخدمات كوبي كات</span>
        </div> */}
      </div>
    </div>
  );
}
