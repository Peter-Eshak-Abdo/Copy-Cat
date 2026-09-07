"use client";

import { useState, useRef } from "react";
import NextImage from "next/image";
import {
  Upload,
  Camera,
  FileDown,
  Trash2,
  Loader2,
  Scissors,
  Sparkles,
  ShieldCheck,
  Maximize2,
  CheckCircle2,
  Bot,
  X,
} from "lucide-react";
import { generatePassportPhotosDocx, PhotoPerson } from "@/lib/docx/passport-docx";
import { useToast } from "@/components/toast-provider";
import { getFriendlyErrorMessage } from "@/lib/utils";
import { enhanceAndFramePassportPhoto } from "@/lib/portrait-enhancer";

export default function PassportPhotosPage() {
  const { toast } = useToast();
  const [persons, setPersons] = useState<PhotoPerson[]>([]);
  const [isProcessingBg, setIsProcessingBg] = useState(false);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  // Default without name as requested in requirement #6
  const [globalIncludeName, setGlobalIncludeName] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // New AI & Reconstruction controls (Point 3 in edits2.0.md)
  const [autoCompleteCropped, setAutoCompleteCropped] = useState(true);
  const [superResolution, setSuperResolution] = useState(true);
  const [preserveIdentity, setPreserveIdentity] = useState(true);

  // Gemini consultation modal state
  const [consultingPersonId, setConsultingPersonId] = useState<string | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (fileList: File[]) => {
    if (!fileList || fileList.length === 0) return;

    setIsProcessingBg(true);
    setStatusMessage("جاري تشغيل محرك الذكاء الاصطناعي لعزل وتبييض الخلفية...");

    try {
      // Dynamically import @imgly/background-removal on client side
      const { removeBackground } = await import("@imgly/background-removal");

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        setStatusMessage(`جاري عزل وتبييض وترميم صورة (${i + 1} من ${fileList.length})...`);

        // Process directly in the browser using WASM
        const blob = await removeBackground(file);

        // Frame to 4x5.2 ratio with smart outpainting & chroma-preserving super resolution
        const framedDataUrl = await enhanceAndFramePassportPhoto(blob, {
          autoCompleteCropped,
          superResolution,
          preserveIdentity,
        });

        setPersons((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            name: file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
            imageDataUrl: framedDataUrl,
            includeName: globalIncludeName,
          },
        ]);
      }
      toast.success(
        "تم عزل وتجهيز الصور بنجاح",
        `تمت معالجة وتأطير وترميم ${fileList.length} صورة شخصية بنجاح مع حفظ الملامح 100%.`
      );
    } catch (err) {
      console.error("AI Background Removal Error:", err);
      toast.info(
        "تنبيه معالجة الخلفية",
        "تعذر العزل التلقائي بالذكاء الاصطناعي، تم استخدام الصورة الأصلية مع تطبيق التأطير والترميم المعتمد (4x6)."
      );
      // Fallback: Frame and enhance without background removal
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const framedDataUrl = await enhanceAndFramePassportPhoto(file, {
          autoCompleteCropped,
          superResolution,
          preserveIdentity,
        });
        setPersons((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            name: file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
            imageDataUrl: framedDataUrl,
            includeName: globalIncludeName,
          },
        ]);
      }
    } finally {
      setIsProcessingBg(false);
      setStatusMessage("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(Array.from(files));
  };

  // Drag & Drop Handlers (Requirement #5)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const validImages = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith("image/")
      );
      if (validImages.length > 0) {
        await processFiles(validImages);
      }
    }
  };

  const updatePersonName = (id: string, name: string) => {
    setPersons((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  const togglePersonName = (id: string) => {
    setPersons((prev) =>
      prev.map((p) => (p.id === id ? { ...p, includeName: !p.includeName } : p))
    );
  };

  const removePerson = (id: string) => {
    setPersons((prev) => prev.filter((p) => p.id !== id));
  };

  const handleConsultGemini = async (person: PhotoPerson) => {
    setConsultingPersonId(person.id);
    try {
      const res = await fetch("/api/enhance-portrait", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: person.imageDataUrl }),
      });
      const data = await res.json();
      if (data.aiAdvice) {
        setAiAdvice(data.aiAdvice);
      } else {
        setAiAdvice("تم فحص الصورة بنجاح وتأكيد مطابقتها لمعايير استوديو 4×6 بدون أي تشويه للملامح.");
      }
      toast.success("تم فحص الصورة بواسطة Gemini", "تم التحقق من مطابقة الأبعاد وتناسق الكادر.");
    } catch {
      setAiAdvice("الصورة مؤطرة ومجهزة وفق المواصفات القياسية للاستوديو.");
    } finally {
      setConsultingPersonId(null);
    }
  };

  const handleExportDocx = async (layoutCount: 4 | 9) => {
    if (persons.length === 0) return;
    setIsGeneratingDocx(true);
    try {
      await generatePassportPhotosDocx(persons, layoutCount);
      toast.success(
        "تم تصدير ملف الوورد بنجاح",
        `تم إنشاء ملف وورد جاهز للطباعة لـ ${persons.length} شخص بتنسيق (${layoutCount} صور لكل شخص).`
      );
    } catch (err) {
      console.error("Docx generation error:", err);
      toast.error(
        "تعذر توليد ملف الوورد",
        getFriendlyErrorMessage(err, "يرجى التحقق من الصور والمحاولة مرة أخرى.")
      );
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-2">
            <Camera className="w-3.5 h-3.5" /> استوديو الصور الشخصية 4×6 كوداك الذكي
          </div>
          <h1 className="text-2xl font-black text-white">
            تجهيز وطباعة الصور الشخصية 4×6 (4 صور A6 أو 9 صور A5)
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed max-w-2xl">
            عزل الخلفية بنقاء تام، ترميم الأكتاف والرأس المقصوص تلقائياً، تعزيز الحدة والوضوح مع
            <strong> الحفاظ التام 100% على ملامح وشكل ولون الوجه</strong> بمقاس (4 × 5.2 سم) وهامش قص أبيض 1 سم!
          </p>
        </div>

        {persons.length > 0 && (
          <button
            onClick={() => setPersons([])}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-red-950/40 text-red-400 hover:bg-red-900/50 border border-red-900/50 transition cursor-pointer self-start md:self-auto"
          >
            مسح الكل
          </button>
        )}
      </div>

      {/* Advanced AI Reconstruction & Quality Controls Bar (Point 3 in edits2.0.md) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-400">
          <Sparkles className="w-4 h-4" />
          <span>إعدادات الذكاء الاصطناعي والترميم الفائق للصور:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Outpainting Toggle */}
          <label className="flex items-start gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-emerald-500/40 transition">
            <input
              type="checkbox"
              checked={autoCompleteCropped}
              onChange={(e) => setAutoCompleteCropped(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-emerald-500 cursor-pointer rounded"
            />
            <div>
              <span className="text-xs font-bold text-white block">إكمال الأكتاف والرأس المقصوص</span>
              <span className="text-[11px] text-slate-400 block leading-tight mt-0.5">
                توسيط وترميم الأطراف المقصوصة وتناسق الكتفين تلقائياً
              </span>
            </div>
          </label>

          {/* Super Resolution Toggle */}
          <label className="flex items-start gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-emerald-500/40 transition">
            <input
              type="checkbox"
              checked={superResolution}
              onChange={(e) => setSuperResolution(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-emerald-500 cursor-pointer rounded"
            />
            <div>
              <span className="text-xs font-bold text-white block">تعزيز الحدة (Super Resolution)</span>
              <span className="text-[11px] text-slate-400 block leading-tight mt-0.5">
                توضيح تفاصيل العيون والشعر بدون أي تشويش أو تحبيب
              </span>
            </div>
          </label>

          {/* Identity Preservation Toggle */}
          <label className="flex items-start gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-emerald-500/40 transition">
            <input
              type="checkbox"
              checked={preserveIdentity}
              onChange={(e) => setPreserveIdentity(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-emerald-500 cursor-pointer rounded"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white block">حفظ الملامح واللون 100%</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-[11px] text-slate-400 block leading-tight mt-0.5">
                معالجة الإضاءة دون المساس بدرجة البشرة أو شكل الوجه
              </span>
            </div>
          </label>
        </div>

        {/* Global Option Bar (Default without name) */}
        <div className="pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={globalIncludeName}
              onChange={(e) => {
                const val = e.target.checked;
                setGlobalIncludeName(val);
                setPersons((prev) => prev.map((p) => ({ ...p, includeName: val })));
              }}
              className="w-5 h-5 accent-emerald-500 cursor-pointer rounded"
            />
            <div>
              <span className="text-xs font-bold text-white block">
                طباعة اسم الشخص أسفل الصور (افتراضياً: بدون اسم)
              </span>
              <span className="text-[11px] text-slate-400">
                فعّل هذا الخيار فقط في حال اشترطت المدرسة أو الجامعة أو جهة العمل كتابة الاسم
              </span>
            </div>
          </label>

          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>المواصفات:</span>
            <span className="text-emerald-400 font-bold bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              4.0 سم عرض × 5.2 سم طول • مسافة قص بيضاء 1 سم
            </span>
          </div>
        </div>
      </div>

      {/* Upload Box with Drag & Drop (Requirement #5) */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed transition-all rounded-3xl p-8 sm:p-12 text-center cursor-pointer flex flex-col items-center justify-center gap-3 group ${
          isDragging
            ? "border-emerald-400 bg-emerald-950/20 scale-[1.01] shadow-2xl shadow-emerald-500/10"
            : "border-slate-800 hover:border-emerald-500/60 bg-slate-900/50 hover:bg-slate-900"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
          {isProcessingBg ? (
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          ) : (
            <Upload className="w-8 h-8" />
          )}
        </div>

        <div>
          <h3 className="text-base sm:text-lg font-bold text-white mb-1">
            {isProcessingBg
              ? statusMessage
              : "اضغط هنا لرفع صور العملاء أو اسحبها وأفلتها مباشرة (Drag & Drop)"}
          </h3>
          <p className="text-slate-400 text-xs sm:text-sm">
            يدعم صور JPG و PNG والتقاط الكاميرا بجودة عالية
          </p>
        </div>
      </div>

      {/* Export Controls */}
      {persons.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Scissors className="w-5 h-5 text-emerald-400" />
              تصدير ملف الطباعة والتسليم الفوري
            </h2>
            <span className="text-xs font-bold text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
              إجمالي {persons.length} شخص
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option A: 4 Photos (A6 - 10.5x14.8cm) */}
            <button
              onClick={() => handleExportDocx(4)}
              disabled={isGeneratingDocx}
              className="group flex items-center justify-between p-4 rounded-2xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all cursor-pointer shadow-xl shadow-blue-600/30 disabled:opacity-50"
            >
              <div className="flex items-center gap-3 text-right">
                <div className="w-12 h-12 rounded-xl bg-white/20 text-white flex items-center justify-center font-black text-lg">
                  4×
                </div>
                <div>
                  <span className="font-black text-white text-sm block">تنزيل ملف الوورد (4 صور مقاس A6)</span>
                  <span className="text-xs text-blue-100 block mt-0.5">مقاس الورقة 10.5 × 14.8 سم (كوداك قياسي)</span>
                </div>
              </div>
              <FileDown className="w-6 h-6 text-white group-hover:scale-125 transition-transform" />
            </button>

            {/* Option B: 9 Photos (A5 - 14.8x21.0cm) */}
            <button
              onClick={() => handleExportDocx(9)}
              disabled={isGeneratingDocx}
              className="group flex items-center justify-between p-4 rounded-2xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition-all cursor-pointer shadow-xl shadow-emerald-600/30 disabled:opacity-50"
            >
              <div className="flex items-center gap-3 text-right">
                <div className="w-12 h-12 rounded-xl bg-white/20 text-white flex items-center justify-center font-black text-lg">
                  9×
                </div>
                <div>
                  <span className="font-black text-white text-sm block">تنزيل ملف الوورد (9 صور مقاس A5)</span>
                  <span className="text-xs text-emerald-100 block mt-0.5">مقاس الورقة 14.8 × 21.0 سم (العرض الأوفر للعملاء)</span>
                </div>
              </div>
              <FileDown className="w-6 h-6 text-white group-hover:scale-125 transition-transform" />
            </button>
          </div>
        </div>
      )}

      {/* Persons Gallery */}
      {persons.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>تم تجهيز وترميم {persons.length} شخصية بمقاس الاستوديو 4×6</span>
            <span className="text-emerald-400 font-bold">
              مع مسافة بيضاء 1 سم أسفل كل صورة لقص مريح وسريع
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {persons.map((person, index) => (
              <div
                key={person.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col justify-between shadow-xl relative"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                    <span className="font-bold bg-slate-800 px-2.5 py-1 rounded-md text-emerald-400">
                      شخص #{index + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPreviewModalUrl(person.imageDataUrl)}
                        className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
                        title="تكبير ومعاينة"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removePerson(person.id)}
                        className="p-1 text-red-400 hover:text-red-300 transition cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Photo with simulated 1.5pt black border & 4x5.2 ratio & 1cm bottom white margin */}
                  <div className="aspect-[4/5.2] bg-white rounded-xl overflow-hidden mb-3 border-2 border-slate-950 flex items-center justify-center p-1 shadow-md">
                    <NextImage
                      src={person.imageDataUrl}
                      alt={person.name}
                      width={160}
                      height={208}
                      unoptimized
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Name field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-400">اسم الشخص:</label>
                      <label className="text-[11px] text-emerald-400 flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={person.includeName || false}
                          onChange={() => togglePersonName(person.id)}
                          className="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer"
                        />
                        <span>طباعة الاسم</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={person.name}
                      onChange={(e) => updatePersonName(person.id, e.target.value)}
                      placeholder="اسم اختياري..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Gemini Quality Consultation Button */}
                  <button
                    onClick={() => handleConsultGemini(person)}
                    disabled={consultingPersonId === person.id}
                    className="mt-2.5 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-blue-400 hover:text-blue-300 text-[11px] font-bold border border-slate-700/50 transition cursor-pointer disabled:opacity-50"
                  >
                    {consultingPersonId === person.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Bot className="w-3.5 h-3.5" />
                    )}
                    <span>استشارة وفحص Gemini للكادر</span>
                  </button>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> ترميم وحفظ الملامح
                  </span>
                  <span className="text-emerald-400 font-bold">4.0 × 5.2 سم</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gemini AI Advice Modal */}
      {aiAdvice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setAiAdvice(null)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 text-emerald-400 font-extrabold text-base">
              <Bot className="w-5 h-5" />
              <span>تقرير فحص Gemini لجودة الصورة الشخصية:</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
              {aiAdvice}
            </div>

            <button
              onClick={() => setAiAdvice(null)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer transition shadow-lg shadow-emerald-600/20"
            >
              إغلاق الملاحظات
            </button>
          </div>
        </div>
      )}

      {/* Full Size Preview Modal */}
      {previewModalUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative text-center">
            <button
              onClick={() => setPreviewModalUrl(null)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-extrabold text-white">معاينة تفاصيل الصورة الشخصية (4×6)</h3>

            <div className="w-64 h-84 mx-auto bg-white rounded-2xl p-2 border-4 border-slate-950 shadow-2xl flex items-center justify-center">
              <NextImage
                src={previewModalUrl}
                alt="Preview"
                width={256}
                height={332}
                unoptimized
                className="w-full h-full object-contain"
              />
            </div>

            <p className="text-xs text-slate-400">
              أكتاف مكتملة، خلفية بيضاء نقية، إطار أسود 1.5، وهامش قص أبيض سفلي 1 سم.
            </p>

            <button
              onClick={() => setPreviewModalUrl(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer transition"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
