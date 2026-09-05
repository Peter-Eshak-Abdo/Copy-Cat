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
} from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { PDFDocument } from "pdf-lib";
import { generateOcrDocx } from "@/lib/docx/ocr-docx";
import { readFileAsDataURL } from "@/lib/utils";

type ActiveTab = "pages" | "images_to_pdf" | "pdf_to_word";

export default function PdfToolsPage() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<ActiveTab>("pages");

  // Tab 1: PDF Pages Manipulation State
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [loadedPdfBytes, setLoadedPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>("");
  const [pdfPageCount, setPdfPageCount] = useState<number>(0);
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

  // Handler: Load PDF for page deletion/reorder
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

      setLoadedPdfBytes(buffer);
      setPdfFileName(file.name);
      setPdfPageCount(count);
      setPagesToDeleteInput("");
      toast.success("تم تحميل الملف", `يحتوي المستند على ${count} صفحة`);
    } catch {
      toast.error("خطأ", "تعذر فتح ملف PDF، قد يكون محمياً بكلمة مرور أو تالفاً");
    }
  };

  // Handler: Delete Specified Pages from PDF
  const handleDeletePages = async () => {
    if (!loadedPdfBytes) return;
    if (!pagesToDeleteInput.trim()) {
      toast.warning("تنبيه", "يرجى تحديد أرقام الصفحات المراد حذفها (مثال: 1, 3, 5-8)");
      return;
    }

    setIsProcessingPdf(true);

    try {
      // Parse pages numbers & ranges
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
        throw new Error("لم يتم التعرف على أرقام صفحات صالحة");
      }

      const pdfDoc = await PDFDocument.load(loadedPdfBytes);
      const totalPages = pdfDoc.getPageCount();

      // Convert 1-indexed to 0-indexed and sort descending to avoid index shifts
      const sortedIndices = Array.from(pagesToDelete)
        .filter((p) => p >= 1 && p <= totalPages)
        .map((p) => p - 1)
        .sort((a, b) => b - a);

      if (sortedIndices.length === totalPages) {
        throw new Error("لا يمكن حذف جميع صفحات المستند!");
      }

      sortedIndices.forEach((index) => {
        pdfDoc.removePage(index);
      });

      const newPdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(newPdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `modified-${pdfFileName}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Update in-memory
      const arrayBuf = newPdfBytes.buffer.slice(
        newPdfBytes.byteOffset,
        newPdfBytes.byteOffset + newPdfBytes.byteLength
      ) as ArrayBuffer;
      setLoadedPdfBytes(arrayBuf);
      setPdfPageCount(pdfDoc.getPageCount());
      setPagesToDeleteInput("");

      toast.success("تم بنجاح", `تم حذف ${sortedIndices.length} صفحة وتنزيل الملف الجديد`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء معالجة ملف PDF";
      toast.error("خطأ", msg);
    } finally {
      setIsProcessingPdf(false);
    }
  };

  // Handler: Reverse PDF Pages
  const handleReversePdfPages = async () => {
    if (!loadedPdfBytes) return;
    setIsProcessingPdf(true);

    try {
      const srcDoc = await PDFDocument.load(loadedPdfBytes);
      const newDoc = await PDFDocument.create();
      const pageCount = srcDoc.getPageCount();
      const indices = Array.from({ length: pageCount }, (_, i) => pageCount - 1 - i);

      const copiedPages = await newDoc.copyPages(srcDoc, indices);
      copiedPages.forEach((p) => newDoc.addPage(p));

      const newBytes = await newDoc.save();
      const blob = new Blob([new Uint8Array(newBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reversed-${pdfFileName}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("تم العكس", "تم عكس ترتيب صفحات المستند وتنزيله بنجاح");
    } catch {
      toast.error("خطأ", "تعذر عكس ترتيب الصفحات");
    } finally {
      setIsProcessingPdf(false);
    }
  };

  // Tab 2: Images to PDF Handlers
  const handleImageFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: { file: File; preview: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith("image/")) {
        const preview = await readFileAsDataURL(file);
        newItems.push({ file, preview });
      }
    }

    setImageFiles((prev) => [...prev, ...newItems]);
  };

  const handleConvertImagesToPdf = async () => {
    if (imageFiles.length === 0) {
      toast.warning("تنبيه", "يرجى إضافة صور أولاً");
      return;
    }

    setIsConvertingImages(true);

    try {
      const pdfDoc = await PDFDocument.create();

      for (const item of imageFiles) {
        const imgBuffer = await item.file.arrayBuffer();
        let pdfImage;

        if (item.file.type === "image/png") {
          pdfImage = await pdfDoc.embedPng(imgBuffer);
        } else {
          // Default to JPG/JPEG
          pdfImage = await pdfDoc.embedJpg(imgBuffer);
        }

        // Standard A4 dimensions in points (595.28 x 841.89)
        const pageWidth = 595.28;
        const pageHeight = 841.89;

        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        // Scale image to fit within margins
        const margin = 20;
        const maxW = pageWidth - margin * 2;
        const maxH = pageHeight - margin * 2;

        const imgDims = pdfImage.scale(1);
        const scale = Math.min(maxW / imgDims.width, maxH / imgDims.height);

        const scaledW = imgDims.width * scale;
        const scaledH = imgDims.height * scale;

        // Center on page
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
      a.download = `images-bundle-${Date.now()}.pdf`;
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

      // Auto generate Word Docx
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">استوديو وأدوات الـ PDF (PDF Studio)</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            حذف وإعادة ترتيب صفحات الملازم من المنتصف والأطراف، دمج الصور في ملف PDF، وتحويل المستندات العربية إلى Word بمسافات ضيقة وخط 18pt.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-muted/40 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab("pages")}
            className={`px-3.5 py-2 rounded-lg transition ${
              activeTab === "pages"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            تعديل وحذف الصفحات
          </button>
          <button
            onClick={() => setActiveTab("images_to_pdf")}
            className={`px-3.5 py-2 rounded-lg transition ${
              activeTab === "images_to_pdf"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            تحويل صور إلى PDF
          </button>
          <button
            onClick={() => setActiveTab("pdf_to_word")}
            className={`px-3.5 py-2 rounded-lg transition ${
              activeTab === "pdf_to_word"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            تحويل PDF إلى Word ذكي
          </button>
        </div>
      </div>

      {/* Tab 1: Pages Deletion & Reorder */}
      {activeTab === "pages" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-card/70 backdrop-blur-md border border-border rounded-2xl p-5 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary" />
                تحميل ملف PDF للتعديل
              </h2>

              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handlePdfFileChange}
              />

              {!loadedPdfBytes ? (
                <div
                  onClick={() => pdfInputRef.current?.click()}
                  className="border-2 border-dashed border-border hover:border-primary/50 transition cursor-pointer rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3 bg-muted/20 hover:bg-muted/40 min-h-[220px]"
                >
                  <div className="p-3 bg-primary/10 text-primary rounded-full">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">اضغط لاختيار ملف الـ PDF</p>
                    <p className="text-xs text-muted-foreground mt-1">تعديل مباشر وفوري في المتصفح أوفلاين</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 p-4 rounded-xl border border-border bg-background">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-red-500/10 text-red-500 rounded-xl">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="overflow-hidden">
                      <div className="font-bold text-sm text-foreground truncate">{pdfFileName}</div>
                      <div className="text-xs text-muted-foreground">عدد الصفحات: {pdfPageCount} صفحة</div>
                    </div>
                  </div>

                  <button
                    onClick={() => pdfInputRef.current?.click()}
                    className="text-xs text-primary hover:underline block"
                  >
                    تغيير الملف...
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="bg-card/70 backdrop-blur-md border border-border rounded-2xl p-6 shadow-sm space-y-6">
              <h2 className="text-base font-bold text-foreground pb-2 border-b border-border flex items-center gap-2">
                <Split className="w-4 h-4 text-primary" />
                عمليات الحذف والترتيب
              </h2>

              {!loadedPdfBytes ? (
                <div className="py-12 text-center text-muted-foreground">
                  <p className="text-sm">يرجى تحميل ملف PDF أولاً لتفعيل أدوات التعديل</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Delete Pages Section */}
                  <div className="space-y-3 p-4 bg-muted/20 border border-border rounded-2xl">
                    <label className="block text-sm font-bold text-foreground">
                      أرقام الصفحات المراد حذفها:
                    </label>
                    <p className="text-xs text-muted-foreground">
                      يمكنك كتابة صفحات مفردة أو نطاق (مثال: <code className="bg-muted px-1 rounded font-mono">1, 3, 5-8</code>)
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={pagesToDeleteInput}
                        onChange={(e) => setPagesToDeleteInput(e.target.value)}
                        placeholder="مثال: 1, 4, 7-10"
                        className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                        dir="ltr"
                      />
                      <button
                        disabled={isProcessingPdf}
                        onClick={handleDeletePages}
                        className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold rounded-xl transition text-sm flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        حذف وتنزيل
                      </button>
                    </div>
                  </div>

                  {/* Reverse Pages Section */}
                  <div className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-2xl">
                    <div>
                      <h3 className="font-bold text-sm text-foreground">عكس ترتيب صفحات المستند</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        جعل الصفحة الأخيرة هي الأولى (مفيد عند تصوير ملفات مقلوبة)
                      </p>
                    </div>
                    <button
                      disabled={isProcessingPdf}
                      onClick={handleReversePdfPages}
                      className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-semibold rounded-xl transition text-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw className="w-4 h-4" />
                      عكس الصفحات
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Images to PDF */}
      {activeTab === "images_to_pdf" && (
        <div className="space-y-4">
          <div className="bg-card/70 backdrop-blur-md border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div>
                <h2 className="font-bold text-foreground flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary" />
                  تجميع الصور في ملف PDF واحد مقاس A4
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ارفع صور البطاقات، الشهادات، أو صفحات الكتب لتحويلها فورياً لملف PDF جاهز للطباعة.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={imageInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFilesChange}
                />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="px-3.5 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  إضافة صور
                </button>
                {imageFiles.length > 0 && (
                  <button
                    disabled={isConvertingImages}
                    onClick={handleConvertImagesToPdf}
                    className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/90 transition shadow flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    تحويل وتنزيل PDF ({imageFiles.length} صورة)
                  </button>
                )}
              </div>
            </div>

            {imageFiles.length === 0 ? (
              <div
                onClick={() => imageInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-primary/50 transition cursor-pointer rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-3 bg-muted/20 hover:bg-muted/40"
              >
                <div className="p-4 bg-primary/10 text-primary rounded-full">
                  <ImageIcon className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-bold text-foreground">اضغط لاختيار الصور أو اسحبها هنا</p>
                  <p className="text-xs text-muted-foreground mt-1">يدعم JPG, PNG, WEBP بدقة كاملة</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {imageFiles.map((item, idx) => (
                  <div
                    key={idx}
                    className="relative group border border-border rounded-xl overflow-hidden bg-background aspect-[3/4] flex flex-col"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.preview}
                      alt={item.file.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                      <button
                        onClick={() => setImageFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 bg-destructive text-white rounded-lg hover:bg-destructive/90 transition"
                        title="حذف الصورة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                      {idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: PDF to Word AI */}
      {activeTab === "pdf_to_word" && (
        <div className="bg-card/70 backdrop-blur-md border border-border rounded-2xl p-6 shadow-sm space-y-6">
          <div className="pb-3 border-b border-border">
            <h2 className="font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              تحويل الـ PDF العربي إلى Word ذكي قابل للتعديل
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              استخراج وتدقيق النصوص العربية للملازم وتنسيقها في ملف Word بهوامش ضيقة (12.7mm) وخط 18pt وإطار خارجي.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <input
                ref={pdfWordInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => setSelectedWordPdf(e.target.files?.[0] || null)}
              />

              {!selectedWordPdf ? (
                <div
                  onClick={() => pdfWordInputRef.current?.click()}
                  className="border-2 border-dashed border-border hover:border-primary/50 transition cursor-pointer rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3 bg-muted/20 hover:bg-muted/40 min-h-[200px]"
                >
                  <Upload className="w-8 h-8 text-primary" />
                  <p className="font-semibold text-foreground">اختر ملف PDF العربي</p>
                  <p className="text-xs text-muted-foreground">ملفات الملازم والكتب المدرسية</p>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-border bg-background space-y-3">
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-red-500" />
                    <div>
                      <div className="font-bold text-sm text-foreground">{selectedWordPdf.name}</div>
                      <div className="text-xs text-muted-foreground">
                        الحجم: {(selectedWordPdf.size / (1024 * 1024)).toFixed(2)} MB
                      </div>
                    </div>
                  </div>

                  <button
                    disabled={isConvertingWord}
                    onClick={handlePdfToWordConvert}
                    className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition shadow flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    {isConvertingWord ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        جاري التحويل والتدقيق اللغوي...
                      </>
                    ) : (
                      <>
                        <FileCheck className="w-4 h-4" />
                        بدء التحويل إلى Word منسق
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Converted Preview Area */}
            <div className="p-4 bg-muted/20 border border-border rounded-xl flex flex-col h-full min-h-[200px]">
              <div className="font-semibold text-xs text-muted-foreground mb-2">النص المحول:</div>
              <textarea
                value={wordConvertedText}
                readOnly
                placeholder="سيظهر النص المحول هنا بعد اكتمال المعالجة الذكية وسيتم تنزيل ملف docx تلقائياً..."
                className="w-full flex-1 p-3 rounded-lg border border-border bg-background text-sm leading-relaxed resize-none text-foreground"
                dir="rtl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
