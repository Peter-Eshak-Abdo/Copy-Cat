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
} from "lucide-react";
import { generatePassportPhotosDocx, PhotoPerson } from "@/lib/docx/passport-docx";

export default function PassportPhotosPage() {
  const [persons, setPersons] = useState<PhotoPerson[]>([]);
  const [isProcessingBg, setIsProcessingBg] = useState(false);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingBg(true);
    setStatusMessage("جاري تحميل موديل الذكاء الاصطناعي لتفريغ الخلفية داخل المتصفح...");

    try {
      // Dynamically import @imgly/background-removal on client side
      const { removeBackground } = await import("@imgly/background-removal");

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setStatusMessage(`جاري عزل خلفية الصورة ${i + 1} من ${files.length}...`);

        // Process directly in the browser using WASM
        const blob = await removeBackground(file);

        // Convert the transparent PNG to a White Background JPEG for standard passport photo printing
        const whiteBgDataUrl = await createWhiteBackgroundPhoto(blob);

        setPersons((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            name: file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
            imageDataUrl: whiteBgDataUrl,
          },
        ]);
      }
    } catch (err) {
      console.error("AI Background Removal Error:", err);
      alert("حدث خطأ أثناء تفريغ الخلفية. تأكد من أن جهازك يدعم WebAssembly.");
    } finally {
      setIsProcessingBg(false);
      setStatusMessage("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const createWhiteBackgroundPhoto = (pngBlob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(pngBlob);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(img.src);
          return;
        }

        // Fill Pure White Background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw cropped person on top
        ctx.drawImage(img, 0, 0);

        resolve(canvas.toDataURL("image/jpeg", 0.95));
      };
    });
  };

  const updatePersonName = (id: string, name: string) => {
    setPersons((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" /> استوديو الصور الشخصية 4x6
          </div>
          <h1 className="text-2xl font-bold text-white">عزل الخلفية وتجهيز طباعة الصور الشخصية</h1>
          <p className="text-slate-400 text-sm mt-1">
            يتم عزل الخلفية بالكامل داخل متصفحك عبر تقنية WebAssembly وبخلفية بيضاء نقية دون رفع أي صورة لسيرفرات خارجية.
          </p>
        </div>

        {persons.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleExportDocx(4)}
              disabled={isGeneratingDocx}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" />
              <span>تحميل A6 (4 صور للشخص)</span>
            </button>
            <button
              onClick={() => handleExportDocx(9)}
              disabled={isGeneratingDocx}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" />
              <span>تحميل A5 (9 صور للشخص)</span>
            </button>
          </div>
        )}
      </div>

      {/* Upload & Progress Area */}
      <div
        onClick={() => !isProcessingBg && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center transition flex flex-col items-center justify-center gap-3 ${
          isProcessingBg
            ? "border-emerald-500 bg-emerald-950/20 cursor-wait"
            : "border-slate-700 hover:border-emerald-500 bg-slate-900/50 hover:bg-slate-900 cursor-pointer group"
        }`}
      >
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
          {isProcessingBg ? (
            <Loader2 className="w-7 h-7 animate-spin" />
          ) : (
            <Camera className="w-7 h-7" />
          )}
        </div>
        <div>
          {isProcessingBg ? (
            <p className="text-base font-bold text-emerald-400 animate-pulse">
              {statusMessage}
            </p>
          ) : (
            <>
              <p className="text-base font-bold text-slate-200">
                اضغط هنا لاختيار الصور الشخصية لتفريغها فورياً
              </p>
              <p className="text-xs text-slate-500 mt-1">
                تفريغ تلقائي بالذكاء الاصطناعي وبخلفية بيضاء نقية جاهزة لطباعة الاستوديو
              </p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          disabled={isProcessingBg}
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Processed Persons Grid */}
      {persons.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-200">
              الصور المعالجة ({persons.length})
            </h2>
            <button
              onClick={() => setPersons([])}
              className="text-xs text-red-400 hover:underline"
            >
              مسح قائمة الصور
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {persons.map((person) => (
              <div
                key={person.id}
                className="relative bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center gap-3 shadow-md"
              >
                <button
                  onClick={() => removePerson(person.id)}
                  className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg transition"
                >
                  ×
                </button>

                {/* 4x6 Photo Aspect Ratio Preview */}
                <div className="w-32 h-44 bg-white rounded-lg border-2 border-slate-700 overflow-hidden shadow flex items-center justify-center">
                  <img
                    src={person.imageDataUrl}
                    alt={person.name}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="w-full space-y-1">
                  <label className="text-[11px] text-slate-400 block text-right">اسم الشخص (اختياري):</label>
                  <input
                    type="text"
                    value={person.name}
                    onChange={(e) => updatePersonName(person.id, e.target.value)}
                    placeholder="اسم العميل..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-center text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
