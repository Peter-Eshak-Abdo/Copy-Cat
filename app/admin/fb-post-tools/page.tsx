"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  FileText,
  Download,
  Printer,
  Sparkles,
  Loader2,
  CheckCircle2,
  ArrowRight,
  FolderDown,
  Layers,
  RefreshCw,
  Image as ImageIcon,
} from "lucide-react";
import { useToast } from "@/components/toast-provider";

interface DownloadedDoc {
  id: string;
  title: string;
  dirName: string;
  pdfUrl: string | null;
  pdfFilename: string | null;
  imageCount: number;
  previewImage: string | null;
  images: string[];
  createdAt: number;
}

export default function FacebookPostToolsPage() {
  const { toast } = useToast();

  const [postUrl, setPostUrl] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [maxPhotos, setMaxPhotos] = useState(120);

  const [activeMode, setActiveMode] = useState<"url" | "upload">("url");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isCompilingLocal, setIsCompilingLocal] = useState(false);
  const [showUploadFallbackPrompt, setShowUploadFallbackPrompt] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [scrapedCount, setScrapedCount] = useState(0);
  const [downloadedCount, setDownloadedCount] = useState(0);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [completedDoc, setCompletedDoc] = useState<{
    pdfUrl: string;
    pdfFilename: string;
    totalImages: number;
    title: string;
  } | null>(null);

  const [historyDocs, setHistoryDocs] = useState<DownloadedDoc[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const logEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch("/api/admin/fb-download");
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.warn("Fetch history notice:", errJson.error || res.statusText);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setHistoryDocs(data.documents || []);
      }
    } catch (e) {
      console.warn("Error fetching history:", e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const startScraping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postUrl.trim()) {
      toast.error("يرجى إدخال الرابط", "ضع رابط منشور الفيس بوك أو الألبوم المطلوب سحبه.");
      return;
    }

    setIsRunning(true);
    setStatusMessage("جاري الاتصال بـ Facebook وتحليل المنشور...");
    setScrapedCount(0);
    setDownloadedCount(0);
    setPreviewImages([]);
    setLogs([`بدء فحص الرابط: ${postUrl}`]);
    setCompletedDoc(null);
    setShowUploadFallbackPrompt(false);

    try {
      const response = await fetch("/api/admin/fb-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: postUrl.trim(),
          title: docTitle.trim() || "ملزمة_فيسبوك",
          maxPhotos,
        }),
      });

      if (!response.ok) {
        let errMsg = "حدث خطأ غير متوقع أثناء معالجة الطلب.";
        try {
          const errData = await response.json();
          if (errData?.error) errMsg = errData.error;
        } catch {}
        throw new Error(errMsg);
      }

      if (!response.body) {
        throw new Error("تعذر قراءة الاستجابة من الخادم.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.substring(6));

            if (data.type === "status") {
              setStatusMessage(data.message);
              setLogs((prev) => [...prev, `[حالة] ${data.message}`]);
            } else if (data.type === "progress") {
              setScrapedCount(data.current);
              if (data.image_url) {
                setPreviewImages((prev) => [...prev, data.image_url]);
              }
              setLogs((prev) => [...prev, `[اكتشاف] تم إيجاد صورة رقم ${data.current}`]);
            } else if (data.type === "download_progress") {
              setDownloadedCount(data.downloaded);
            } else if (data.type === "completed") {
              setStatusMessage(data.message);
              setCompletedDoc({
                pdfUrl: data.pdf_url,
                pdfFilename: data.pdf_filename,
                totalImages: data.total_images,
                title: docTitle || "ملزمة فيسبوك",
              });
              setLogs((prev) => [...prev, `✅ ${data.message}`]);
              toast.success("تم تجهيز ملف PDF بنجاح!", `تم دمج ${data.total_images} صفحة بالترتيب.`);
              fetchHistory();
            } else if (data.type === "error") {
              setStatusMessage(`خطأ: ${data.message}`);
              setLogs((prev) => [...prev, `❌ [خطأ] ${data.message}`]);
              toast.error("حدث خطأ", data.message);
              setShowUploadFallbackPrompt(true);
            } else if (data.type === "log") {
              setLogs((prev) => [...prev, data.message]);
            }
          } catch {
            // non-json line
          }
        }
      }
    } catch (err) {
      toast.error("تعذر إكمال العملية", (err as Error).message || "حدث خطأ في الاتصال.");
      setLogs((prev) => [...prev, `❌ [استثناء] ${(err as Error).message}`]);
    } finally {
      setIsRunning(false);
    }
  };

  // Direct File Selection Handling
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files).filter((f) =>
      /\.(jpe?g|png|webp)$/i.test(f.name)
    );
    // Natural alphanumeric sort by filename (e.g. page_1, page_2, page_10)
    newFiles.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    );
    setUploadedFiles((prev) => [...prev, ...newFiles]);
    toast.success(`تم اختيار ${newFiles.length} صفحة`, "تم ترتيبها تلقائياً حسب أرقام الصفحات.");
  };

  const removeUploadedFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearUploadedFiles = () => {
    setUploadedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Compile uploaded images directly in the browser via pdf-lib (100% Client-side, 0 Server Errors)
  const compileLocalImagesToPdf = async () => {
    if (uploadedFiles.length === 0) {
      toast.warning("يرجى اختيار صور", "اسحب أو اختر صور صفحات الملزمة أولاً.");
      return;
    }

    setIsCompilingLocal(true);
    setStatusMessage("جاري تجميع الصفحات في ملف PDF للطباعة بالمتصفح...");
    setLogs((prev) => [
      ...prev,
      `بدء تجميع ${uploadedFiles.length} صفحة محلياً بأعلى دقة للطباعة...`,
    ]);

    try {
      const { PDFDocument } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const bytes = await file.arrayBuffer();
        let img;
        if (file.type.includes("png")) {
          img = await pdfDoc.embedPng(bytes);
        } else {
          img = await pdfDoc.embedJpg(bytes);
        }
        const page = pdfDoc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        setLogs((prev) => [...prev, `[صفحة #${i + 1}] تمت إضافة ${file.name}`]);
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      const safeTitle = (docTitle || "ملزمة_مطبوعة").trim().replace(/[\\/*?:"<>|]/g, "_");
      const filename = `${safeTitle}.pdf`;

      setCompletedDoc({
        pdfUrl: blobUrl,
        pdfFilename: filename,
        totalImages: uploadedFiles.length,
        title: safeTitle,
      });

      toast.success(
        "تم تجهيز ملف الـ PDF بنجاح!",
        `تم دمج ${uploadedFiles.length} صفحة بالترتيب وجاهز للطباعة فوراً.`
      );
      setLogs((prev) => [...prev, `✅ اكتمل إنشاء ملف ${filename} بنجاح!`]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر تجميع ملف PDF";
      toast.error("خطأ", msg);
      setLogs((prev) => [...prev, `❌ [خطأ] ${msg}`]);
    } finally {
      setIsCompilingLocal(false);
    }
  };

  // 1-Click Send to Print Queue
  const sendToPrintQueue = (doc: { title: string; pdfUrl: string; totalImages: number }) => {
    try {
      const existing = JSON.parse(localStorage.getItem("copycat_tasks_v1") || "[]");
      const newTask = {
        id: `fb_doc_${Date.now()}`,
        title: `طباعة ملزمة: ${doc.title} (${doc.totalImages} ص)`,
        customerName: "عميل فيسبوك / تحميل مباشر",
        phone: "",
        deadline: "فوري",
        totalCopies: doc.totalImages,
        completedCopies: 0,
        bindingType: "سلك بلاستيك / كعب",
        notes: `ملف PDF تم سحبه أو تجهيزه آلياً: ${doc.pdfUrl}`,
        status: "pending",
        createdAt: Date.now(),
      };
      localStorage.setItem("copycat_tasks_v1", JSON.stringify([newTask, ...existing]));
      toast.success(
        "تمت الإضافة لطابور الطباعة 🖨️",
        `تم تسجيل مهمة طباعة "${doc.title}" في لوحة التحكم الرئيسية.`
      );
    } catch {
      toast.error("تعذر حفظ المهمة");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-200 text-blue-400 text-xs font-bold mb-2">
            <Layers className="w-3.5 h-3.5" /> سحب بوستات وملازم فيسبوك بالترتيب
          </div>
          <h1 className="text-2xl font-black text-slate-900">
            سحب وتحميل بوستات فيسبوك كاملة وتحويلها لملف PDF جاهز للطباعة
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 leading-relaxed max-w-2xl">
            ضع رابط أي منشور فيسبوك يحتوي على صفحات أو صور كثيرة (مثل ملازم 50 إلى 80 صورة)، أو اسحب صور الملزمة
            مباشرة لتجميعها بالترتيب الدقيق في ملف PDF عالي الجودة للطباعة الفورية!
          </p>
        </div>

        <Link
          href="/admin"
          className="self-start md:self-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للوحة الإدارة</span>
        </Link>
      </div>

      {/* Main Form & Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          {/* Method Selector Tabs */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveMode("url")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 ${
                activeMode === "url"
                  ? "bg-white text-blue-600 shadow-sm border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🔗 سحب تلقائي برابط المنشور</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("upload")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 ${
                activeMode === "upload"
                  ? "bg-white text-blue-600 shadow-sm border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>📁 رفع وسحب صور الملزمة مباشرة (بدون قيود)</span>
            </button>
          </div>

          {activeMode === "url" ? (
            <form onSubmit={startScraping} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  رابط منشور أو ألبوم فيسبوك (Facebook Post / Album URL):
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://www.facebook.com/.../posts/..."
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  disabled={isRunning}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none transition"
                />
                <span className="text-[11px] text-slate-500 block mt-1">
                  يدعم روابط المنشورات العامة، ألبومات الصور، والصفحات التعليمية.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">
                    عنوان الملزمة أو المذكرة (اسم الملف):
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: مذكرة لغة عربية الصف الثالث"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    disabled={isRunning}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">
                    الحد الأقصى لعدد الصور المسموح سحبها:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={maxPhotos}
                    onChange={(e) => setMaxPhotos(Number(e.target.value))}
                    disabled={isRunning}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isRunning}
                className="w-full py-3.5 rounded-2xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm transition cursor-pointer shadow-xs shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري سحب الصور ودمج الـ PDF...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>🚀 ابدأ سحب الصور وتوليد الـ PDF للطباعة</span>
                  </>
                )}
              </button>

              {showUploadFallbackPrompt && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3 animate-in fade-in">
                  <div className="flex items-start gap-2.5">
                    <span className="text-lg">💡</span>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-amber-950">
                        المنشور في مجموعة مغلقة أو يتطلب تسجيل الدخول؟
                      </h4>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        لحماية الخصوصية، يمنع فيسبوك سحب محتوى المجموعات المغلقة بدون حساب. يمكنك سحب وإفلات صور صفحات الملزمة مباشرة في صندوق الرفع بالمتصفح لتوليد ملف الـ PDF فوراً بدون أي أخطاء!
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMode("upload");
                      setShowUploadFallbackPrompt(false);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <FolderDown className="w-4 h-4" />
                    <span>📁 التبديل الآن لصندوق رفع وسحب الصور (سحب وإفلات مباشر)</span>
                  </button>
                </div>
              )}
            </form>
          ) : (
            /* Mode 2: Direct Upload */
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFilesSelected(e.dataTransfer.files);
                }}
                className="border-2 border-dashed border-blue-400/50 hover:border-blue-600 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3 bg-blue-50/30 hover:bg-blue-50/60 transition cursor-pointer"
              >
                <div className="p-3 bg-blue-500/10 text-blue-600 rounded-full">
                  <FolderDown className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    اسحب وأفلت صور صفحات الملزمة هنا أو اضغط للاختيار
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    يدعم اختيار حتى 150 صورة دفعة واحدة من الموبايل أو واتساب، وسيتم ترتيبها تلقائياً
                  </p>
                </div>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      تم تحديد {uploadedFiles.length} صفحة
                    </span>
                    <button
                      type="button"
                      onClick={clearUploadedFiles}
                      className="text-xs text-red-500 hover:text-red-700 font-bold cursor-pointer"
                    >
                      مسح الكل
                    </button>
                  </div>

                  <div className="max-h-36 overflow-y-auto flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                    {uploadedFiles.map((f, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-700 font-mono shadow-2xs"
                      >
                        <span className="text-blue-600 font-bold">#{idx + 1}</span>
                        <span className="truncate max-w-[120px]">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => removeUploadedFile(idx)}
                          className="text-slate-400 hover:text-red-500 font-black cursor-pointer"
                          title="حذف هذه الصفحة"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">
                    عنوان الملزمة أو المذكرة:
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: مذكرة علوم الصف الأول الإعدادي"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    disabled={isCompilingLocal}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={compileLocalImagesToPdf}
                disabled={isCompilingLocal || uploadedFiles.length === 0}
                className="w-full py-3.5 rounded-2xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm transition cursor-pointer shadow-xs shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isCompilingLocal ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري تجميع ملف PDF بالمتصفح...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>⚡ تجميع الـ PDF فوراً ({uploadedFiles.length} صفحة)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Active Process Status Card */}
          {isRunning && (
            <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/40 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-blue-300 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  <span>{statusMessage}</span>
                </span>
                <span className="font-mono text-cyan-400 font-black">
                  {scrapedCount} تم اكتشافها • {downloadedCount} تم تحميلها
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-blue-500 to-cyan-400 transition-all duration-300 animate-pulse"
                  style={{
                    width: `${Math.min(100, Math.max(10, (downloadedCount / Math.max(1, scrapedCount)) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Completed Document Card */}
          {completedDoc && (
            <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>تم تجهيز ملف PDF بنجاح! ({completedDoc.totalImages} صفحة)</span>
                </div>
                <span className="text-xs text-emerald-300 font-bold bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  جاهز للطباعة
                </span>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href={completedDoc.pdfUrl}
                  download={completedDoc.pdfFilename}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل ملف PDF ({completedDoc.pdfFilename})</span>
                </a>

                <button
                  type="button"
                  onClick={() => sendToPrintQueue(completedDoc)}
                  className="py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>إرسال لطابور الطباعة 🖨️</span>
                </button>
              </div>
            </div>
          )}

          {/* Live Progress Terminal / Log Feed */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-500 block">سجل العمليات المباشر:</span>
            <div className="h-40 bg-slate-50 border border-slate-200 rounded-2xl p-3 font-mono text-[11px] overflow-y-auto space-y-1 text-slate-500">
              {logs.length === 0 ? (
                <span className="text-slate-600">في انتظار بدء السحب...</span>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="leading-relaxed">
                    {log}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>

        {/* Live Scraped Image Stream / Thumbnails */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                <span>الصور المكتشفة بالترتيب ({previewImages.length})</span>
              </h3>
              <span className="text-[11px] text-slate-500">تسلسل 1، 2، 3...</span>
            </div>

            <div className="h-80 overflow-y-auto grid grid-cols-3 gap-2 p-2 bg-slate-50 rounded-2xl border border-slate-200">
              {previewImages.length === 0 ? (
                <div className="col-span-3 h-full flex flex-col items-center justify-center text-slate-600 text-xs text-center p-4">
                  <Layers className="w-8 h-8 mb-2 opacity-40" />
                  <span>ستظهر مصغرات الصور هنا فور اكتشافها بالترتيب الزمني للملزمة</span>
                </div>
              ) : (
                previewImages.map((imgUrl, i) => (
                  <div
                    key={i}
                    className="relative aspect-[3/4] bg-white rounded-lg overflow-hidden border border-slate-200 group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imgUrl} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 right-1 bg-slate-900/40 text-slate-900 font-mono text-[9px] px-1 rounded font-black">
                      #{i + 1}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
            💡 <strong className="text-slate-900">معلومة:</strong> يتم تجميع الصفحات بنفس ترتيب ظهورها في المنشور
            لضمان قراءة الملازم والمذكرات بترتيب الصفحات الصحيح.
          </div>
        </div>
      </div>

      {/* History of Downloaded Documents */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderDown className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-black text-slate-900">الملازم والملفات المحفوظة سابقاً</h2>
          </div>
          <button
            onClick={fetchHistory}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            title="تحديث القائمة"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingHistory ? "animate-spin" : ""}`} />
          </button>
        </div>

        {historyDocs.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            لا توجد ملفات PDF مسحوبة من فيسبوك حتى الآن.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {historyDocs.map((doc) => (
              <div
                key={doc.id}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-slate-200 transition"
              >
                <div className="flex items-start gap-3">
                  <div className="w-14 h-18 bg-white rounded-xl overflow-hidden border border-slate-200 shrink-0 flex items-center justify-center">
                    {doc.previewImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={doc.previewImage} alt={doc.title} className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="w-6 h-6 text-slate-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 line-clamp-2 leading-tight">
                      {doc.title}
                    </h3>
                    <span className="text-[11px] text-blue-400 font-bold block mt-1">
                      {doc.imageCount} صفحة
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {new Date(doc.createdAt).toLocaleString("ar-EG")}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-900">
                  {doc.pdfUrl && (
                    <a
                      href={doc.pdfUrl}
                      download={doc.pdfFilename || "ملزمة.pdf"}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-emerald-600 text-slate-700 hover:text-white font-bold text-xs flex items-center justify-center gap-1 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تحميل PDF</span>
                    </a>
                  )}

                  {doc.pdfUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        sendToPrintQueue({
                          title: doc.title,
                          pdfUrl: doc.pdfUrl!,
                          totalImages: doc.imageCount,
                        })
                      }
                      className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white transition cursor-pointer"
                      title="إرسال لطابور الطباعة"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
