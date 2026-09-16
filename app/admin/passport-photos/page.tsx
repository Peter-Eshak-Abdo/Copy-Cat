"use client";

import { useState, useRef } from "react";
import NextImage from "next/image";
import {
  Upload,
  FileDown,
  Trash2,
  Maximize2,
  CheckCircle2,
  X,
  Focus,
  ZoomIn,
  RotateCw,
  RefreshCw,
  Printer,
  Sliders,
  Sparkles,
  Layers,
  Wand2,
} from "lucide-react";
import { generatePassportPhotosDocx } from "@/lib/docx/passport-docx";
import { useToast } from "@/components/toast-provider";
import { getFriendlyErrorMessage, readFileAsDataURL } from "@/lib/utils";
import { enhanceAndFramePassportPhoto } from "@/lib/portrait-enhancer";

export interface PhotoPerson {
  id: string;
  name: string;
  imageDataUrl: string; // Current 400x520 framed photo
  originalDataUrl: string; // Original uploaded photo
  cutoutDataUrl?: string; // Background-removed / isolated cutout
  brightness: number; // 50 to 150 (default 100)
  contrast: number; // 50 to 150 (default 100)
  saturation: number; // 0 to 200 (default 100)
  panX: number;
  panY: number;
  zoom: number;
  rotation: number;
  whiteBackground: boolean;
  includeName?: boolean;
}

