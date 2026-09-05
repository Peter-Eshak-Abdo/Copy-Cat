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
} from "lucide-react";
import { generatePassportPhotosDocx, PhotoPerson } from "@/lib/docx/passport-docx";
import { useToast } from "@/components/toast-provider";
import { getFriendlyErrorMessage } from "@/lib/utils";

export default function PassportPhotosPage() {
  const { toast } = useToast();
  const [persons, setPersons] = useState<PhotoPerson[]>([]);
  const [isProcessingBg, setIsProcessingBg] = useState(false);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  // Default without name as requested in requirement #6
  const [globalIncludeName, setGlobalIncludeName] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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
        setStatusMessage(`جاري عزل وتبييض خلفية الصورة (${i + 1} من ${fileList.length})...`);

        // Process directly in the browser using WASM
        const blob = await removeBackground(file);

        // Frame to 4x5.2 ratio with white background, shoulder width containment, and 1.5pt solid black border
        const framedDataUrl = await createStudioFramedPhoto(blob);

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
        `تمت معالجة وتأطير ${fileList.length} صورة شخصية بنجاح.`
      );
    } catch (err) {
      console.error("AI Background Removal Error:", err);
      toast.info(
        "تنبيه معالجة الخلفية",
        "تعذر العزل التلقائي بالذكاء الاصطناعي، تم استخدام الصورة الأصلية مع تطبيق التأطير المعتمد (4x6)."
      );
      // Fallback: Frame without AI if WASM fails
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const framedDataUrl = await createStudioFramedPhoto(file);
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

  /**
   * Frames the photo to exact 4.0cm x 5.2cm proportion (400x520px),
   * applies a pure white background, ensures shoulders are comfortably contained inside frame (Requirement #8),
   * and draws a 1.5pt solid black border around the photo.
   */
  const createStudioFramedPhoto = (imgBlob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(imgBlob);
      img.onload = () => {
        const targetW = 400;
        const targetH = 520; // 4.0cm x 5.2cm ratio

        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(img.src);
          return;
        }

        // 1. Fill Pure White Background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetW, targetH);

        // 2. Center crop/fit: accommodate shoulders width inside targetW (Requirement #8)
        // Ensure shoulder width has ~7% margin on sides so shoulders don't get cut off
        const widthScale = (targetW * 0.88) / img.width;
        const heightScale = (targetH * 0.92) / img.height;
        const scale = Math.min(widthScale, heightScale);

        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const offsetX = (targetW - drawW) / 2;
        // Position shoulders sitting at the bottom of the frame
        const offsetY = targetH - drawH;

        ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

        // 3. Draw 1.5pt solid black border around photo
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 3; // ~1.5pt rendered crisp at 400x520
        ctx.strokeRect(1.5, 1.5, targetW - 3, targetH - 3);

        resolve(canvas.toDataURL("image/jpeg", 0.96));
      };
    });
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
            <Camera className="w-3.5 h-3.5" /> استوديو الصور الشخصية 4×6 كوداك
          </div>
          <h1 className="text-2xl font-black text-white">
            تجهيز وطباعة الصور الشخصية 4×6 (4 صور A6 أو 9 صور A5)
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed max-w-2xl">
            عزل الخلفية وتبييضها بنقاء تام، احتواء متناسق للأكتاف بمقاس (4 × 5.2 سم) مع إطار أسود 1.5،
            وهامش قص أبيض بمقدار 1 سم أسفل الصور لسهولة القص بالمقص، وبدون اسم تلقائياً للتقديمات الرسمية!
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

      {/* Global Option Bar (Default without name as per Requirement #6) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
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
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform ${
            isDragging
              ? "scale-125 bg-emerald-500 text-slate-950"
              : "bg-emerald-500/10 text-emerald-400 group-hover:scale-110"
          }`}
        >
          <Upload className="w-8 h-8" />
        </div>
        <div>
          <span className="text-base font-bold text-white block">
            {isDragging ? "أفلت الصور هنا الآن!" : "اضغط هنا لرفع الصور الشخصية أو اسحبها وأفلتها مباشرة (Drag & Drop)"}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            يدعم صور السكنر أو الموبايل — عزل فوري للخلفية وضبط مقاس 4×6 واحتواء الأكتاف بدون قصها
          </span>
        </div>
      </div>

      {/* Processing Loader */}
      {isProcessingBg && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 flex items-center justify-center gap-3 text-emerald-300 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span className="font-bold">{statusMessage}</span>
        </div>
      )}

      {/* Prominent Download Banner (Requirement #6) */}
      {persons.length > 0 && (
        <div className="bg-linear-to-r from-emerald-950/60 via-slate-900 to-emerald-950/60 border-2 border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-3">
            <div>
              <span className="text-xs font-black text-emerald-400 uppercase tracking-wider block mb-1">
                جاهز للطباعة الفورية الآن
              </span>
              <h2 className="text-xl font-black text-white">
                تنزيل ملف الوورد الجاهز للطباعة (اختر المقاس المطلوب)
              </h2>
            </div>
            <div className="text-xs text-slate-300 flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <Scissors className="w-4 h-4 text-emerald-400" />
              <span>مُدرج بهامش أبيض 1 سم لسهولة القص الفوري</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Download A6 Button (4 photos) */}
            <button
              onClick={() => handleExportDocx(4)}
              disabled={isGeneratingDocx}
              className="group flex items-center justify-between p-4 rounded-2xl bg-slate-950 hover:bg-slate-800 border-2 border-slate-700 hover:border-emerald-500 transition-all cursor-pointer shadow-lg disabled:opacity-50"
            >
              <div className="flex items-center gap-3 text-right">
                <div className="w-12 h-12 rounded-xl bg-slate-800 group-hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-lg">
                  4×
                </div>
                <div>
                  <span className="font-black text-white text-sm block">تنزيل ملف الوورد (4 صور مقاس A6)</span>
                  <span className="text-xs text-slate-400 block mt-0.5">مقاس الورقة 10.5 × 14.8 سم (ورق فوتو A6 كوداك)</span>
                </div>
              </div>
              <FileDown className="w-6 h-6 text-emerald-400 group-hover:scale-125 transition-transform" />
            </button>

            {/* Download A5 Button (9 photos) */}
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
            <span>تم تجهيز {persons.length} شخصية بمقاس الاستوديو 4×6</span>
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
                    <button
                      onClick={() => removePerson(person.id)}
                      className="p-1 text-red-400 hover:text-red-300 transition cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
                </div>

                <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span>الأكتاف مضبوطة بنقاء</span>
                  <span className="text-emerald-400 font-bold">4.0 × 5.2 سم</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
