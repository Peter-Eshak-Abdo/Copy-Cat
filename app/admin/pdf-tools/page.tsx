"use client";

import React, { useState, useRef } from "react";
import {
  FileText,
  Upload,
  Trash2,
  Sparkles,
  Download,
  Image as ImageIcon,
  RefreshCw,
  Plus,
  Split,
  FileCheck,
  RotateCw,
  Copy,
  ArrowRight,
  ArrowLeft,
  Layers,
  CheckCircle2,
  Layers2,
  FileDown,
  X,
} from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { PDFDocument, degrees } from "pdf-lib";
import { generateOcrDocx } from "@/lib/docx/ocr-docx";
import { readFileAsDataURL } from "@/lib/utils";

type ActiveTab = "pages" | "images_to_pdf" | "pdf_to_word";

interface LoadedDoc {
  id: string;
  name: string;
  buffer: ArrayBuffer;
  pageCount: number;
}

interface VisualPdfPage {
  id: string;
  docIndex: number;      // index in loadedDocs
  sourcePageIndex: number; // 0-based page index in source doc
  rotation: number;       // 0, 90, 180, 270 degrees
  fileName: string;
}

export default function PdfToolsPage() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<ActiveTab>("pages");

  // Tab 1: Visual PDF Pages Organizer State (Point 6 in edits2.0.md)
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const appendPdfInputRef = useRef<HTMLInputElement>(null);
  const [loadedDocs, setLoadedDocs] = useState<LoadedDoc[]>([]);
  const [pages, setPages] = useState<VisualPdfPage[]>([]);
  const [pagesToDeleteInput, setPagesToDeleteInput] = useState<string>("");
  const [isProcessingPdf, setIsProcessingPdf] = useState<boolean>(false);

  // Tab 2: Images to PDF State
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageFiles, setImageFiles] = useState<{ file: File; preview: string }[]>([]);
  const [isConvertingImages, setIsConvertingImages] = useState<boolean>(false);

  // Tab 3: PDF to Word State
  const pdfWordInputRef = useRef<HTMLInputElement>(null);
  const [selectedWordPdf, setSelectedWordPdf] = useState<File | null>(null);
  const [isConvertingWord, setIsConvertingWord] = useState<boolean>(false);
  const [wordConvertedText, setWordConvertedText] = useState<string>("");

  // Handler: Load Primary PDF
  const handlePdfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("صيغة غير صحيحة", "يرجى اختيار ملف PDF صالح");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer);
      const count = pdfDoc.getPageCount();

      const newDoc: LoadedDoc = {
        id: Math.random().toString(36).substring(2, 9),
        name: file.name,
        buffer,
        pageCount: count,
      };

      const initialPages: VisualPdfPage[] = [];
      for (let i = 0; i < count; i++) {
        initialPages.push({
          id: Math.random().toString(36).substring(2, 9),
          docIndex: 0,
          sourcePageIndex: i,
          rotation: 0,
          fileName: file.name,
        });
      }

      setLoadedDocs([newDoc]);
      setPages(initialPages);
      setPagesToDeleteInput("");
      toast.success("تم تفكيك صفحات الملف", `تم تحميل ${count} صفحة بنجاح في المعرض التفاعلي`);
    } catch {
      toast.error("خطأ", "تعذر فتح ملف PDF، قد يكون محمياً بكلمة مرور أو تالفاً");
    } finally {
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  // Handler: Append Another PDF (Merge & Reorder with existing pages)
  const handleAppendPdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("صيغة غير صحيحة", "يرجى اختيار ملف PDF صالح");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer);
      const count = pdfDoc.getPageCount();

      const newDocIndex = loadedDocs.length;
      const newDoc: LoadedDoc = {
        id: Math.random().toString(36).substring(2, 9),
        name: file.name,
        buffer,
        pageCount: count,
      };

      const appendedPages: VisualPdfPage[] = [];
      for (let i = 0; i < count; i++) {
        appendedPages.push({
          id: Math.random().toString(36).substring(2, 9),
          docIndex: newDocIndex,
          sourcePageIndex: i,
          rotation: 0,
          fileName: file.name,
        });
      }

      setLoadedDocs((prev) => [...prev, newDoc]);
      setPages((prev) => [...prev, ...appendedPages]);
      toast.success("تم دمج الملف الإضافي", `تمت إضافة ${count} صفحة من "${file.name}" لترتيبها مع باقي الصفحات`);
    } catch {
      toast.error("خطأ", "تعذر فتح ملف PDF الإضافي");
    } finally {
      if (appendPdfInputRef.current) appendPdfInputRef.current.value = "";
    }
  };

  // Move a page in the visual sequence
  const movePage = (index: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? index + 1 : index - 1;
    if (targetIndex < 0 || targetIndex >= pages.length) return;

    const newPages = [...pages];
    const temp = newPages[index];
    newPages[index] = newPages[targetIndex];
    newPages[targetIndex] = temp;
    setPages(newPages);
  };

  // Rotate a single page 90 degrees
  const rotatePage = (index: number) => {
    setPages((curr) =>
      curr.map((p, i) => (i === index ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    );
  };

  // Duplicate a page (تكرار صفحة)
  const duplicatePage = (index: number) => {
    const target = pages[index];
    const newPage: VisualPdfPage = {
      ...target,
      id: Math.random().toString(36).substring(2, 9),
    };
    const newPages = [...pages];
    newPages.splice(index + 1, 0, newPage);
    setPages(newPages);
    toast.success("تم تكرار الصفحة", `تم عمل نسخة مكررة من الصفحة رقم ${index + 1}`);
  };

  // Delete a single page
  const deletePage = (index: number) => {
    if (pages.length <= 1) {
      toast.warning("تنبيه", "لا يمكن حذف جميع صفحات المستند!");
      return;
    }
    setPages((curr) => curr.filter((_, i) => i !== index));
    toast.info("تم حذف الصفحة", `تمت إزالة الصفحة رقم ${index + 1}`);
  };

  // Rotate All Pages
  const rotateAllPages = () => {
    setPages((curr) => curr.map((p) => ({ ...p, rotation: (p.rotation + 90) % 360 })));
    toast.success("تم تدوير الكل", "تم تدوير كافة الصفحات 90 درجة في اتجاه عقارب الساعة");
  };

  // Batch delete using range text input
  const handleBatchDelete = () => {
    if (!pagesToDeleteInput.trim()) {
      toast.warning("تنبيه", "يرجى كتابة أرقام الصفحات المراد حذفها (مثال: 1, 3, 5-8)");
      return;
    }

    const pagesToDelete = new Set<number>();
    const parts = pagesToDeleteInput.split(",");

    parts.forEach((part) => {
      const trimmed = part.trim();
      if (trimmed.includes("-")) {
        const [startStr, endStr] = trimmed.split("-");
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            pagesToDelete.add(i);
          }
        }
      } else {
        const num = parseInt(trimmed, 10);
        if (!isNaN(num)) pagesToDelete.add(num);
      }
    });

    if (pagesToDelete.size === 0) {
      toast.error("خطأ", "لم يتم التعرف على أرقام صفحات صالحة");
      return;
    }

    const remainingPages = pages.filter((_, idx) => !pagesToDelete.has(idx + 1));
    if (remainingPages.length === 0) {
      toast.error("خطأ", "لا يمكن حذف كافة الصفحات!");
      return;
    }

    setPages(remainingPages);
    setPagesToDeleteInput("");
    toast.success("تم الحذف بنجاح", `تم حذف ${pages.length - remainingPages.length} صفحة من المستند`);
  };

  // Export and download the final arranged PDF
  const handleExportArrangedPdf = async () => {
    if (pages.length === 0 || loadedDocs.length === 0) return;

    setIsProcessingPdf(true);
    try {
      const mergedPdf = await PDFDocument.create();

      // Pre-load all source documents in pdf-lib
      const sourcePdfDocs = await Promise.all(
        loadedDocs.map((doc) => PDFDocument.load(doc.buffer))
      );

      for (let i = 0; i < pages.length; i++) {
        const pageMeta = pages[i];
        const sourceDoc = sourcePdfDocs[pageMeta.docIndex];
        const [copiedPage] = await mergedPdf.copyPages(sourceDoc, [pageMeta.sourcePageIndex]);

        // Apply page rotation
        const currentRot = copiedPage.getRotation().angle;
        copiedPage.setRotation(degrees((currentRot + pageMeta.rotation) % 360));

        mergedPdf.addPage(copiedPage);
      }

      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const downloadName = loadedDocs.length > 1
        ? `CopyCat-Merged-${Date.now()}.pdf`
        : `CopyCat-Organized-${loadedDocs[0].name}`;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(
        "تم تصدير الـ PDF بنجاح",
        `تم حفظ وتحميل المستند النهائي المكون من ${pages.length} صفحة بالترتيب الجديد.`
      );
    } catch (err: unknown) {
      console.error("Export error:", err);
      toast.error("خطأ في التصدير", "تعذر تجميع وتصدير ملف الـ PDF النهائي.");
    } finally {
      setIsProcessingPdf(false);
    }
  };

  // Tab 2: Images to PDF Handler
  const handleImagesToPdf = async () => {
    if (imageFiles.length === 0) {
      toast.warning("تنبيه", "يرجى إضافة صورة واحدة على الأقل");
      return;
    }

    setIsConvertingImages(true);

    try {
      const pdfDoc = await PDFDocument.create();

      for (const item of imageFiles) {
        const arrayBuf = await item.file.arrayBuffer();
        let pdfImage;

        if (item.file.type === "image/png") {
          pdfImage = await pdfDoc.embedPng(arrayBuf);
        } else {
          pdfImage = await pdfDoc.embedJpg(arrayBuf);
        }

        const imgDims = pdfImage.scale(1);
        const pageWidth = 595.28;  // A4 standard points
        const pageHeight = 841.89;

        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        const scaleX = pageWidth / imgDims.width;
        const scaleY = pageHeight / imgDims.height;
        const scale = Math.min(scaleX, scaleY) * 0.95;

        const scaledW = imgDims.width * scale;
        const scaledH = imgDims.height * scale;

        const x = (pageWidth - scaledW) / 2;
        const y = (pageHeight - scaledH) / 2;

        page.drawImage(pdfImage, {
          x,
          y,
          width: scaledW,
          height: scaledH,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CopyCat-Images-Bundle-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("تم بنجاح", `تم تحويل ${imageFiles.length} صورة إلى ملف PDF عالي الجودة`);
    } catch {
      toast.error("خطأ", "تعذر تحويل الصور إلى PDF");
    } finally {
      setIsConvertingImages(false);
    }
  };

  // Tab 3: PDF to Word Handler
  const handlePdfToWordConvert = async () => {
    if (!selectedWordPdf) {
      toast.warning("تنبيه", "يرجى اختيار ملف PDF للتحويل");
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("لا يوجد اتصال بالإنترنت", "تحويل PDF إلى Word الذكي يتطلب اتصالاً بالإنترنت");
      return;
    }

    setIsConvertingWord(true);

    try {
      const dataUrl = await readFileAsDataURL(selectedWordPdf);

      const res = await fetch("/api/pdf-to-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64: dataUrl }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "فشل تحويل الملف");
      }

      const data = await res.json();
      const extractedText = data.text || "";
      setWordConvertedText(extractedText);

      await generateOcrDocx({
        title: selectedWordPdf.name.replace(/\.pdf$/i, ""),
        content: extractedText,
        fileName: `${selectedWordPdf.name.replace(/\.pdf$/i, "")}.docx`,
      });

      toast.success("تم التحويل والتصدير", "تم تنزيل ملف Word منسق باللغة العربية وهوامش ضيقة وخط 18pt");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل تحويل ملف PDF إلى Word";
      toast.error("خطأ", msg);
    } finally {
      setIsConvertingWord(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-2">
            <FileText className="w-3.5 h-3.5" /> استوديو إدارة وتفكيك صفحات الـ PDF
          </div>
          <h1 className="text-2xl font-black text-white">
            منظم ومفكك صفحات PDF (حذف، نقل، تدوير، تكرار ودمج)
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed max-w-2xl">
            فكك أي ملف PDF إلى صفحات مرئية تفاعلية، احذف أو رتّب أو اقلب الصفحات، كرّر أي صفحة بضغطة زر، أو ادمج ملفات PDF أخرى معاً ورتّب صفحاتها بسهولة تامة!
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveTab("pages")}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${
              activeTab === "pages"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            تفكيك وتنظيم الصفحات
          </button>
          <button
            onClick={() => setActiveTab("images_to_pdf")}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${
              activeTab === "images_to_pdf"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            تحويل صور إلى PDF
          </button>
          <button
            onClick={() => setActiveTab("pdf_to_word")}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${
              activeTab === "pdf_to_word"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            تحويل PDF إلى Word ذكي
          </button>
        </div>
      </div>

      {/* Tab 1: Visual Pages Organizer & Merge (Point 6 in edits2.0.md) */}
      {activeTab === "pages" && (
        <div className="space-y-6">
          {/* Action Bar & Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handlePdfFileChange}
                />
                <input
                  ref={appendPdfInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleAppendPdfChange}
                />

                <button
                  onClick={() => pdfInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center gap-2 transition cursor-pointer shadow-lg shadow-blue-600/20"
                >
                  <Upload className="w-4 h-4" />
                  <span>{loadedDocs.length === 0 ? "رفع ملف PDF لتفكيكه" : "فتح ملف جديد..."}</span>
                </button>

                {loadedDocs.length > 0 && (
                  <button
                    onClick={() => appendPdfInputRef.current?.click()}
                    className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-600/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة ملف PDF آخر للدمج والترتيب</span>
                  </button>
                )}

                {pages.length > 0 && (
                  <button
                    onClick={rotateAllPages}
                    className="px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-700/50"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>تدوير الكل 90°</span>
                  </button>
                )}
              </div>

              {pages.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">
                    إجمالي <strong className="text-white font-bold">{pages.length}</strong> صفحة
                  </span>
                  <button
                    onClick={handleExportArrangedPdf}
                    disabled={isProcessingPdf}
                    className="px-6 py-2.5 rounded-2xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer shadow-xl shadow-emerald-600/30 disabled:opacity-50"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>{isProcessingPdf ? "جاري تجميع الملف..." : "تنزيل الـ PDF المرتب والنهائي"}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick Batch Range Delete Bar (Optional for large books) */}
            {pages.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-300">حذف سريع بنطاق الأرقام:</span>
                  <input
                    type="text"
                    value={pagesToDeleteInput}
                    onChange={(e) => setPagesToDeleteInput(e.target.value)}
                    placeholder="مثال: 1, 3, 5-8"
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none w-44"
                  />
                  <button
                    onClick={handleBatchDelete}
                    className="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 font-bold border border-red-900/50 transition cursor-pointer"
                  >
                    حذف النطاق
                  </button>
                </div>

                <div className="text-slate-500 text-[11px]">
                  الملفات المدمجة: {loadedDocs.map((d) => d.name).join(" • ")}
                </div>
              </div>
            )}
          </div>

          {/* Empty State */}
          {pages.length === 0 ? (
            <div
              onClick={() => pdfInputRef.current?.click()}
              className="border-2 border-dashed border-slate-800 hover:border-blue-500/60 transition cursor-pointer rounded-3xl p-12 text-center bg-slate-900/40 hover:bg-slate-900 flex flex-col items-center justify-center gap-3 min-h-[300px]"
            >
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-black text-white mb-1">
                  اضغط لاختيار ملف PDF لتفكيكه إلى صفحات
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  ستتمكن من مسح أي صفحة، تكرارها، تدويرها، نقل مكانها، أو دمج ملف PDF آخر وترتيب الصفحات معاً بسهولة تامة أوفلاين.
                </p>
              </div>
            </div>
          ) : (
            /* Visual Pages Grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {pages.map((page, index) => (
                <div
                  key={page.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between shadow-xl relative hover:border-slate-700 transition group"
                >
                  {/* Top Page Header */}
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-black px-2 py-0.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[11px]">
                      صفحة #{index + 1}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate max-w-[90px]" title={page.fileName}>
                      {page.fileName}
                    </span>
                  </div>

                  {/* Simulated Visual Sheet Card with Rotation Preview */}
                  <div className="aspect-[1/1.414] bg-white rounded-xl shadow-inner border border-slate-300 flex flex-col items-center justify-center p-3 relative overflow-hidden my-1">
                    <div
                      style={{
                        transform: `rotate(${page.rotation}deg)`,
                        transition: "transform 0.2s ease-in-out",
                      }}
                      className="w-full h-full flex flex-col items-center justify-center text-slate-800 text-center select-none"
                    >
                      <FileText className="w-10 h-10 text-slate-400 mb-1" />
                      <span className="text-xs font-black text-slate-900">
                        صفحة {page.sourcePageIndex + 1}
                      </span>
                      {page.rotation > 0 && (
                        <span className="text-[10px] font-bold text-blue-600 mt-1 bg-blue-50 px-1.5 py-0.5 rounded">
                          {page.rotation}°
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Page Interactive Action Buttons */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      {/* Move Right / Left in Arabic RTL */}
                      <button
                        onClick={() => movePage(index, "right")}
                        disabled={index === 0}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white transition disabled:opacity-25 cursor-pointer"
                        title="نقل لليمين (سابقاً)"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      {/* Rotate 90° */}
                      <button
                        onClick={() => rotatePage(index)}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-white transition cursor-pointer"
                        title="تدوير 90°"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>

                      {/* Duplicate Page */}
                      <button
                        onClick={() => duplicatePage(index)}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-emerald-600 text-emerald-400 hover:text-white transition cursor-pointer"
                        title="تكرار هذه الصفحة (Duplicate)"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* Move Left in Arabic RTL */}
                      <button
                        onClick={() => movePage(index, "left")}
                        disabled={index === pages.length - 1}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white transition disabled:opacity-25 cursor-pointer"
                        title="نقل لليسار (لاحقاً)"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Page */}
                      <button
                        onClick={() => deletePage(index)}
                        className="p-1 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 transition cursor-pointer"
                        title="حذف هذه الصفحة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Images to PDF */}
      {activeTab === "images_to_pdf" && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-400" />
                تحويل الصور إلى ملف PDF مجمع عالي الجودة
              </h2>
              {imageFiles.length > 0 && (
                <button
                  onClick={() => setImageFiles([])}
                  className="text-xs text-red-400 hover:underline cursor-pointer"
                >
                  مسح كافة الصور
                </button>
              )}
            </div>

            <input
              ref={imageInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/jpg"
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                const valid = files.filter((f) => f.type.startsWith("image/"));
                const items = valid.map((file) => ({
                  file,
                  preview: URL.createObjectURL(file),
                }));
                setImageFiles((prev) => [...prev, ...items]);
                if (imageInputRef.current) imageInputRef.current.value = "";
              }}
            />

            <div
              onClick={() => imageInputRef.current?.click()}
              className="border-2 border-dashed border-slate-800 hover:border-blue-500/60 transition cursor-pointer rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3 bg-slate-950/40 hover:bg-slate-950 min-h-[160px]"
            >
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-full">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">اضغط هنا لإضافة صور أو اسحبها مباشرة</p>
                <p className="text-xs text-slate-400 mt-1">يدعم JPG و PNG ويقوم بضبط كل صورة كصفحة A4 تلقائياً</p>
              </div>
            </div>

            {imageFiles.length > 0 && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>تم اختيار {imageFiles.length} صورة</span>
                  <button
                    onClick={handleImagesToPdf}
                    disabled={isConvertingImages}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isConvertingImages ? "جاري التحويل..." : "تنزيل ملف PDF المجمع"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {imageFiles.map((item, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-800 aspect-square bg-slate-950">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.preview} alt="Upload preview" className="w-full h-full object-cover" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setImageFiles((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className="absolute top-1 left-1 p-1 rounded-md bg-red-600 text-white opacity-0 group-hover:opacity-100 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: PDF to Word */}
      {activeTab === "pdf_to_word" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-black text-white">
              تحويل مستندات PDF إلى Word بالذكاء الاصطناعي مع تنسيق كوداك (18pt وهوامش ضيقة)
            </h2>
          </div>

          <input
            ref={pdfWordInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              setSelectedWordPdf(file);
            }}
          />

          {!selectedWordPdf ? (
            <div
              onClick={() => pdfWordInputRef.current?.click()}
              className="border-2 border-dashed border-slate-800 hover:border-amber-500/60 transition cursor-pointer rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-3 bg-slate-950/40 hover:bg-slate-950"
            >
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-full">
                <FileText className="w-7 h-7" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">اختر ملف PDF لتحويله إلى Word</p>
                <p className="text-xs text-slate-400 mt-1">يستخرج النصوص العربية وينسقها مباشرة في ملف docx قابل للتعديل</p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-amber-400" />
                <div>
                  <span className="font-bold text-sm text-white block">{selectedWordPdf.name}</span>
                  <span className="text-xs text-slate-400">{(selectedWordPdf.size / 1024).toFixed(1)} KB</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => pdfWordInputRef.current?.click()}
                  className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800"
                >
                  تغيير الملف
                </button>
                <button
                  onClick={handlePdfToWordConvert}
                  disabled={isConvertingWord}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isConvertingWord ? "جاري التحويل الذكي..." : "بدء التحويل وتنزيل Docx"}</span>
                </button>
              </div>
            </div>
          )}

          {wordConvertedText && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> تم استخراج النص وتنزيل ملف Word بنجاح
              </span>
              <p className="text-xs text-slate-300 max-h-40 overflow-y-auto whitespace-pre-line leading-relaxed">
                {wordConvertedText.substring(0, 400)}...
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
