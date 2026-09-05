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
  FileText,
  CheckCircle2,
  Zap,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, AlignmentType, ImageRun, convertMillimetersToTwip, PageBreak } from "docx";
import { processImageOnCanvas } from "@/lib/canvas-filters";

interface DocImage {
  id: string;
  name: string;
  originalSrc: string;
  processedSrc: string;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const pureBase64 = base64.includes(",") ? base64.split(",")[1] : base64;
  const binaryString = window.atob(pureBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export default function ScannerPage() {
  const [images, setImages] = useState<DocImage[]>([]);
  const [invert, setInvert] = useState(false);
  const [camScannerMode, setCamScannerMode] = useState(true);
  const [sharpness, setSharpness] = useState(70);
  const [brightness, setBrightness] = useState(110);
  const [contrast, setContrast] = useState(120);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [activePreset, setActivePreset] = useState<string>("camscanner");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyProcessing = (
    originalSrc: string,
    inv = invert,
    cam = camScannerMode,
    b = brightness,
    c = contrast,
    sh = sharpness
  ): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = originalSrc;
      img.onload = () => {
        const res = processImageOnCanvas(img, {
          invert: inv,
          camScannerMode: cam,
          brightness: b,
          contrast: c,
          sharpness: sh,
        });
        resolve(res);
      };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const newDocImages: DocImage[] = [];

    for (const file of fileList) {
      const originalSrc = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.readAsDataURL(file);
      });

      const processedSrc = await applyProcessing(
        originalSrc,
        invert,
        camScannerMode,
        brightness,
        contrast,
        sharpness
      );

      newDocImages.push({
        id: Math.random().toString(36).substring(2, 9),
        name: file.name,
        originalSrc,
        processedSrc,
      });
    }

