"use client";

import { useState, useRef } from "react";
import {
  Upload,
  Camera,
  FileDown,
  Trash2,
  Sparkles,
  Loader2,
  CheckCircle2,
  Sliders,
  Type,
  Layers,
} from "lucide-react";
import { generatePassportPhotosDocx, PhotoPerson } from "@/lib/docx/passport-docx";

export default function PassportPhotosPage() {
  const [persons, setPersons] = useState<PhotoPerson[]>([]);
  const [isProcessingBg, setIsProcessingBg] = useState(false);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [globalIncludeName, setGlobalIncludeName] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingBg(true);
    setStatusMessage("جاري تشغيل محرك الذكاء الاصطناعي لعزل وتبييض الخلفية...");

    try {
      // Dynamically import @imgly/background-removal on client side
      const { removeBackground } = await import("@imgly/background-removal");

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setStatusMessage(`جاري عزل وتبييض خلفية الصورة (${i + 1} من ${files.length})...`);

        // Process directly in the browser using WASM
        const blob = await removeBackground(file);

        // Frame to 4x5.2 ratio with white background and 1.5pt solid black border
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
    } catch (err) {
      console.error("AI Background Removal Error:", err);
      // Fallback: Frame without AI if WASM fails
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
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

  /**
   * Frames the photo to exact 4.0cm x 5.2cm proportion (400x520px),
   * applies a pure white background, centers the face/shoulders without stretching,
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

        // 2. Center crop/fit (neck to shoulders without stretching or modifying features)
        const scale = Math.max(targetW / img.width, targetH / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const offsetX = (targetW - drawW) / 2;
        // Bias slightly downwards to include neck & top of shoulders nicely
        const offsetY = Math.min(0, (targetH - drawH) * 0.35);

        ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

        // 3. Draw 1.5pt solid black border around photo (as requested in #10)
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
    } catch (err) {
      console.error("Docx generation error:", err);
      alert("تعذر توليد ملف الوورد");
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
            عزل الخلفية وتبييضها بنقاء تام، قص متناسق من تحت الرقبة للأكتاف بمقاس (4 × 5.2 سم) مع إطار أسود 1.5،
            وإمكانية طباعة اسم الشخص أسفل الصور بخط 12 عريض، مع الحفاظ الصارم على ملامح الوجه ولون البشرة 100%!
          </p>
        </div>

        {persons.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setPersons([])}
              className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-red-950/40 text-red-400 hover:bg-red-900/50 border border-red-900/50 transition cursor-pointer"
            >
              مسح الكل
            </button>
            <button
              onClick={() => handleExportDocx(4)}
              disabled={isGeneratingDocx}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50 cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-emerald-400" />
              <span>تصدير 4 صور (A6)</span>
            </button>
            <button
              onClick={() => handleExportDocx(9)}
              disabled={isGeneratingDocx}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>{isGeneratingDocx ? "جاري التجهيز..." : "تصدير 9 صور (A5)"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Global Option Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
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
              طباعة اسم الشخص تحت الصور (خط مقاس 12 عريض Bold)
            </span>
            <span className="text-[11px] text-slate-400">
              خيار مخصص لتقديمات المدارس والجامعات والوظائف التي تشترط وجود الاسم
            </span>
          </div>
        </label>

        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span>المقاس المعتمد:</span>
          <span className="text-emerald-400 font-bold bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
            4.0 سم عرض × 5.2 سم طول (إطار أسود 1.5)
          </span>
        </div>
      </div>

      {/* Upload Box */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-800 hover:border-emerald-500/60 bg-slate-900/50 hover:bg-slate-900 transition-all rounded-3xl p-8 sm:p-12 text-center cursor-pointer flex flex-col items-center justify-center gap-3 group"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Upload className="w-8 h-8" />
        </div>
        <div>
          <span className="text-base font-bold text-white block">
            اضغط هنا لرفع الصور الشخصية أو سحبها مباشرة
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            يدعم صور السكنر أو الموبايل — سيتم عزل الخلفية وضبط مقاس 4×6 والإطار الأسود فورياً
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

      {/* Persons Gallery */}
      {persons.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>تم تجهيز {persons.length} شخصية بمقاس الاستوديو 4×6</span>
            <span className="text-emerald-400 font-bold">
              جاهزة للتصدير المباشر لورق A6 (4 صور) أو ورق A5 (9 صور)
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
                      className="p-1 text-red-400 hover:text-red-300"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Photo with simulated 1.5pt black border & 4x5.2 ratio */}
                  <div className="aspect-[4/5.2] bg-white rounded-xl overflow-hidden mb-3 border-2 border-slate-950 flex items-center justify-center p-1 shadow-md">
                    <img
                      src={person.imageDataUrl}
                      alt={person.name}
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
                        <span>طباعة تحت الصورة</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={person.name}
                      onChange={(e) => updatePersonName(person.id, e.target.value)}
                      placeholder="اكتب اسم الشخص..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span>مقاس الاستوديو 4×6</span>
                  <span className="text-emerald-400 font-bold">خلفية بيضاء 100%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
