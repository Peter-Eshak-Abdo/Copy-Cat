"use client";

import { useState, useRef } from "react";
import {
  Upload,
  ScanLine,
  Sliders,
  Sparkles,
  RotateCcw,
  Archive,
  Download,
  Trash2,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { processImageOnCanvas } from "@/lib/canvas-filters";

interface DocImage {
  id: string;
  name: string;
  originalSrc: string;
  processedSrc: string;
}

export default function ScannerPage() {
  const [images, setImages] = useState<DocImage[]>([]);
  const [invert, setInvert] = useState(false);
  const [camScannerMode, setCamScannerMode] = useState(true);
  const [brightness, setBrightness] = useState(105);
  const [contrast, setContrast] = useState(115);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyFiltersToAll = (
    imgs: DocImage[],
    inv = invert,
    cam = camScannerMode,
    b = brightness,
    c = contrast
  ) => {
    return imgs.map((imgItem) => {
      const img = new Image();
      img.src = imgItem.originalSrc;
      const processed = processImageOnCanvas(img, {
        invert: inv,
        camScannerMode: cam,
        brightness: b,
        contrast: c,
      });
      return { ...imgItem, processedSrc: processed };
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const originalSrc = event.target.result as string;
          const img = new Image();
          img.src = originalSrc;
          img.onload = () => {
            const processedSrc = processImageOnCanvas(img, {
              invert,
              camScannerMode,
              brightness,
              contrast,
            });

            setImages((prev) => [
              ...prev,
              {
                id: Math.random().toString(36).substring(2, 9),
                name: file.name,
                originalSrc,
                processedSrc,
              },
            ]);
          };
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const triggerReprocess = (newInvert = invert, newCam = camScannerMode, newB = brightness, newC = contrast) => {
    setImages((prev) =>
      prev.map((item) => {
        const img = new Image();
        img.src = item.originalSrc;
        const processed = processImageOnCanvas(img, {
          invert: newInvert,
          camScannerMode: newCam,
          brightness: newB,
          contrast: newC,
        });
        return { ...item, processedSrc: processed };
      })
    );
  };

  const handleDownloadZip = async () => {
    if (images.length === 0) return;
    setIsExportingZip(true);
    try {
      const zip = new JSZip();
      images.forEach((img, idx) => {
        const base64Data = img.processedSrc.split(",")[1];
        zip.file(`processed_page_${idx + 1}.jpg`, base64Data, { base64: true });
      });

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "Enhanced_Documents.zip");
    } catch (err) {
      console.error("ZIP Error:", err);
      alert("تعذر إنشاء الملف المضغوط");
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-2">
            <ScanLine className="w-3.5 h-3.5" /> ماسح المستندات وتوفير الأحبار
          </div>
          <h1 className="text-2xl font-bold text-white">تفتيح المستندات وعكس الخلفيات السوداء</h1>
          <p className="text-slate-400 text-sm mt-1">
            قلب ألوان المذكرات الداكنة لتوفير 80% من حبر الطابعة، وتفتيح وتوضيح نصوص الأوراق المصورة بكاميرا الهاتف.
          </p>
        </div>

        {images.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setImages([])}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-red-950/40 text-red-400 hover:bg-red-900/50 border border-red-900/50 transition"
            >
              مسح الكل
            </button>
            <button
              onClick={handleDownloadZip}
              disabled={isExportingZip}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-lg shadow-amber-600/20 transition disabled:opacity-50"
            >
              <Archive className="w-4 h-4" />
              <span>{isExportingZip ? "جاري الضغط..." : "تحميل كل الصور (ZIP)"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Control Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-center">
        {/* Invert Toggle */}
        <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div>
            <span className="text-sm font-bold text-slate-200 block">عكس الألوان (Invert)</span>
            <span className="text-xs text-slate-500">حماية حبارة الطابعة</span>
          </div>
          <input
            type="checkbox"
            checked={invert}
            onChange={(e) => {
              setInvert(e.target.checked);
              triggerReprocess(e.target.checked, camScannerMode, brightness, contrast);
            }}
            className="w-5 h-5 accent-amber-500 cursor-pointer"
          />
        </div>

        {/* CamScanner Mode Toggle */}
        <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div>
            <span className="text-sm font-bold text-slate-200 block">وضع CamScanner</span>
            <span className="text-xs text-slate-500">تبييض الورق وتثقيل النص</span>
          </div>
          <input
            type="checkbox"
            checked={camScannerMode}
            onChange={(e) => {
              setCamScannerMode(e.target.checked);
              triggerReprocess(invert, e.target.checked, brightness, contrast);
            }}
            className="w-5 h-5 accent-amber-500 cursor-pointer"
          />
        </div>

        {/* Brightness Slider */}
        <div className="space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between text-xs font-semibold text-slate-300">
            <span>السطوع</span>
            <span>{brightness}%</span>
          </div>
          <input
            type="range"
            min="60"
            max="160"
            value={brightness}
            onChange={(e) => {
              const val = Number(e.target.value);
              setBrightness(val);
              triggerReprocess(invert, camScannerMode, val, contrast);
            }}
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>

        {/* Contrast Slider */}
        <div className="space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between text-xs font-semibold text-slate-300">
            <span>التباين</span>
            <span>{contrast}%</span>
          </div>
          <input
            type="range"
            min="60"
            max="160"
            value={contrast}
            onChange={(e) => {
              const val = Number(e.target.value);
              setContrast(val);
              triggerReprocess(invert, camScannerMode, brightness, val);
            }}
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Upload Area */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-700 hover:border-amber-500 bg-slate-900/50 hover:bg-slate-900 rounded-2xl p-10 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 group"
      >
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Upload className="w-7 h-7" />
        </div>
        <div>
          <p className="text-base font-bold text-slate-200">
            اسحب صور المذكرات أو المستندات هنا مباشرة
          </p>
          <p className="text-xs text-slate-500 mt-1">تتم المعالجة فورياً عبر محرك الـ Canvas بالمتصفح</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Preview Grid */}
      {images.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-200">
            المستندات المعالجة ({images.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {images.map((img, idx) => (
              <div
                key={img.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-md"
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold bg-slate-800 px-2 py-1 rounded">
                    صفحة #{idx + 1}
                  </span>
                  <button
                    onClick={() => setImages((prev) => prev.filter((i) => i.id !== img.id))}
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="h-56 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center p-2">
                  <img
                    src={img.processedSrc}
                    alt={img.name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>

                <a
                  href={img.processedSrc}
                  download={`processed_${img.name}`}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>تحميل الصورة مفردة</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