    setImages((prev) => [...prev, ...newDocImages]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const triggerReprocessAll = async (
    newInvert = invert,
    newCam = camScannerMode,
    newB = brightness,
    newC = contrast,
    newSh = sharpness
  ) => {
    const updated = await Promise.all(
      images.map(async (item) => {
        const processedSrc = await applyProcessing(
          item.originalSrc,
          newInvert,
          newCam,
          newB,
          newC,
          newSh
        );
        return { ...item, processedSrc };
      })
    );
    setImages(updated);
  };

  // Presets
  const applyPreset = (presetName: string) => {
    setActivePreset(presetName);
    if (presetName === "invert_screen") {
      // For black screens / medical test reports
      setInvert(true);
      setCamScannerMode(false);
      setSharpness(80);
      setBrightness(115);
      setContrast(130);
      triggerReprocessAll(true, false, 115, 130, 80);
    } else if (presetName === "camscanner") {
      // For photographed notes / mobile camera papers
      setInvert(false);
      setCamScannerMode(true);
      setSharpness(100);
      setBrightness(110);
      setContrast(120);
      triggerReprocessAll(false, true, 110, 120, 100);
    } else if (presetName === "sharp_only") {
      // Sharpen only without aggressive bleaching
      setInvert(false);
      setCamScannerMode(false);
      setSharpness(100);
      setBrightness(100);
      setContrast(115);
      triggerReprocessAll(false, false, 100, 115, 100);
    } else if (presetName === "reset") {
      // Reset
      setInvert(false);
      setCamScannerMode(false);
      setSharpness(0);
      setBrightness(100);
      setContrast(100);
      triggerReprocessAll(false, false, 100, 100, 0);
    }
  };

  const handleDownloadZip = async () => {
    if (images.length === 0) return;
    setIsExportingZip(true);
    try {
      const zip = new JSZip();
      images.forEach((img, idx) => {
        const base64Data = img.processedSrc.split(",")[1];
        zip.file(`copycat_processed_page_${idx + 1}.jpg`, base64Data, { base64: true });
      });

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "CopyCat_Enhanced_Pages.zip");
    } catch (err) {
      console.error("ZIP Error:", err);
      alert("تعذر إنشاء الملف المضغوط");
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleExportWordDocx = async () => {
    if (images.length === 0) return;
    setIsExportingDocx(true);
    try {
      const children: Paragraph[] = [];

      images.forEach((imgItem, index) => {
        if (index > 0) {
          children.push(new Paragraph({ children: [new PageBreak()] }));
        }

        const imgBytes = base64ToUint8Array(imgItem.processedSrc);

        const paragraph = new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
          children: [
            new ImageRun({
              data: imgBytes,
              transformation: {
                width: 580, // A4 fit proportional width
                height: 780, // A4 fit proportional height
              },
              type: "jpg",
            }),
          ],
        });

        children.push(paragraph);
      });

      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                size: {
                  width: convertMillimetersToTwip(210), // A4 Width
                  height: convertMillimetersToTwip(297), // A4 Height
                },
                margin: {
                  top: convertMillimetersToTwip(10),
                  bottom: convertMillimetersToTwip(10),
                  left: convertMillimetersToTwip(10),
                  right: convertMillimetersToTwip(10),
                },
              },
            },
            children,
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, "CopyCat_Enhanced_A4_Print.docx");
    } catch (err) {
      console.error("Word Docx Export Error:", err);
      alert("تعذر إنشاء مستند الوورد");
    } finally {
      setIsExportingDocx(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold mb-2">
            <ScanLine className="w-3.5 h-3.5" /> عاكس الصور وحامي الحبر الذكي
          </div>
          <h1 className="text-2xl font-black text-white">
            قلب ألوان الشاشات والتحاليل وتفتيح المستندات دفعة واحدة
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed max-w-2xl">
            ارفع حتى 30 صورة معاً (صور مذكرات، تحاليل، أشعات، أو شاشات كمبيوتر سوداء) وطبق عليها عكس الألوان والتبييض
            وحدة النصوص في ثوانٍ معدودة، ثم نزّلها كملف وورد A4 للطباعة الفورية بنسبة توفير حبر تتعدى 80%!
          </p>
        </div>

        {images.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setImages([])}
              className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-red-950/40 text-red-400 hover:bg-red-900/50 border border-red-900/50 transition cursor-pointer"
            >
              مسح الكل
            </button>
            <button
              onClick={handleDownloadZip}
              disabled={isExportingZip}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50 cursor-pointer"
            >
              <Archive className="w-4 h-4 text-amber-400" />
              <span>{isExportingZip ? "جاري الضغط..." : "تنزيل (ZIP)"}</span>
            </button>
            <button
              onClick={handleExportWordDocx}
              disabled={isExportingDocx}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 transition disabled:opacity-50 cursor-pointer font-black"
            >
              <FileText className="w-4 h-4" />
              <span>{isExportingDocx ? "جاري التجهيز..." : "تصدير ملف وورد A4 جاهز"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Preset Quick Actions */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-2.5">
        <span className="text-xs font-bold text-slate-400 ml-2">الإعدادات السريعة الجاهزة:</span>
        <button
          onClick={() => applyPreset("invert_screen")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activePreset === "invert_screen"
              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>عكس شاشات وتحاليل سوداء (توفير 80% حبر)</span>
        </button>

        <button
          onClick={() => applyPreset("camscanner")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activePreset === "camscanner"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 font-black"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>تبييض مذكرات وأوراق مصورة (CamScanner + حدة 100%)</span>
        </button>

        <button
          onClick={() => applyPreset("sharp_only")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activePreset === "sharp_only"
              ? "bg-emerald-600 text-white shadow-md font-black"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>توضيح النصوص فقط (Sharpness 100%)</span>
        </button>

        <button
          onClick={() => applyPreset("reset")}
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-white transition flex items-center gap-1.5 cursor-pointer mr-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>إعادة ضبط المصنع</span>
        </button>
      </div>

      {/* Detailed Sliders & Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-center">
        {/* Invert Toggle */}
        <div className="flex items-center justify-between bg-slate-950 p-3.5 rounded-xl border border-slate-800">
          <div>
            <span className="text-xs font-bold text-slate-200 block">عكس الألوان (Invert)</span>
            <span className="text-[10px] text-amber-400">قلب السواد لبياض ناصع</span>
          </div>
          <input
            type="checkbox"
            checked={invert}
            onChange={(e) => {
              setInvert(e.target.checked);
              triggerReprocessAll(e.target.checked, camScannerMode, brightness, contrast, sharpness);
            }}
            className="w-5 h-5 accent-amber-500 cursor-pointer"
          />
        </div>

        {/* CamScanner Mode Toggle */}
        <div className="flex items-center justify-between bg-slate-950 p-3.5 rounded-xl border border-slate-800">
          <div>
            <span className="text-xs font-bold text-slate-200 block">تبييض الورق (CamScanner)</span>
            <span className="text-[10px] text-slate-400">تبييض الخلفية وتثقيل الخط</span>
          </div>
          <input
            type="checkbox"
            checked={camScannerMode}
            onChange={(e) => {
              setCamScannerMode(e.target.checked);
              triggerReprocessAll(invert, e.target.checked, brightness, contrast, sharpness);
            }}
            className="w-5 h-5 accent-blue-500 cursor-pointer"
          />
        </div>

        {/* Sharpness Slider */}
        <div className="space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between text-xs font-semibold text-slate-300">
            <span>حدة النصوص (Sharpness)</span>
            <span className="text-amber-400 font-bold">{sharpness}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="10"
            value={sharpness}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSharpness(val);
              triggerReprocessAll(invert, camScannerMode, brightness, contrast, val);
            }}
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>

        {/* Brightness Slider */}
        <div className="space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between text-xs font-semibold text-slate-300">
            <span>السطوع (تفتيح)</span>
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
              triggerReprocessAll(invert, camScannerMode, val, contrast, sharpness);
            }}
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>

        {/* Contrast Slider */}
        <div className="space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between text-xs font-semibold text-slate-300">
            <span>التباين (Contrast)</span>
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
              triggerReprocessAll(invert, camScannerMode, brightness, val, sharpness);
            }}
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Upload Box */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-800 hover:border-amber-500/60 bg-slate-900/50 hover:bg-slate-900 transition-all rounded-3xl p-8 sm:p-12 text-center cursor-pointer flex flex-col items-center justify-center gap-3 group"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Upload className="w-8 h-8" />
        </div>
        <div>
          <span className="text-base font-bold text-white block">
            اضغط هنا لرفع صور المذكرات والتحاليل والشاشات دفعة واحدة (15 إلى 30 صورة)
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            يدعم صيغ JPG, PNG, WEBP — المعالجة تتم محلياً في المتصفح بسرعة فائقة
          </span>
        </div>
      </div>

      {/* Processed Images Gallery Grid */}
      {images.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>معروض {images.length} صفحة معالجة جاهزة للطباعة والتصدير</span>
            <span className="text-amber-400 font-semibold">اضغط على زر التصدير للوورد للطباعة الفورية بـ Ctrl + P</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((img, index) => (
              <div
                key={img.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-3 flex flex-col justify-between shadow-lg"
              >
                <div className="relative aspect-[3/4] bg-slate-950 rounded-xl overflow-hidden mb-3 border border-slate-800 flex items-center justify-center">
                  <img
                    src={img.processedSrc}
                    alt={img.name}
                    className="w-full h-full object-contain"
                  />
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-slate-900/90 text-white font-mono text-[10px] border border-slate-700">
                    صفحة {index + 1}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-400 font-medium truncate max-w-[140px]">
                    {img.name}
                  </span>
                  <button
                    onClick={() => setImages((prev) => prev.filter((item) => item.id !== img.id))}
                    className="p-1.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-950/40 transition cursor-pointer"
                    title="حذف هذه الصورة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
