"use client";

import React, { useState, useRef } from "react";
import {
  FileText,
  Upload,
  Trash2,
  Download,
  Image as ImageIcon,
  Plus,
  RotateCw,
  Copy,
  ArrowRight,
  ArrowLeft,
  FileDown,
  CheckSquare,
  Square,
  Archive,
  Minimize2,
  Sparkles,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { PDFDocument, degrees } from "pdf-lib";
import { generateOcrDocx } from "@/lib/docx/ocr-docx";
import { readFileAsDataURL } from "@/lib/utils";
import JSZip from "jszip";
import { saveAs } from "file-saver";

type ActiveTab = "pages" | "images_to_pdf" | "pdf_to_word";

interface LoadedDoc {
  id: string;
  name: string;
  buffer: ArrayBuffer;
  pageCount: number;
}

interface VisualPdfPage {
  id: string;
  docIndex: number;
  sourcePageIndex: number;
  rotation: number;
  fileName: string;
  thumbnail?: string;
}

export default function PdfToolsPage() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<ActiveTab>("pages");

  // Tab 1: Visual PDF Pages Organizer State
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const appendPdfInputRef = useRef<HTMLInputElement>(null);
  const [loadedDocs, setLoadedDocs] = useState<LoadedDoc[]>([]);
  const [pages, setPages] = useState<VisualPdfPage[]>([]);
  const [pagesToDeleteInput, setPagesToDeleteInput] = useState<string>("");
  const [isProcessingPdf, setIsProcessingPdf] = useState<boolean>(false);
  const [isGeneratingThumbs, setIsGeneratingThumbs] = useState<boolean>(false);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());

  // Tab 2: Images to PDF State
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageFiles, setImageFiles] = useState<{ file: File; preview: string }[]>([]);
  const [isConvertingImages, setIsConvertingImages] = useState<boolean>(false);

  // Tab 3: PDF to Word State
  const pdfWordInputRef = useRef<HTMLInputElement>(null);
  const [selectedWordPdf, setSelectedWordPdf] = useState<File | null>(null);
  const [isConvertingWord, setIsConvertingWord] = useState<boolean>(false);
  const [wordConvertedText, setWordConvertedText] = useState<string>("");

  // Helper: Render Page Thumbnails using pdfjs-dist
  const renderThumbnailsForDoc = async (
    docBuffer: ArrayBuffer,
    startIndex: number,
    count: number
  ) => {
    try {
      setIsGeneratingThumbs(true);
      const pdfjs = await import("pdfjs-dist");
      if (typeof window !== "undefined") {
        pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.js`;
      }

      // Use a slice copy to avoid detached ArrayBuffer
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(docBuffer.slice(0)) });
      const pdf = await loadingTask.promise;

      for (let i = 1; i <= Math.min(pdf.numPages, count); i++) {
        try {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.35 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport }).promise;
            const thumbUrl = canvas.toDataURL("image/jpeg", 0.75);

            setPages((prev) =>
              prev.map((p) =>
                p.sourcePageIndex === i - 1 && p.docIndex === startIndex
                  ? { ...p, thumbnail: thumbUrl }
                  : p
              )
            );
          }
        } catch (pageErr) {
          console.warn(`Could not render thumbnail for page ${i}:`, pageErr);
        }
      }
    } catch (err) {
      console.warn("PDF thumbnail generator notice:", err);
    } finally {
      setIsGeneratingThumbs(false);
    }
  };

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
      setSelectedPageIds(new Set());
      setPagesToDeleteInput("");
      toast.success("تم تفكيك صفحات الملف", `تم تحميل ${count} صفحة بنجاح، جاري استخراج المعاينة...`);

      // Trigger asynchronous background thumbnail rendering
      setTimeout(() => {
        renderThumbnailsForDoc(buffer, 0, count);
      }, 50);
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
      toast.success(
        "تم دمج الملف الإضافي",
        `تمت إضافة ${count} صفحة من "${file.name}" لترتيبها مع باقي الصفحات`
      );

      setTimeout(() => {
        renderThumbnailsForDoc(buffer, newDocIndex, count);
      }, 50);
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

  // Direct Jump to a specific page number
  const handleJumpPage = (fromIndex: number, targetPos1Based: number) => {
    const toIndex = targetPos1Based - 1;
    if (toIndex < 0 || toIndex >= pages.length || toIndex === fromIndex) return;

    const newPages = [...pages];
    const [moved] = newPages.splice(fromIndex, 1);
    newPages.splice(toIndex, 0, moved);
    setPages(newPages);
    toast.success("تم نقل الصفحة", `تم نقل الصفحة إلى الترتيب رقم #${targetPos1Based}`);
  };

  // Rotate a single page 90 degrees
  const rotatePage = (index: number) => {
    setPages((curr) =>
      curr.map((p, i) => (i === index ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    );
  };

  // Duplicate a page
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
    const pageId = pages[index].id;
    setPages((curr) => curr.filter((_, i) => i !== index));
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      next.delete(pageId);
      return next;
    });
    toast.info("تم حذف الصفحة", `تمت إزالة الصفحة رقم ${index + 1}`);
  };

  // Rotate All Pages
  const rotateAllPages = () => {
    setPages((curr) => curr.map((p) => ({ ...p, rotation: (p.rotation + 90) % 360 })));
    toast.success("تم تدوير الكل", "تم تدوير كافة الصفحات 90 درجة في اتجاه عقارب الساعة");
  };

  // Toggle Single Page Selection
  const togglePageSelection = (id: string) => {
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select / Deselect All
  const toggleSelectAll = () => {
    if (selectedPageIds.size === pages.length) {
      setSelectedPageIds(new Set());
    } else {
      setSelectedPageIds(new Set(pages.map((p) => p.id)));
    }
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
      toast.error("خطأ", "لا يمكن حذف جميع صفحات المستند دفعة واحدة!");
      return;
    }

    setPages(remainingPages);
    setPagesToDeleteInput("");
    toast.success(
      "تم حذف الصفحات",
      `تم حذف ${pagesToDelete.size} صفحة بنجاح. المتبقي ${remainingPages.length} صفحة.`
    );
  };

  // Export arranged PDF (full or selected subset)
  const handleExportArrangedPdf = async (onlySelected: boolean = false) => {
    const targetPagesList = onlySelected
      ? pages.filter((p) => selectedPageIds.has(p.id))
      : pages;

    if (targetPagesList.length === 0) {
      toast.warning("تنبيه", onlySelected ? "يرجى تحديد صفحة واحدة على الأقل للتصدير" : "لا توجد صفحات لتصديرها");
      return;
    }

    setIsProcessingPdf(true);
    try {
      const mergedPdf = await PDFDocument.create();

      const sourcePdfDocs = await Promise.all(
        loadedDocs.map((doc) => PDFDocument.load(doc.buffer))
      );

      for (let i = 0; i < targetPagesList.length; i++) {
        const pageMeta = targetPagesList[i];
        const sourceDoc = sourcePdfDocs[pageMeta.docIndex];
        const [copiedPage] = await mergedPdf.copyPages(sourceDoc, [pageMeta.sourcePageIndex]);

        const currentRot = copiedPage.getRotation().angle;
        copiedPage.setRotation(degrees((currentRot + pageMeta.rotation) % 360));

        mergedPdf.addPage(copiedPage);
      }

      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const downloadName = onlySelected
        ? `CopyCat-Selected-${targetPagesList.length}-Pages.pdf`
        : loadedDocs.length > 1
        ? `CopyCat-Merged-${Date.now()}.pdf`
        : `CopyCat-Organized-${loadedDocs[0].name}`;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(
        "تم تصدير الـ PDF بنجاح",
        `تم حفظ وتحميل ${targetPagesList.length} صفحة بالترتيب الجديد.`
      );
    } catch (err: unknown) {
      console.error("Export error:", err);
      toast.error("خطأ في التصدير", "تعذر تجميع وتصدير ملف الـ PDF النهائي.");
    } finally {
      setIsProcessingPdf(false);
    }
  };

  // Convert PDF Pages to Images (ZIP download)
  const handleExportImagesZip = async (onlySelected: boolean = false) => {
    const targetPagesList = onlySelected
      ? pages.filter((p) => selectedPageIds.has(p.id))
      : pages;

    if (targetPagesList.length === 0) {
      toast.warning("تنبيه", "يرجى تحديد صفحات لتصديرها كصور");
      return;
    }

    setIsProcessingPdf(true);
    try {
      toast.info("جاري تجهيز الصور", "يتم الآن تحويل الصفحات إلى صور عالية الجودة وتجهيز ملف ZIP...");
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

      const zip = new JSZip();

      for (let i = 0; i < targetPagesList.length; i++) {
        const pageMeta = targetPagesList[i];
        const doc = loadedDocs[pageMeta.docIndex];
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(doc.buffer.slice(0)) });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageMeta.sourcePageIndex + 1);

        // Render at 1.5 scale for crisp image resolution
        const viewport = page.getViewport({ scale: 1.5, rotation: pageMeta.rotation });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
          const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
          const pageNumStr = String(i + 1).padStart(2, "0");
          zip.file(`page_${pageNumStr}.jpg`, base64Data, { base64: true });
        }
      }

      const zipContent = await zip.generateAsync({ type: "blob" });
      saveAs(zipContent, `CopyCat_PDF_Images_${Date.now()}.zip`);
      toast.success("تم تنزيل الصور بنجاح", `تم استخراج ${targetPagesList.length} صفحة كصور في ملف ZIP مضغوط.`);
    } catch (err) {
      console.error(err);
      toast.error("خطأ", "تعذر تحويل صفحات الـ PDF إلى صور");
    } finally {
      setIsProcessingPdf(false);
    }
  };

  // PDF Compressor Tool: Re-encodes pages with high efficiency JPEG stream
  const handleCompressPdf = async () => {
    if (pages.length === 0 || loadedDocs.length === 0) return;

    setIsProcessingPdf(true);
    try {
      toast.info("جاري ضغط الملف", "يتم ضغط الصور وإعادة ترميز صفحات الـ PDF لتقليل الحجم إلى أقصى حد...");
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

      const compressedDoc = await PDFDocument.create();

      for (let i = 0; i < pages.length; i++) {
        const pageMeta = pages[i];
        const doc = loadedDocs[pageMeta.docIndex];
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(doc.buffer.slice(0)) });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageMeta.sourcePageIndex + 1);

        // Standard 1.0 scale with 0.72 quality saves up to 85% disk space while preserving crisp print
        const viewport = page.getViewport({ scale: 1.0, rotation: pageMeta.rotation });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.72);
          const imgBytes = await fetch(compressedDataUrl).then((r) => r.arrayBuffer());
          const embeddedJpg = await compressedDoc.embedJpg(imgBytes);

          const newPage = compressedDoc.addPage([viewport.width, viewport.height]);
          newPage.drawImage(embeddedJpg, {
            x: 0,
            y: 0,
            width: viewport.width,
            height: viewport.height,
          });
        }
      }

      const compressedBytes = await compressedDoc.save();
      const blob = new Blob([new Uint8Array(compressedBytes)], { type: "application/pdf" });
      const originalBytesTotal = loadedDocs.reduce((acc, d) => acc + d.buffer.byteLength, 0);
      const originalMb = (originalBytesTotal / (1024 * 1024)).toFixed(2);
      const compressedMb = (compressedBytes.byteLength / (1024 * 1024)).toFixed(2);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CopyCat-Compressed-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(
        "تم ضغط الـ PDF بنجاح!",
        `تم تقليص الحجم من ${originalMb} MB إلى ${compressedMb} MB بنجاح وتوفير المساحة.`
      );
    } catch (err) {
      console.error("Compression error:", err);
      toast.error("خطأ في الضغط", "تعذر ضغط ملف الـ PDF");
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
        const pageWidth = 595.28; // A4 standard points
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
        body: JSON.stringify({
          pdfBase64: dataUrl,
          fileName: selectedWordPdf.name,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "فشل تحويل الملف");
      }

      const data = await res.json();
      const extractedText = data.text || data.formattedText || "";
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
            <FileText className="w-3.5 h-3.5" /> استوديو إدارة وتفكيك صفحات الـ PDF الاحترافي
          </div>
          <h1 className="text-2xl font-black text-white">
            منظم ومفكك صفحات PDF (معاينة صور حية، نقل مباشر، ضغط وتصدير صور)
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed max-w-2xl">
            فكك الـ PDF مع معاينة صور الصفحات الحقيقية، اكتب رقم الصفحة لنقلها مباشرة، حدد صفحات معينة لتصديرها أو تحويلها لصور ZIP، واضغط حجم الملف بنقرة واحدة!
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

      {/* Tab 1: Visual Pages Organizer */}
      {activeTab === "pages" && (
        <div className="space-y-6">
          {/* Action Bar & Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex flex-wrap items-center gap-2.5">
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
                  <>
                    <button
                      onClick={rotateAllPages}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-slate-700/50"
                      title="تدوير كافة الصفحات 90 درجة"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>تدوير الكل 90°</span>
                    </button>

                    <button
                      onClick={toggleSelectAll}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border border-purple-500/30"
                    >
                      {selectedPageIds.size === pages.length ? (
                        <>
                          <Square className="w-3.5 h-3.5" />
                          <span>إلغاء التحديد</span>
                        </>
                      ) : (
                        <>
                          <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
                          <span>تحديد الكل ({pages.length})</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>

              {pages.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {/* Compress Tool Button */}
                  <button
                    onClick={handleCompressPdf}
                    disabled={isProcessingPdf}
                    className="px-3.5 py-2.5 rounded-2xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    title="ضغط ملف الـ PDF وتقليل حجمه بشكل ملحوظ"
                  >
                    <Minimize2 className="w-4 h-4 text-amber-400" />
                    <span>ضغط وتخفيف الحجم</span>
                  </button>

                  {/* PDF to Images ZIP Button */}
                  <button
                    onClick={() => handleExportImagesZip(false)}
                    disabled={isProcessingPdf}
                    className="px-3.5 py-2.5 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    title="تصدير جميع الصفحات كصور JPG في ملف ZIP"
                  >
                    <Archive className="w-4 h-4 text-indigo-400" />
                    <span>تحويل لصور (ZIP)</span>
                  </button>

                  {/* Download Arranged PDF Button */}
                  <button
                    onClick={() => handleExportArrangedPdf(false)}
                    disabled={isProcessingPdf}
                    className="px-5 py-2.5 rounded-2xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer shadow-xl shadow-emerald-600/30 disabled:opacity-50"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>{isProcessingPdf ? "جاري المعالجة..." : "تنزيل الـ PDF المرتب"}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Selective Export Floating Toolbar */}
            {selectedPageIds.size > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-purple-950/40 border border-purple-500/40 text-xs animate-fade-in">
                <div className="flex items-center gap-2 text-purple-200 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                  <span>تم تحديد <strong className="text-white">{selectedPageIds.size}</strong> صفحة</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportArrangedPdf(true)}
                    disabled={isProcessingPdf}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition cursor-pointer flex items-center gap-1 shadow-md shadow-purple-600/20"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>تصدير المحددة كـ PDF</span>
                  </button>

                  <button
                    onClick={() => handleExportImagesZip(true)}
                    disabled={isProcessingPdf}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition cursor-pointer flex items-center gap-1 shadow-md shadow-indigo-600/20"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>تصدير المحددة كصور (ZIP)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Batch Range Delete Bar */}
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

                <div className="text-slate-500 text-[11px] flex items-center gap-2">
                  {isGeneratingThumbs && (
                    <span className="text-blue-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> جاري توليد صور المعاينة...
                    </span>
                  )}
                  <span>الملفات المدمجة: {loadedDocs.map((d) => d.name).join(" • ")}</span>
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
                  اضغط لاختيار ملف PDF لتفكيكه مع عرض صور الصفحات
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  ستظهر صور الصفحات الحقيقية لتتعرف عليها فوراً، مع إمكانية كتابة رقم الصفحة لنقلها، تحديد صفحات معينة لتصديرها PDF أو صور ZIP، وضغط حجم الملف!
                </p>
              </div>
            </div>
          ) : (
            /* Visual Pages Grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {pages.map((page, index) => {
                const isSelected = selectedPageIds.has(page.id);
                return (
                  <div
                    key={page.id}
                    className={`bg-slate-900 border rounded-2xl p-3 flex flex-col justify-between shadow-xl relative transition group ${
                      isSelected
                        ? "border-purple-500 shadow-purple-500/10 ring-1 ring-purple-500/30"
                        : "border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {/* Top Page Header & Selection Checkbox */}
                    <div className="flex items-center justify-between text-xs mb-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => togglePageSelection(page.id)}
                          className="text-slate-400 hover:text-purple-400 transition cursor-pointer"
                          title="تحديد هذه الصفحة"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-purple-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                        </button>
                        <span className="font-black px-2 py-0.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[11px]">
                          صفحة #{index + 1}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 truncate max-w-[80px]" title={page.fileName}>
                        {page.fileName}
                      </span>
                    </div>

                    {/* Visual Sheet Card: Real Thumbnail Image or Fallback */}
                    <div className="aspect-[1/1.414] bg-slate-950 rounded-xl shadow-inner border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden my-1">
                      {page.thumbnail ? (
                        <div
                          style={{
                            transform: `rotate(${page.rotation}deg)`,
                            transition: "transform 0.2s ease-in-out",
                          }}
                          className="w-full h-full flex items-center justify-center p-1"
                        >
                          <img
                            src={page.thumbnail}
                            alt={`صفحة ${index + 1}`}
                            className="w-full h-full object-contain rounded shadow-sm select-none pointer-events-none"
                          />
                        </div>
                      ) : (
                        <div
                          style={{
                            transform: `rotate(${page.rotation}deg)`,
                            transition: "transform 0.2s ease-in-out",
                          }}
                          className="w-full h-full flex flex-col items-center justify-center text-slate-300 text-center select-none bg-slate-900/50 p-2"
                        >
                          <FileText className="w-8 h-8 text-slate-500 mb-1" />
                          <span className="text-xs font-bold text-slate-200">
                            صفحة {page.sourcePageIndex + 1}
                          </span>
                          <span className="text-[10px] text-slate-500 mt-1">جاري المعاينة...</span>
                        </div>
                      )}

                      {page.rotation > 0 && (
                        <span className="absolute top-2 left-2 text-[10px] font-bold text-white bg-blue-600/80 px-1.5 py-0.5 rounded-md shadow backdrop-blur-xs">
                          {page.rotation}°
                        </span>
                      )}
                    </div>

                    {/* Direct Jump / Move to Page Number */}
                    <div className="flex items-center justify-between gap-1 py-1.5 px-2 my-1 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px]">
                      <span className="text-slate-400">انقل لـ #</span>
                      <input
                        type="number"
                        min="1"
                        max={pages.length}
                        key={`${page.id}-${index}`}
                        defaultValue={index + 1}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const val = parseInt((e.target as HTMLInputElement).value, 10);
                            if (!isNaN(val)) handleJumpPage(index, val);
                          }
                        }}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val !== index + 1) handleJumpPage(index, val);
                        }}
                        className="w-12 bg-slate-900 border border-slate-700 rounded-md px-1 py-0.5 text-center text-xs text-white font-bold focus:border-blue-500 focus:outline-none"
                      />
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
                          className="p-1 rounded-lg bg-slate-800 hover:bg-red-600 text-red-400 hover:text-white transition cursor-pointer"
                          title="حذف هذه الصفحة نهائياً"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Images to PDF */}
      {activeTab === "images_to_pdf" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-black text-white">تجميع الصور في ملف PDF واحد</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                اختر عدة صور (JPG, PNG) ورتبها ليتم دمجها في ملف PDF عالي الجودة بنظام ورقة A4.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={imageInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  const newItems = files.map((f) => ({
                    file: f,
                    preview: URL.createObjectURL(f),
                  }));
                  setImageFiles((prev) => [...prev, ...newItems]);
                }}
              />
              <button
                onClick={() => imageInputRef.current?.click()}
                className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة صور</span>
              </button>
              {imageFiles.length > 0 && (
                <button
                  onClick={handleImagesToPdf}
                  disabled={isConvertingImages}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-600/30 disabled:opacity-50"
                >
                  <FileDown className="w-4 h-4" />
                  <span>{isConvertingImages ? "جاري التجميع..." : "تنزيل الـ PDF المجمع"}</span>
                </button>
              )}
            </div>
          </div>

          {imageFiles.length === 0 ? (
            <div
              onClick={() => imageInputRef.current?.click()}
              className="border-2 border-dashed border-slate-800 hover:border-blue-500/50 rounded-3xl p-12 text-center cursor-pointer flex flex-col items-center justify-center gap-3"
            >
              <ImageIcon className="w-10 h-10 text-slate-600" />
              <span className="text-sm font-bold text-slate-300">اضغط لاختيار الصور من جهازك</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {imageFiles.map((item, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-950 p-1">
                  <img src={item.preview} alt="" className="w-full aspect-square object-cover rounded-lg" />
                  <button
                    onClick={() => setImageFiles((curr) => curr.filter((_, i) => i !== idx))}
                    className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: PDF to Word */}
      {activeTab === "pdf_to_word" && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div>
            <h2 className="text-lg font-black text-white">تحويل PDF إلى ملف Word قابل للتعديل</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              تحليل وقراءة مستندات الـ PDF بالذكاء الاصطناعي واستخراج النصوص وتنسيقها في ملف Word A4 وهوامش ضيقة وخط 18pt.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-blue-500/50 rounded-3xl p-8 text-center bg-slate-950/40">
            <input
              ref={pdfWordInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => setSelectedWordPdf(e.target.files?.[0] || null)}
            />

            <FileText className="w-12 h-12 text-blue-400 mb-3" />

            {selectedWordPdf ? (
              <div className="space-y-3">
                <span className="text-sm font-bold text-white block">{selectedWordPdf.name}</span>
                <span className="text-xs text-slate-400 block">
                  الحجم: {(selectedWordPdf.size / 1024).toFixed(1)} KB
                </span>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setSelectedWordPdf(null)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handlePdfToWordConvert}
                    disabled={isConvertingWord}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-600/30 disabled:opacity-50"
                  >
                    {isConvertingWord ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>{isConvertingWord ? "جاري استخراج وتنسيق الوورد..." : "بدء التحويل وتنزيل Word"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => pdfWordInputRef.current?.click()}
                className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-blue-600/20"
              >
                اختيار ملف PDF للتحويل
              </button>
            )}
          </div>

          {wordConvertedText && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-emerald-400 block">معاينة النص المستخرج والمنسق:</span>
              <pre className="text-xs text-slate-300 max-h-60 overflow-y-auto whitespace-pre-wrap font-mono p-3 bg-slate-900 rounded-xl leading-relaxed">
                {wordConvertedText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
