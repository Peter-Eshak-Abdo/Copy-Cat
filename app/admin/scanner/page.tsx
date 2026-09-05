"use client";

import { useState, useRef } from "react";
import NextImage from "next/image";
import {
  Upload,
  ScanLine,
  Sparkles,
  RotateCcw,
  Archive,
  Download,
  CheckCircle2,
  Zap,
  X,
  Maximize2,
  RotateCw,
  Monitor,
  Eye,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { processImageOnCanvas } from "@/lib/canvas-filters";
import { useToast } from "@/components/toast-provider";
import { readFileAsDataURL, getFriendlyErrorMessage } from "@/lib/utils";

interface DocImage {
  id: string;
  name: string;
  originalSrc: string;
  processedSrc: string;
  rotation: number;
}

export default function ScannerPage() {
  const { toast } = useToast();
  const [images, setImages] = useState<DocImage[]>([]);
  const [invert, setInvert] = useState(false);
  const [camScannerMode, setCamScannerMode] = useState(true);
  const [screenClarifierMode, setScreenClarifierMode] = useState(false);
  const [sharpness, setSharpness] = useState(70);
  const [brightness, setBrightness] = useState(110);
  const [contrast, setContrast] = useState(120);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [activePreset, setActivePreset] = useState<string>("camscanner");
  const [isDragging, setIsDragging] = useState(false);

  // Lightbox Modal state (Requirement #12)
  const [enlargedImage, setEnlargedImage] = useState<DocImage | null>(null);

  // Fine Rotation & Crop Modal state (Requirement #12)
  const [editingDoc, setEditingDoc] = useState<DocImage | null>(null);
  const [fineAngle, setFineAngle] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyProcessing = (
    originalSrc: string,
    inv = invert,
    cam = camScannerMode,
    screen = screenClarifierMode,
    b = brightness,
    c = contrast,
    sh = sharpness,
    rot = 0
  ): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = originalSrc;
      img.onload = () => {
        const res = processImageOnCanvas(img, {
          invert: inv,
          camScannerMode: cam,
          screenClarifierMode: screen,
          brightness: b,
          contrast: c,
          sharpness: sh,
          fineAngle: rot,
        });
        resolve(res);
      };
    });
  };

  const processFiles = async (fileList: File[]) => {
    if (!fileList || fileList.length === 0) return;

    const newDocImages: DocImage[] = [];
    let invalidCount = 0;

    for (const file of fileList) {
      if (!file.type.startsWith("image/")) {
        invalidCount++;
        continue;
      }

      try {
        const originalSrc = await readFileAsDataURL(file);
        const processedSrc = await applyProcessing(
          originalSrc,
          invert,
          camScannerMode,
          screenClarifierMode,
          brightness,
          contrast,
          sharpness,
          0
        );

        newDocImages.push({
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          originalSrc,
          processedSrc,
          rotation: 0,
        });
      } catch (err) {
        console.error(`Error loading image ${file.name}:`, err);
        invalidCount++;
      }
    }

    if (newDocImages.length > 0) {
      setImages((prev) => [...prev, ...newDocImages]);
      toast.success(
        `تم إضافة ${newDocImages.length} مستند بنجاح`,
        invalidCount > 0 ? `تم تخطي ${invalidCount} ملف لعدم توافقهما كصور صالحة.` : undefined
      );
    } else if (invalidCount > 0) {
      toast.error("تعذر تحميل الملفات", "يرجى التأكد من اختيار ملفات صور مدعومة (JPG, PNG, WebP).");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(Array.from(files));
  };

  // Drag & Drop Handlers (Requirement #5 & #12)
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
      const validFiles = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith("image/")
      );
      if (validFiles.length > 0) {
        await processFiles(validFiles);
      }
    }
  };

  const triggerReprocessAll = async (
    newInvert = invert,
    newCam = camScannerMode,
    newScreen = screenClarifierMode,
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
          newScreen,
          newB,
          newC,
          newSh,
          item.rotation
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
      setScreenClarifierMode(false);
      setSharpness(80);
      setBrightness(115);
      setContrast(130);
      triggerReprocessAll(true, false, false, 115, 130, 80);
    } else if (presetName === "screen_clarifier") {
      // Requirement #13: Photos of computer screens taken by phone (Anti-Moire & clear text)
      setInvert(false);
      setCamScannerMode(false);
      setScreenClarifierMode(true);
      setSharpness(100);
      setBrightness(115);
      setContrast(135);
      triggerReprocessAll(false, false, true, 115, 135, 100);
    } else if (presetName === "camscanner") {
      // For photographed notes / mobile camera papers
      setInvert(false);
      setCamScannerMode(true);
      setScreenClarifierMode(false);
      setSharpness(100);
      setBrightness(110);
      setContrast(120);
      triggerReprocessAll(false, true, false, 110, 120, 100);
    } else if (presetName === "sharp_only") {
      // Sharpen only without bleaching
      setInvert(false);
      setCamScannerMode(false);
      setScreenClarifierMode(false);
      setSharpness(100);
      setBrightness(100);
      setContrast(115);
      triggerReprocessAll(false, false, false, 100, 115, 100);
    } else if (presetName === "reset") {
      // Reset
      setInvert(false);
      setCamScannerMode(false);
      setScreenClarifierMode(false);
      setSharpness(0);
      setBrightness(100);
      setContrast(100);
      triggerReprocessAll(false, false, false, 100, 100, 0);
    }
  };

  // Download Single Image as Image file (Requirement #12)
  const handleDownloadSingleImage = (img: DocImage, index: number) => {
    saveAs(img.processedSrc, `CopyCat_Page_${index + 1}_${img.name.replace(/\.[^/.]+$/, "")}.jpg`);
  };

  // Download All Images Sequentially (Requirement #12)
  const handleDownloadAllSequential = async () => {
    if (images.length === 0) return;
    setIsDownloadingAll(true);

    try {
      for (let i = 0; i < images.length; i++) {
        const item = images[i];
        handleDownloadSingleImage(item, i);
        // Small delay between browser downloads to prevent popup blocks
        await new Promise((res) => setTimeout(res, 250));
      }
    } finally {
      setIsDownloadingAll(false);
    }
  };

  // Download ZIP
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
      saveAs(content, "CopyCat_Enhanced_Images.zip");
      toast.success("تم تجهيز الأرشيف بنجاح", `تم ضغط وتنزيل ${images.length} صفحة بصيغة ZIP.`);
    } catch (err) {
      console.error("ZIP Error:", err);
      toast.error(
        "تعذر إنشاء الملف المضغوط",
        getFriendlyErrorMessage(err, "يرجى التحقق من حجم الصور والمحاولة مرة أخرى.")
      );
    } finally {
      setIsExportingZip(false);
    }
  };

  // Fine Rotation Apply
  const handleApplyFineRotation = async () => {
    if (!editingDoc) return;
    const newSrc = await applyProcessing(
      editingDoc.originalSrc,
      invert,
      camScannerMode,
      screenClarifierMode,
      brightness,
      contrast,
      sharpness,
      fineAngle
    );

    setImages((prev) =>
      prev.map((item) =>
        item.id === editingDoc.id
          ? { ...item, rotation: fineAngle, processedSrc: newSrc }
          : item
      )
    );
    setEditingDoc(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold mb-2">
            <ScanLine className="w-3.5 h-3.5" /> عاكس الصور وحامي الحبر وتوضيح الشاشات
          </div>
          <h1 className="text-2xl font-black text-white">
            قلب ألوان الشاشات وتبييض المستندات وتوضيح صور الموبايل
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed max-w-2xl">
            ارفع حتى 30 صورة معاً، طبق عليها قلب الألوان أو فلتر شاشات الكمبيوتر المضاد للتموجات (Anti-Moire)،
            مع إمكانية تدوير الصور بزوايا دقيقة وتكبيرها للفحص والتنزيل كصور فردياً أو متتالية بنقرة واحدة!
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

            {/* Sequential download button (Requirement #12) */}
            <button
              onClick={handleDownloadAllSequential}
              disabled={isDownloadingAll}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 transition disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloadingAll ? "جاري تنزيل الصور..." : "تنزيل كل الصور ورا بعض"}</span>
            </button>

            {/* ZIP download button */}
            <button
              onClick={handleDownloadZip}
              disabled={isExportingZip}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50 cursor-pointer"
            >
              <Archive className="w-4 h-4 text-amber-400" />
              <span>{isExportingZip ? "جاري الضغط..." : "تنزيل ملف (ZIP)"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Preset Quick Actions */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-2.5">
        <span className="text-xs font-bold text-slate-400 ml-2">الإعدادات السريعة الجاهزة:</span>

        {/* Screen Clarifier Preset (Requirement #13) */}
        <button
          onClick={() => applyPreset("screen_clarifier")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activePreset === "screen_clarifier"
              ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-black"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <Monitor className="w-3.5 h-3.5 text-cyan-300" />
          <span>توضيح صور شاشات الكمبيوتر (Anti-Moire)</span>
        </button>

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
          <span>تبييض مذكرات وأوراق مصورة (CamScanner)</span>
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
              triggerReprocessAll(e.target.checked, camScannerMode, screenClarifierMode, brightness, contrast, sharpness);
            }}
            className="w-5 h-5 accent-amber-500 cursor-pointer"
          />
        </div>

        {/* Screen Clarifier Mode Toggle (Requirement #13) */}
        <div className="flex items-center justify-between bg-slate-950 p-3.5 rounded-xl border border-slate-800">
          <div>
            <span className="text-xs font-bold text-cyan-300 block">فلتر شاشات الكمبيوتر</span>
            <span className="text-[10px] text-slate-400">إزالة تموجات الشاشة والموبايل</span>
          </div>
          <input
            type="checkbox"
            checked={screenClarifierMode}
            onChange={(e) => {
              setScreenClarifierMode(e.target.checked);
              triggerReprocessAll(invert, camScannerMode, e.target.checked, brightness, contrast, sharpness);
            }}
            className="w-5 h-5 accent-cyan-500 cursor-pointer"
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
              triggerReprocessAll(invert, camScannerMode, screenClarifierMode, brightness, contrast, val);
            }}
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>

        {/* Brightness Slider */}
        <div className="space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between text-xs font-semibold text-slate-300">
            <span>السطوع (تفتيح ناصع)</span>
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
              triggerReprocessAll(invert, camScannerMode, screenClarifierMode, val, contrast, sharpness);
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
              triggerReprocessAll(invert, camScannerMode, screenClarifierMode, brightness, val, sharpness);
            }}
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Upload Box with Drag & Drop (Requirement #5 & #12) */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed transition-all rounded-3xl p-8 sm:p-12 text-center cursor-pointer flex flex-col items-center justify-center gap-3 group ${
          isDragging
            ? "border-amber-400 bg-amber-950/20 scale-[1.01] shadow-2xl shadow-amber-500/10"
            : "border-slate-800 hover:border-amber-500/60 bg-slate-900/50 hover:bg-slate-900"
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
              ? "scale-125 bg-amber-500 text-slate-950"
              : "bg-amber-500/10 text-amber-400 group-hover:scale-110"
          }`}
        >
          <Upload className="w-8 h-8" />
        </div>
        <div>
          <span className="text-base font-bold text-white block">
            {isDragging ? "أفلت الصور هنا الآن!" : "اضغط هنا لرفع الصور أو اسحبها وأفلتها مباشرة (Drag & Drop)"}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            يدعم رفع حتى 30 صورة معاً (JPG, PNG, WEBP) — معالجة فورية فائقة السرعة محلياً بالمتصفح
          </span>
        </div>
      </div>

      {/* Processed Images Gallery Grid */}
      {images.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2">
            <span>معروض {images.length} صورة معالجة جاهزة للتنزيل والفحص</span>
            <span className="text-amber-400 font-semibold">
              انقر على أي صورة لتكبيرها وفحص نقاء الكلمات، أو زر التدوير للضبط بزوايا دقيقة
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((img, index) => (
              <div
                key={img.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden p-3 flex flex-col justify-between shadow-lg relative group"
              >
                {/* Delete 'X' Button Overlay (Requirement #12) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setImages((prev) => prev.filter((item) => item.id !== img.id));
                  }}
                  className="absolute top-4 left-4 z-20 w-7 h-7 rounded-full bg-red-600/90 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110 cursor-pointer"
                  title="حذف هذه الصورة المضافة بالخطأ (X)"
                >
                  <X className="w-4 h-4 stroke-[3]" />
                </button>

                {/* Image Container with click to enlarge (Requirement #12) */}
                <div
                  onClick={() => setEnlargedImage(img)}
                  className="relative aspect-[3/4] bg-slate-950 rounded-xl overflow-hidden mb-3 border border-slate-800 flex items-center justify-center cursor-zoom-in group/img"
                  title="انقر لتكبير الصورة وفحص الكلمات بملء الشاشة"
                >
                  <NextImage
                    src={img.processedSrc}
                    alt={img.name}
                    width={400}
                    height={533}
                    unoptimized
                    className="w-full h-full object-contain transition-transform group-hover/img:scale-105"
                  />

                  {/* Page indicator badge */}
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-slate-900/90 text-white font-mono text-[10px] border border-slate-700">
                    صفحة {index + 1}
                  </span>

                  {/* Hover enlarge overlay */}
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-900/90 text-white text-xs font-bold flex items-center gap-1 border border-slate-700">
                      <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                      تكبير المعاينة
                    </span>
                  </div>
                </div>

                {/* Footer Controls for each image */}
                <div className="space-y-2 pt-1 border-t border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300 font-medium truncate max-w-[150px]" title={img.name}>
                      {img.name}
                    </span>

                    {/* Fine Rotation / Crop Tool Button */}
                    <button
                      onClick={() => {
                        setEditingDoc(img);
                        setFineAngle(img.rotation || 0);
                      }}
                      className="p-1.5 text-amber-400 hover:text-amber-300 rounded-lg hover:bg-amber-950/40 transition flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                      title="تدوير وضبط بزوايا دقيقة"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>تدوير دقيق</span>
                    </button>
                  </div>

                  {/* Dedicated Download Button Under Each Image (Requirement #12) */}
                  <button
                    onClick={() => handleDownloadSingleImage(img, index)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تنزيل هذه الصورة</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox Modal (Click to Enlarge - Requirement #12) */}
      {enlargedImage && (
        <div
          onClick={() => setEnlargedImage(null)}
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl w-full max-h-[92vh] bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col justify-between cursor-default"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-white">{enlargedImage.name} (معاينة فائقة الدقة)</span>
              </div>
              <button
                onClick={() => setEnlargedImage(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 flex-1 overflow-auto max-h-[70vh] flex items-center justify-center bg-slate-950 rounded-2xl p-2 border border-slate-800">
              <NextImage
                src={enlargedImage.processedSrc}
                alt="Enlarged"
                width={800}
                height={1000}
                unoptimized
                className="max-w-full max-h-[68vh] object-contain rounded-lg"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                افحص وضوح ونقاء الحروف والكلمات بعد تطبيق التفتيح وعكس الألوان
              </span>
              <button
                onClick={() => handleDownloadSingleImage(enlargedImage, 1)}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span>تنزيل الصورة المعالجة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fine-Angle Rotation Modal (Requirement #12) */}
      {editingDoc && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <RotateCw className="w-4 h-4 text-amber-400" />
                <h3 className="text-base font-black text-white">تدوير دقيق وتعديل ميلان الصورة</h3>
              </div>
              <button
                onClick={() => setEditingDoc(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-[4/3] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center p-2">
              <NextImage
                src={editingDoc.processedSrc}
                alt="Preview"
                width={600}
                height={450}
                unoptimized
                style={{ transform: `rotate(${fineAngle}deg)` }}
                className="max-w-full max-h-full object-contain transition-transform"
              />
            </div>

            {/* Slider for exact degrees */}
            <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>زاوية الدوران الدقيقة:</span>
                <span className="text-amber-400 font-mono text-sm">{fineAngle > 0 ? `+${fineAngle}` : fineAngle}°</span>
              </div>
              <input
                type="range"
                min="-45"
                max="45"
                step="1"
                value={fineAngle}
                onChange={(e) => setFineAngle(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setFineAngle((prev) => (prev - 90) % 360)}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  -90° يسار
                </button>
                <button
                  onClick={() => setFineAngle(0)}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs transition cursor-pointer"
                >
                  إلغاء الميلان (0°)
                </button>
                <button
                  onClick={() => setFineAngle((prev) => (prev + 90) % 360)}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  +90° يمين
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleApplyFineRotation}
                className="flex-1 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer shadow-lg shadow-amber-500/20"
              >
                تطبيق التدوير
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