export default function PassportPhotosPage() {
  const { toast } = useToast();
  const [persons, setPersons] = useState<PhotoPerson[]>([]);
  const [isProcessingBg, setIsProcessingBg] = useState(false);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [globalIncludeName, setGlobalIncludeName] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Full-size preview modal
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  // 4x6 Biometric Crop & Framing Modal State
  const [framingTarget, setFramingTarget] = useState<PhotoPerson | null>(null);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1.0);
  const [framingRotation, setFramingRotation] = useState<number>(0);
  const [framingBrightness, setFramingBrightness] = useState<number>(100);
  const [framingContrast, setFramingContrast] = useState<number>(100);
  const [framingSaturation, setFramingSaturation] = useState<number>(100);
  const [framingWhiteBg, setFramingWhiteBg] = useState<boolean>(true);

  // Grid Sheet Direct Print / Preview State
  const [gridPreview, setGridPreview] = useState<{
    person: PhotoPerson;
    layoutCount: 4 | 9;
    dataUrl: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pointer drag for framing
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; initialPanX: number; initialPanY: number }>({
    x: 0,
    y: 0,
    initialPanX: 0,
    initialPanY: 0,
  });

  const handlePointerDownFraming = (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialPanX: panX,
      initialPanY: panY,
    };
  };

  const handlePointerMoveFraming = (e: React.PointerEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPanX(panStartRef.current.initialPanX + dx);
    setPanY(panStartRef.current.initialPanY + dy);
  };

  const handlePointerUpFraming = () => {
    setIsPanning(false);
  };

  /**
   * Renders the 4x6 studio photo (400x520 px, 40mm x 52mm ratio) on HTML5 canvas
   * with live Brightness, Contrast, Saturation and 1.5 border.
   */
  const renderFramedCanvas = async ({
    imgSrc,
    panX = 0,
    panY = 0,
    zoom = 1.0,
    rotation = 0,
    brightness = 100,
    contrast = 100,
    saturation = 100,
    whiteBackground = true,
  }: {
    imgSrc: string;
    panX?: number;
    panY?: number;
    zoom?: number;
    rotation?: number;
    brightness?: number;
    contrast?: number;
    saturation?: number;
    whiteBackground?: boolean;
  }): Promise<string> => {
    const targetW = 400;
    const targetH = 520;

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return imgSrc;

    // 1. Fill background (pure white #FFFFFF for passport photos)
    ctx.fillStyle = whiteBackground ? "#ffffff" : "#f1f5f9";
    ctx.fillRect(0, 0, targetW, targetH);

    // 2. Load image and draw with translation, rotation, and zoom
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = imgSrc;
    });

    ctx.save();
    // Center of canvas
    ctx.translate(targetW / 2 + panX, targetH / 2 + panY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    // Draw image centered
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    // Fit to canvas proportionally
    const scale = Math.max(targetW / iw, targetH / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    // 3. Pixel level adjustments for Brightness, Contrast, and Saturation
    if (brightness !== 100 || contrast !== 100 || saturation !== 100) {
      const imgData = ctx.getImageData(0, 0, targetW, targetH);
      const d = imgData.data;

      const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      const bDelta = brightness - 100;
      const satRatio = saturation / 100;

      for (let i = 0; i < d.length; i += 4) {
        let r = d[i];
        let g = d[i + 1];
        let b = d[i + 2];

        // Skip pure background if it's white
        if (r === 255 && g === 255 && b === 255) continue;

        // Brightness
        if (bDelta !== 0) {
          r = Math.min(255, Math.max(0, r + bDelta * 0.8));
          g = Math.min(255, Math.max(0, g + bDelta * 0.8));
          b = Math.min(255, Math.max(0, b + bDelta * 0.8));
        }

        // Contrast
        if (contrast !== 100) {
          r = Math.min(255, Math.max(0, contrastFactor * (r - 128) + 128));
          g = Math.min(255, Math.max(0, contrastFactor * (g - 128) + 128));
          b = Math.min(255, Math.max(0, contrastFactor * (b - 128) + 128));
        }

        // Saturation
        if (saturation !== 100) {
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          r = Math.min(255, Math.max(0, gray + (r - gray) * satRatio));
          g = Math.min(255, Math.max(0, gray + (g - gray) * satRatio));
          b = Math.min(255, Math.max(0, gray + (b - gray) * satRatio));
        }

        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
      }

      ctx.putImageData(imgData, 0, 0);
    }

    // 4. Solid 1.5pt crisp black border around perimeter
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, targetW - 3, targetH - 3);

    return canvas.toDataURL("image/jpeg", 0.96);
  };

  const processFiles = async (fileList: File[]) => {
    if (!fileList || fileList.length === 0) return;

    setIsProcessingBg(true);
    setStatusMessage("جاري عزل وتبييض الخلفية وتأطير الصورة 4×6...");

    try {
      // Client-side WebAssembly background removal
      let removeBgFn: ((b: Blob) => Promise<Blob>) | null = null;
      try {
        const mod = await import("@imgly/background-removal");
        removeBgFn = mod.removeBackground;
      } catch {
        // Fallback
      }

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        setStatusMessage(`جاري تجهيز صورة (${i + 1} من ${fileList.length})...`);

        let processedBlob: Blob = file;
        let cutoutDataUrl: string | undefined = undefined;

        if (removeBgFn) {
          try {
            const bgPromise = removeBgFn(file);
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Timeout")), 6000)
            );
            processedBlob = await Promise.race([bgPromise, timeoutPromise]);
            cutoutDataUrl = await readFileAsDataURL(new File([processedBlob], file.name));
          } catch {
            processedBlob = file;
          }
        }

        const originalDataUrl = await readFileAsDataURL(file);

        // Frame to 40mm x 52mm studio standard with white background and pure client canvas
        const framedDataUrl = await enhanceAndFramePassportPhoto(processedBlob, {
          autoCompleteCropped: true,
          superResolution: true,
          preserveIdentity: true,
        });

        setPersons((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            name: file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
            imageDataUrl: framedDataUrl,
            originalDataUrl,
            cutoutDataUrl,
            brightness: 100,
            contrast: 100,
            saturation: 100,
            panX: 0,
            panY: 0,
            zoom: 1.0,
            rotation: 0,
            whiteBackground: true,
            includeName: globalIncludeName,
          },
        ]);
      }

      toast.success(
        "تم تجهيز وتأطير الصور بنجاح",
        `تمت معالجة وتأطير ${fileList.length} صورة شخصية بالكامل داخل المتصفح بمقاس 40×52 مم.`
      );
    } catch (err) {
      console.error("Passport photos process error:", err);
      toast.error("خطأ", "تعذر إكمال معالجة بعض الصور.");
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

  const removePerson = (id: string) => {
    setPersons((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePersonName = (id: string, name: string) => {
    setPersons((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name } : p))
    );
  };

  const togglePersonName = (id: string) => {
    setPersons((prev) =>
      prev.map((p) => (p.id === id ? { ...p, includeName: !p.includeName } : p))
    );
  };

  // Live adjustment of filters directly from person card
  const updatePersonFilter = async (
    id: string,
    updates: Partial<PhotoPerson>
  ) => {
    const target = persons.find((p) => p.id === id);
    if (!target) return;

    const merged = { ...target, ...updates };

    const newUrl = await renderFramedCanvas({
      imgSrc: merged.cutoutDataUrl || merged.originalDataUrl,
      panX: merged.panX,
      panY: merged.panY,
      zoom: merged.zoom,
      rotation: merged.rotation,
      brightness: merged.brightness,
      contrast: merged.contrast,
      saturation: merged.saturation,
      whiteBackground: merged.whiteBackground,
    });

    setPersons((curr) =>
      curr.map((p) => (p.id === id ? { ...merged, imageDataUrl: newUrl } : p))
    );
  };

  // Open 4x6 Biometric Crop & Framing modal
  const openFramingModal = (person: PhotoPerson) => {
    setFramingTarget(person);
    setPanX(person.panX || 0);
    setPanY(person.panY || 0);
    setZoom(person.zoom || 1.0);
    setFramingRotation(person.rotation || 0);
    setFramingBrightness(person.brightness || 100);
    setFramingContrast(person.contrast || 100);
    setFramingSaturation(person.saturation || 100);
    setFramingWhiteBg(person.whiteBackground ?? true);
  };

  const handleApplyFraming = async () => {
    if (!framingTarget) return;

    const newUrl = await renderFramedCanvas({
      imgSrc: framingTarget.cutoutDataUrl || framingTarget.originalDataUrl,
      panX,
      panY,
      zoom,
      rotation: framingRotation,
      brightness: framingBrightness,
      contrast: framingContrast,
      saturation: framingSaturation,
      whiteBackground: framingWhiteBg,
    });

    setPersons((curr) =>
      curr.map((p) =>
        p.id === framingTarget.id
          ? {
              ...p,
              imageDataUrl: newUrl,
              panX,
              panY,
              zoom,
              rotation: framingRotation,
              brightness: framingBrightness,
              contrast: framingContrast,
              saturation: framingSaturation,
              whiteBackground: framingWhiteBg,
            }
          : p
      )
    );

    setFramingTarget(null);
    toast.success("تم تأطير وحفظ الصورة بنجاح", "تم تثبيت الكادر 4×6 بالمقاسات البيومترية الدقيقة والألوان المعدلة.");
  };

  /**
   * Generates the High-Res Grid Sheet Canvas (4 photos on A6 or 9 photos on A5)
   * Exact photo size: 40mm x 52mm, 1.5 border, 18mm scissor cut gap / crop marks.
   */
  const generateGridCanvas = async (person: PhotoPerson, layoutCount: 4 | 9): Promise<string> => {
    const isA5 = layoutCount === 9;
    const pxPerMm = 11.811; // 300 DPI
    const sheetW = Math.round((isA5 ? 148 : 105) * pxPerMm);
    const sheetH = Math.round((isA5 ? 210 : 148) * pxPerMm);

    const canvas = document.createElement("canvas");
    canvas.width = sheetW;
    canvas.height = sheetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return person.imageDataUrl;

    // Pure white sheet
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, sheetW, sheetH);

    // Photo dimensions: exactly 40.0mm x 52.0mm
    const photoW = Math.round(40.0 * pxPerMm); // 472 px
    const photoH = Math.round(52.0 * pxPerMm); // 614 px

    // Desired gap between photos: 18mm
    const gap = Math.round(18.0 * pxPerMm); // ~213 px

    const cols = isA5 ? 3 : 2;
    const rows = isA5 ? 3 : 2;

    // Distribute with exact margins and 18mm scissor cutting space
    const actualGapX = isA5 ? Math.min(gap, Math.floor((sheetW - cols * photoW) / (cols - 1))) : gap;
    const actualGapY = isA5 ? Math.min(gap, Math.floor((sheetH - rows * photoH) / (rows - 1))) : gap;

    const startX = Math.max(0, Math.round((sheetW - (cols * photoW + (cols - 1) * actualGapX)) / 2));
    const startY = Math.max(0, Math.round((sheetH - (rows * photoH + (rows - 1) * actualGapY)) / 2));

    const img = new Image();
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.src = person.imageDataUrl;
    });

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * (photoW + actualGapX);
        const y = startY + r * (photoH + actualGapY);

        // Draw photo
        ctx.drawImage(img, x, y, photoW, photoH);

        // 1.5 border (solid black)
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x, y, photoW, photoH);

        // Corner tick marks (crop marks)
        const tickLen = Math.round(6 * pxPerMm);
        ctx.strokeStyle = "#888888";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        // Top-Left
        ctx.moveTo(x - tickLen, y); ctx.lineTo(x - 2, y);
        ctx.moveTo(x, y - tickLen); ctx.lineTo(x, y - 2);
        // Top-Right
        ctx.moveTo(x + photoW + 2, y); ctx.lineTo(x + photoW + tickLen, y);
        ctx.moveTo(x + photoW, y - tickLen); ctx.lineTo(x + photoW, y - 2);
        // Bottom-Left
        ctx.moveTo(x - tickLen, y + photoH); ctx.lineTo(x - 2, y + photoH);
        ctx.moveTo(x, y + photoH + 2); ctx.lineTo(x, y + photoH + tickLen);
        // Bottom-Right
        ctx.moveTo(x + photoW + 2, y + photoH); ctx.lineTo(x + photoW + tickLen, y + photoH);
        ctx.moveTo(x + photoW, y + photoH + 2); ctx.lineTo(x + photoW, y + photoH + tickLen);
        ctx.stroke();

        // Subtle scissor cut guide lines in the center of the 18mm gap
        if (c < cols - 1) {
          const midX = x + photoW + actualGapX / 2;
          ctx.setLineDash([6, 6]);
          ctx.strokeStyle = "#b8b8b8";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(midX, y - 5);
          ctx.lineTo(midX, y + photoH + 5);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (r < rows - 1) {
          const midY = y + photoH + actualGapY / 2;
          ctx.setLineDash([6, 6]);
          ctx.strokeStyle = "#b8b8b8";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x - 5, midY);
          ctx.lineTo(x + photoW + 5, midY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    return canvas.toDataURL("image/jpeg", 0.96);
  };

  // Open Sheet Preview Modal
  const openGridSheetModal = async (person: PhotoPerson, layoutCount: 4 | 9) => {
    const dataUrl = await generateGridCanvas(person, layoutCount);
    setGridPreview({ person, layoutCount, dataUrl });
  };

  const triggerDirectPrintGrid = () => {
    if (!gridPreview) return;
    const paper = gridPreview.layoutCount === 9 ? "A5" : "A6";
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.warning("يرجى السماح بالنوافذ المنبثقة للطباعة المباشرة");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <title>طباعة شبكة الصور الشخصية (${paper}) - Copy-Cat</title>
          <style>
            @page {
              size: ${paper} portrait;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            img {
              width: 100vw;
              height: 100vh;
              object-fit: contain;
            }
          </style>
        </head>
        <body>
          <img src="${gridPreview.dataUrl}" onload="window.print(); window.close();" />
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Export DOCX
  const handleExportDocx = async (layoutCount: 4 | 9) => {
    if (persons.length === 0) return;
    setIsGeneratingDocx(true);
    try {
      await generatePassportPhotosDocx(persons, layoutCount);
      toast.success(
        "تم تصدير ملف الوورد بنجاح",
        `تم تجهيز شبكة ${layoutCount} صور بمقاس 40×52 مم وإطار 1.5 ومسافات قص 18mm.`
      );
    } catch (err) {
      console.error("Docx generation error:", err);
      toast.error(
        "حدث خطأ أثناء إنشاء ملف الوورد",
        getFriendlyErrorMessage(err, "يرجى المحاولة مرة أخرى.")
      );
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-2">
            <Layers className="w-3.5 h-3.5" /> مصنع الصور الشخصية 4×6 والاستوديو الفوري
          </div>
          <h1 className="text-2xl font-black text-slate-900">
            تجهيز وقص وطباعة الصور الشخصية (40mm × 52mm)
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 leading-relaxed max-w-2xl">
            أداة قص ثابتة بنسبة 4:6، سلايدرز تحكم فوري في التفتيح والتباين والتشبع، تبييض الخلفية برمجياً عبر المتصفح، ورص الصور تلقائياً في شبكة 4 صور على ورقة A6 أو 9 صور على ورقة A5 مع مسافات قص 18mm وعلامات القص!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {persons.length > 0 && (
            <button
              onClick={() => setPersons([])}
              className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
            >
              مسح الكل
            </button>
          )}

          <button
            onClick={() => handleExportDocx(4)}
            disabled={persons.length === 0 || isGeneratingDocx}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-lg shadow-blue-600/30 transition disabled:opacity-50 cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>تصدير وورد (4 صور A6)</span>
          </button>

          <button
            onClick={() => handleExportDocx(9)}
            disabled={persons.length === 0 || isGeneratingDocx}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>تصدير وورد (9 صور A5)</span>
          </button>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed transition-all rounded-2xl p-8 sm:p-10 text-center cursor-pointer flex flex-col items-center justify-center gap-3 group ${
          isDragging
            ? "border-emerald-400 bg-emerald-950/20 scale-[1.01] shadow-2xl shadow-emerald-500/10"
            : "border-slate-200 hover:border-emerald-500/60 bg-slate-50 hover:bg-white"
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

        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
          <Upload className="w-7 h-7" />
        </div>

        <div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {isDragging ? "أفلت الصور الشخصية هنا الآن!" : "اضغط لرفع الصور الشخصية أو اسحبها وأفلتها هنا"}
          </h3>
          <p className="text-slate-500 text-xs">
            يتم عزل الخلفية وتبييضها وتأطير الصورة 4×6 فورياً داخل المتصفح بنسبة 100% دون خوادم سحابية
          </p>
        </div>
      </div>

      {isProcessingBg && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center gap-3 text-xs text-emerald-400 font-bold">
          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Persons Gallery */}
      {persons.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              تم تجهيز <strong className="text-slate-900 font-bold">{persons.length} شخصية</strong> بمقاس الاستوديو الدقيق (40mm × 52mm)
            </span>
            <span className="text-emerald-400 font-bold">
              إطار أسود 1.5pt • مسافات قص 18mm مع علامات القص لسهولة القص بالمقص
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {persons.map((person, index) => (
              <div
                key={person.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs space-y-4"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                    <span className="font-bold bg-slate-100 px-2.5 py-1 rounded-md text-emerald-400">
                      شخصية #{index + 1}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setPreviewModalUrl(person.imageDataUrl)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                        title="تكبير ومعاينة"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removePerson(person.id)}
                        className="p-1.5 text-rose-600 hover:text-rose-700 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Photo Display (40mm x 52mm aspect ratio) */}
                  <div className="aspect-[40/52] max-w-[200px] mx-auto bg-white rounded-xl overflow-hidden mb-3 border-2 border-slate-950 flex items-center justify-center p-0.5 shadow-lg relative">
                    <NextImage
                      src={person.imageDataUrl}
                      alt={person.name}
                      width={200}
                      height={260}
                      unoptimized
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Live Sliders: Brightness, Contrast, Saturation */}
                  <div className="space-y-2 bg-slate-50/70 p-3 rounded-2xl border border-slate-200 text-[11px]">
                    {/* Brightness */}
                    <div className="flex items-center gap-2">
                      <span className="w-14 text-slate-500 font-bold">التفتيح:</span>
                      <input
                        type="range"
                        min="50"
                        max="150"
                        value={person.brightness}
                        onChange={(e) =>
                          updatePersonFilter(person.id, { brightness: Number(e.target.value) })
                        }
                        className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-100 rounded-lg"
                      />
                      <span className="w-8 text-right font-mono text-slate-700">
                        {person.brightness}%
                      </span>
                    </div>

                    {/* Contrast */}
                    <div className="flex items-center gap-2">
                      <span className="w-14 text-slate-500 font-bold">التباين:</span>
                      <input
                        type="range"
                        min="50"
                        max="150"
                        value={person.contrast}
                        onChange={(e) =>
                          updatePersonFilter(person.id, { contrast: Number(e.target.value) })
                        }
                        className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-100 rounded-lg"
                      />
                      <span className="w-8 text-right font-mono text-slate-700">
                        {person.contrast}%
                      </span>
                    </div>

                    {/* Saturation */}
                    <div className="flex items-center gap-2">
                      <span className="w-14 text-slate-500 font-bold">التشبع:</span>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={person.saturation}
                        onChange={(e) =>
                          updatePersonFilter(person.id, { saturation: Number(e.target.value) })
                        }
                        className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-100 rounded-lg"
                      />
                      <span className="w-8 text-right font-mono text-slate-700">
                        {person.saturation}%
                      </span>
                    </div>
                  </div>

                  {/* 4:6 Crop / Framing Tool Button */}
                  <button
                    type="button"
                    onClick={() => openFramingModal(person)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-black border border-emerald-500/30 transition cursor-pointer shadow-sm"
                    title="قص وتأطير الرأس والأكتاف بنسبة أبعاد 4:6"
                  >
                    <Focus className="w-4 h-4" />
                    <span>أداة القص والتأطير 4:6 (Crop Tool)</span>
                  </button>

                  {/* Grid Print Buttons */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => openGridSheetModal(person, 4)}
                      className="py-1.5 px-2 rounded-xl bg-blue-950/40 hover:bg-blue-600 text-blue-300 hover:text-white text-[11px] font-bold border border-blue-900/50 transition cursor-pointer flex items-center justify-center gap-1"
                      title="معاينة وطباعة 4 صور على ورقة A6 مع مسافات قص 18mm"
                    >
                      <Printer className="w-3 h-3" />
                      <span>شبكة 4 صور (A6)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openGridSheetModal(person, 9)}
                      className="py-1.5 px-2 rounded-xl bg-emerald-950/40 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[11px] font-bold border border-emerald-900/50 transition cursor-pointer flex items-center justify-center gap-1"
                      title="معاينة وطباعة 9 صور على ورقة A5 مع مسافات قص 18mm"
                    >
                      <Printer className="w-3 h-3" />
                      <span>شبكة 9 صور (A5)</span>
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> مقاس 40 × 52 مم
                  </span>
                  <span>إطار 1.5pt • فراغ قص 18mm</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4x6 Biometric Crop & Framing Modal */}
      {framingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 max-w-xl w-full space-y-4 shadow-2xl relative max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Focus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    أداة قص وتأطير الصورة الشخصية (نسبة ثابتة 4:6)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    اسحب الصورة بالماوس لتوسيط الوجه بدقة، واضبط التكبير والتدوير والإضاءة
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFramingTarget(null)}
                className="text-slate-500 hover:text-slate-900 cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Framing Viewport with Biometric 4:6 Guidelines */}
            <div className="flex flex-col items-center">
              <div
                onPointerDown={handlePointerDownFraming}
                onPointerMove={handlePointerMoveFraming}
                onPointerUp={handlePointerUpFraming}
                className="w-64 sm:w-72 aspect-[40/52] bg-white border-2 border-slate-950 rounded-xl overflow-hidden shadow-2xl relative select-none touch-none cursor-grab active:cursor-grabbing flex items-center justify-center"
              >
                {/* Scaled & Panned Photo */}
                <div
                  style={{
                    transform: `translate(${panX}px, ${panY}px) rotate(${framingRotation}deg) scale(${zoom})`,
                    transformOrigin: "center center",
                    filter: `brightness(${framingBrightness}%) contrast(${framingContrast}%) saturate(${framingSaturation}%)`,
                  }}
                  className="w-full h-full flex items-center justify-center pointer-events-none"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={framingTarget.cutoutDataUrl || framingTarget.originalDataUrl}
                    alt="Framing Target"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>

                {/* SVG Biometric Guideline Grid */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {/* Vertical Center Symmetry Line */}
                  <line
                    x1="50%"
                    y1="0%"
                    x2="50%"
                    y2="100%"
                    stroke="rgba(6, 182, 212, 0.7)"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />

                  {/* Head Oval Silhouette Guide */}
                  <ellipse
                    cx="50%"
                    cy="40%"
                    rx="33%"
                    ry="31%"
                    fill="none"
                    stroke="rgba(16, 185, 129, 0.75)"
                    strokeWidth="2"
                    strokeDasharray="5 3"
                  />

                  {/* Crown guideline (8% from top) */}
                  <line
                    x1="15%"
                    y1="9%"
                    x2="85%"
                    y2="9%"
                    stroke="rgba(16, 185, 129, 0.85)"
                    strokeWidth="1.5"
                  />

                  {/* Eye line (42% from top) */}
                  <line
                    x1="20%"
                    y1="42%"
                    x2="80%"
                    y2="42%"
                    stroke="rgba(245, 158, 11, 0.85)"
                    strokeWidth="1.5"
                  />

                  {/* Chin line (70% from top) */}
                  <line
                    x1="25%"
                    y1="70%"
                    x2="75%"
                    y2="70%"
                    stroke="rgba(245, 158, 11, 0.85)"
                    strokeWidth="1.5"
                  />

                  {/* Upper shoulder guideline (86% from top) */}
                  <line
                    x1="5%"
                    y1="86%"
                    x2="95%"
                    y2="86%"
                    stroke="rgba(59, 130, 246, 0.85)"
                    strokeWidth="1.5"
                  />
                </svg>

                {/* Biometric labels inside viewport */}
                <span className="absolute top-1 right-2 text-[9px] font-bold text-emerald-700 bg-emerald-100/90 px-1 rounded pointer-events-none">
                  قمة الرأس
                </span>
                <span className="absolute top-[39%] right-2 text-[9px] font-bold text-amber-800 bg-amber-100/90 px-1 rounded pointer-events-none">
                  مستوى العينين
                </span>
                <span className="absolute top-[67%] right-2 text-[9px] font-bold text-amber-800 bg-amber-100/90 px-1 rounded pointer-events-none">
                  أسفل الذقن
                </span>
                <span className="absolute top-[83%] right-2 text-[9px] font-bold text-blue-800 bg-blue-100/90 px-1 rounded pointer-events-none">
                  الأكتاف
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 text-center">
                اسحب الصورة بالماوس داخل الكادر لتوسيط الوجه • نسبة الأبعاد محكومة بدقة 4:6 (40mm × 52mm)
              </p>
            </div>

            {/* Adjustments: Zoom, Rotation, Brightness, Contrast, Saturation */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">أدوات التحكم في الكادر والألوان:</span>
                <button
                  type="button"
                  onClick={() => {
                    setPanX(0);
                    setPanY(0);
                    setZoom(1.0);
                    setFramingRotation(0);
                    setFramingBrightness(100);
                    setFramingContrast(100);
                    setFramingSaturation(100);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-emerald-400 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>إعادة ضبط</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Zoom */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span className="flex items-center gap-1">
                      <ZoomIn className="w-3 h-3" /> نسبة التكبير:
                    </span>
                    <span className="text-emerald-400 font-mono font-bold">{Math.round(zoom * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.02"
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Rotation */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span className="flex items-center gap-1">
                      <RotateCw className="w-3 h-3" /> تدوير الصورة:
                    </span>
                    <span className="text-emerald-400 font-mono font-bold">
                      {framingRotation > 0 ? `+${framingRotation}` : framingRotation}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-25"
                    max="25"
                    step="1"
                    value={framingRotation}
                    onChange={(e) => setFramingRotation(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Brightness */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>التفتيح (Brightness):</span>
                    <span className="text-emerald-400 font-mono font-bold">{framingBrightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="150"
                    value={framingBrightness}
                    onChange={(e) => setFramingBrightness(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Contrast */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>التباين (Contrast):</span>
                    <span className="text-emerald-400 font-mono font-bold">{framingContrast}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="150"
                    value={framingContrast}
                    onChange={(e) => setFramingContrast(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Saturation */}
                <div className="sm:col-span-2">
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>التشبع اللوني (Saturation):</span>
                    <span className="text-emerald-400 font-mono font-bold">{framingSaturation}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={framingSaturation}
                    onChange={(e) => setFramingSaturation(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Background Whitening Toggle */}
              <label className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-emerald-500/40 transition">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-900">تبييض الخلفية تلقائياً (#FFFFFF)</span>
                </div>
                <input
                  type="checkbox"
                  checked={framingWhiteBg}
                  onChange={(e) => setFramingWhiteBg(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setFramingTarget(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleApplyFraming}
                className="flex-1 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5"
              >
                <Focus className="w-4 h-4" />
                <span>اعتماد الكادر والقص (Save 4x6)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid Sheet Print Preview Modal (4 on A6 or 9 on A5) */}
      {gridPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 max-w-2xl w-full space-y-4 shadow-2xl relative max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    معاينة شبكة {gridPreview.layoutCount} صور على ورقة {gridPreview.layoutCount === 9 ? "A5" : "A6"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    مقاس الصورة المطبوعة بالضبط: 40mm × 52mm • إطار 1.5pt • مسافات قص 18mm مع علامات القص
                  </p>
                </div>
              </div>
              <button
                onClick={() => setGridPreview(null)}
                className="text-slate-500 hover:text-slate-900 cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-center bg-slate-50 p-4 rounded-2xl border border-slate-200 min-h-[300px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={gridPreview.dataUrl}
                alt="Grid Sheet Preview"
                className="max-h-[60vh] object-contain rounded-lg shadow-2xl border border-slate-200 bg-white"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setGridPreview(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={triggerDirectPrintGrid}
                className="flex-1 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الشبكة الآن ({gridPreview.layoutCount === 9 ? "A5" : "A6"})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Size Preview Modal */}
      {previewModalUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl relative text-center">
            <button
              onClick={() => setPreviewModalUrl(null)}
              className="absolute top-4 left-4 p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-extrabold text-slate-900">معاينة تفاصيل الصورة الشخصية (40mm × 52mm)</h3>

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

            <p className="text-xs text-slate-500">
              خلفية بيضاء نقية، إطار أسود 1.5، ونسبة أبعاد 4:6 قياسية.
            </p>

            <button
              onClick={() => setPreviewModalUrl(null)}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs cursor-pointer transition"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
