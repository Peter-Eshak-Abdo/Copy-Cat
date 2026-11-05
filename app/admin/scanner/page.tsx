"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import NextImage from "next/image";
import { AnimatePresence, motion } from "motion/react";
import {
  Upload,
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
  Trash2,
  ImagePlus,
  Loader2,
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

interface FilterSettings {
  invert: boolean;
  cam: boolean;
  screen: boolean;
  brightness: number;
  contrast: number;
  sharpness: number;
}

/** What's happening right now, shown in the floating progress card */
interface BusyState {
  kind: "upload" | "adjust";
  label: string;
  done: number;
  total: number;
}

const DEFAULT_SETTINGS: FilterSettings = {
  invert: false,
  cam: true,
  screen: false,
  brightness: 110,
  contrast: 120,
  sharpness: 70,
};

// Big enough that a normal phone/WhatsApp photo keeps its own size
const MAX_DIM = 1800;
// Sliders wait this long after the hand stops before re-filtering every photo
const SLIDER_DELAY_MS = 350;

const PRESETS: Record<string, FilterSettings> = {
  // Black screen / dark report: a plain negative and nothing else (like an image viewer's "Invert")
  invert_screen: { invert: true, cam: false, screen: false, sharpness: 0, brightness: 100, contrast: 100 },
  // Requirement #13: Photos of computer screens taken by phone (Anti-Moire & clear text)
  screen_clarifier: { invert: false, cam: false, screen: true, sharpness: 100, brightness: 115, contrast: 135 },
  // For photographed notes / mobile camera papers
  camscanner: { invert: false, cam: true, screen: false, sharpness: 100, brightness: 110, contrast: 120 },
  // Sharpen only without bleaching
  sharp_only: { invert: false, cam: false, screen: false, sharpness: 100, brightness: 100, contrast: 115 },
  reset: { invert: false, cam: false, screen: false, sharpness: 0, brightness: 100, contrast: 100 },
};

/** Name of the work being done with these settings, for the loading card */
function operationLabel(s: FilterSettings): string {
  if (s.invert) return "بنقلب الألوان (الأسود يبقى أبيض)";
  if (s.cam) return "بنفتّح الورق ونبيّضه";
  if (s.screen) return "بنوضّح صورة الشاشة";
  if (s.sharpness > 0 || s.brightness !== 100 || s.contrast !== 100) return "بنوضّح الكلام";
  return "بنجهز الصور";
}

/** Let the browser paint (progress card, finished tiles) before the next heavy canvas job */
const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image failed to load"));
    img.src = src;
  });
}

function runFilter(img: HTMLImageElement, s: FilterSettings, rot: number): string {
  return processImageOnCanvas(img, {
    invert: s.invert,
    camScannerMode: s.cam,
    screenClarifierMode: s.screen,
    brightness: s.brightness,
    contrast: s.contrast,
    sharpness: s.sharpness,
    fineAngle: rot,
    maxDim: MAX_DIM,
  });
}

/** Floating card while photos are being received or re-filtered */
function BusyCard({ busy }: { busy: BusyState }) {
  const pct = busy.total > 0 ? Math.round((busy.done / busy.total) * 100) : 0;
  const current = Math.min(busy.done + 1, busy.total);
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,380px)] rounded-2xl bg-slate-900 text-white shadow-2xl shadow-slate-900/30 p-4"
      role="status"
      aria-live="polite"
      dir="rtl"
    >
      <div className="flex items-center gap-3.5">
        {/* A little page being scanned */}
        <div className="relative w-11 h-14 shrink-0 rounded-md bg-white overflow-hidden shadow-inner">
          <div className="absolute inset-x-1.5 top-2 space-y-1">
            {[100, 80, 92, 64, 86, 70].map((w, i) => (
              <div key={i} className="h-[3px] rounded-full bg-slate-300" style={{ width: `${w}%` }} />
            ))}
          </div>
          <motion.div
            className="absolute inset-x-0 h-3 bg-gradient-to-b from-amber-300/0 via-amber-400/80 to-amber-300/0"
            animate={{ top: ["-15%", "95%", "-15%"] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black">
            {busy.kind === "upload"
              ? `استلمنا ${busy.total} ${busy.total === 1 ? "صورة" : busy.total <= 10 ? "صور" : "صورة"}`
              : "بنطبق التعديل على الصور"}
          </p>
          <p className="text-xs text-slate-300 font-medium mt-0.5 truncate">
            {busy.label}… {busy.total > 1 ? `صورة ${current} من ${busy.total}` : ""}
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-white/15 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-l from-amber-300 to-amber-500"
              initial={false}
              animate={{ width: `${Math.max(6, pct)}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
        <span className="text-lg font-black tabular-nums text-amber-300 w-12 text-left">{pct}%</span>
      </div>
    </motion.div>
  );
}

export default function ScannerPage() {
  const { toast } = useToast();
  const [images, setImages] = useState<DocImage[]>([]);
  const [settings, setSettings] = useState<FilterSettings>(DEFAULT_SETTINGS);
  const { invert, screen: screenClarifierMode, brightness, contrast, sharpness } = settings;
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [activePreset, setActivePreset] = useState<string>("camscanner");
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState<BusyState | null>(null);
  // Tiles still showing the old filter while a new one is being applied
  const [staleIds, setStaleIds] = useState<Set<string>>(new Set());

  // Lightbox Modal state (Requirement #12)
  const [enlargedImage, setEnlargedImage] = useState<DocImage | null>(null);

  // Fine Rotation & Crop Modal state (Requirement #12)
  const [editingDoc, setEditingDoc] = useState<DocImage | null>(null);
  const [fineAngle, setFineAngle] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Latest values for the async loops below
  const imagesRef = useRef<DocImage[]>([]);
  const settingsRef = useRef<FilterSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  // Decoded originals, so a slider change doesn't decode every photo again
  const decodedRef = useRef(new Map<string, HTMLImageElement>());
  // A newer adjustment cancels the one still running
  const adjustGenRef = useRef(0);
  const adjustTimerRef = useRef<number | null>(null);
  // Uploads still in progress (so the adjust loop doesn't hide their card)
  const uploadingRef = useRef(0);

  const decoded = useCallback(async (item: Pick<DocImage, "id" | "originalSrc">) => {
    let img = decodedRef.current.get(item.id);
    if (!img) {
      img = await loadImage(item.originalSrc);
      decodedRef.current.set(item.id, img);
    }
    return img;
  }, []);

  useEffect(
    () => () => {
      if (adjustTimerRef.current !== null) window.clearTimeout(adjustTimerRef.current);
      adjustGenRef.current++;
    },
    []
  );

  const processFiles = async (fileList: File[]) => {
    if (!fileList || fileList.length === 0) return;
    const valid = fileList.filter((f) => f.type.startsWith("image/"));
    let invalidCount = fileList.length - valid.length;
    if (valid.length === 0) {
      toast.error("الملفات مفتحتش", "اختار صور بس (JPG أو PNG أو WebP).");
      return;
    }

    uploadingRef.current += 1;
    // Show the card right away, before the first photo is even read
    setBusy((prev) => ({
      kind: "upload",
      label: operationLabel(settingsRef.current),
      done: prev?.kind === "upload" ? prev.done : 0,
      total: (prev?.kind === "upload" ? prev.total : 0) + valid.length,
    }));
    await nextFrame();

    let added = 0;
    for (const file of valid) {
      try {
        const originalSrc = await readFileAsDataURL(file);
        const id = Math.random().toString(36).substring(2, 9);
        const img = await decoded({ id, originalSrc });
        const processedSrc = runFilter(img, settingsRef.current, 0);
        // Each photo shows up as soon as it's ready
        setImages((prev) => [...prev, { id, name: file.name, originalSrc, processedSrc, rotation: 0 }]);
        added++;
      } catch (err) {
        console.error(`Error loading image ${file.name}:`, err);
        invalidCount++;
      }
      setBusy((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
      await nextFrame();
    }

    uploadingRef.current -= 1;
    if (uploadingRef.current === 0) setBusy(null);

    if (added > 0) {
      toast.success(`ضفنا ${added} صورة`, invalidCount > 0 ? `سبنا ${invalidCount} ملف مفتحش.` : undefined);
    } else {
      toast.error("الملفات مفتحتش", "اختار صور بس (JPG أو PNG أو WebP).");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    e.target.value = "";
    await processFiles(list);
  };

  // Drag & Drop Handlers (Requirement #5 & #12)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Moving over a child element isn't leaving the drop area
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      await processFiles(Array.from(e.dataTransfer.files));
    }
  };

  /** Re-run the filter on every photo, one at a time so the page stays responsive */
  const reprocessAll = useCallback(
    async (s: FilterSettings) => {
      const gen = ++adjustGenRef.current;
      const list = imagesRef.current;
      if (list.length === 0) return;
      setStaleIds(new Set(list.map((i) => i.id)));
      if (uploadingRef.current === 0) {
        setBusy({ kind: "adjust", label: operationLabel(s), done: 0, total: list.length });
      }
      await nextFrame();

      for (let k = 0; k < list.length; k++) {
        if (gen !== adjustGenRef.current) return; // a newer change took over
        const item = list[k];
        try {
          const img = await decoded(item);
          if (gen !== adjustGenRef.current) return;
          const processedSrc = runFilter(img, s, item.rotation);
          setImages((prev) => prev.map((p) => (p.id === item.id ? { ...p, processedSrc } : p)));
        } catch (err) {
          console.error("Reprocess failed:", err);
        }
        setStaleIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        setBusy((prev) => (prev?.kind === "adjust" ? { ...prev, done: k + 1 } : prev));
        await nextFrame();
      }
      if (gen === adjustGenRef.current) setBusy((prev) => (prev?.kind === "adjust" ? null : prev));
    },
    [decoded]
  );

  /**
   * Change filter settings. Sliders wait until the hand stops moving (delay) so dragging stays smooth;
   * toggles and presets apply at once.
   */
  const updateSettings = (patch: Partial<FilterSettings>, delay = 0) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    if (adjustTimerRef.current !== null) window.clearTimeout(adjustTimerRef.current);
    adjustGenRef.current++; // stop a run that's using the old values
    if (imagesRef.current.length === 0) return;
    // Mark every photo as "being updated" right away so the change is visibly acknowledged
    setStaleIds(new Set(imagesRef.current.map((i) => i.id)));
    adjustTimerRef.current = window.setTimeout(() => {
      adjustTimerRef.current = null;
      reprocessAll(settingsRef.current);
    }, delay);
  };

  const clearAll = () => {
    adjustGenRef.current++;
    if (adjustTimerRef.current !== null) window.clearTimeout(adjustTimerRef.current);
    decodedRef.current.clear();
    setImages([]);
    setStaleIds(new Set());
    setBusy((prev) => (prev?.kind === "adjust" ? null : prev));
  };

  const removeImage = (id: string) => {
    decodedRef.current.delete(id);
    setImages((prev) => prev.filter((item) => item.id !== id));
  };

  const applyPreset = (presetName: string) => {
    const preset = PRESETS[presetName];
    if (!preset) return;
    setActivePreset(presetName);
    updateSettings(preset);
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
      toast.success("ملف ZIP نزل", `فيه ${images.length} صفحة.`);
    } catch (err) {
      console.error("ZIP Error:", err);
      toast.error(
        "ملف ZIP متعملش",
        getFriendlyErrorMessage(err, "ممكن الصور كبيرة أوي. جرب تاني بصور أقل.")
      );
    } finally {
      setIsExportingZip(false);
    }
  };

  // Fine Rotation Apply
  const handleApplyFineRotation = async () => {
    if (!editingDoc) return;
    const doc = editingDoc;
    const angle = fineAngle;
    setEditingDoc(null);
    setStaleIds((prev) => new Set(prev).add(doc.id));
    await nextFrame();
    try {
      const img = await decoded(doc);
      const newSrc = runFilter(img, settingsRef.current, angle);
      setImages((prev) =>
        prev.map((item) => (item.id === doc.id ? { ...item, rotation: angle, processedSrc: newSrc } : item))
      );
    } finally {
      setStaleIds((prev) => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    }
  };

  const pendingUploads = busy?.kind === "upload" ? Math.max(0, busy.total - busy.done) : 0;
  const hasImages = images.length > 0 || pendingUploads > 0;

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Top Action Bar */}
      {images.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-900">الصور اللي رفعتها:</span>
            <span className="text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-xl">
              {images.length} {images.length === 1 ? "صورة" : "صور"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-xs cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>+ ضيف صور</span>
            </button>

            <button
              onClick={handleDownloadAllSequential}
              disabled={isDownloadingAll || !!busy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 transition disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloadingAll ? "بننزل..." : "نزّل كل الصور"}</span>
            </button>

            <button
              onClick={handleDownloadZip}
              disabled={isExportingZip || !!busy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer"
            >
              <Archive className="w-4 h-4" />
              <span>{isExportingZip ? "بنجهز..." : "نزّل ZIP"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Preset Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-2.5">
        <span className="text-xs font-bold text-slate-500 ml-2">إعدادات جاهزة:</span>

        {/* Screen Clarifier Preset (Requirement #13) */}
        <button
          onClick={() => applyPreset("screen_clarifier")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activePreset === "screen_clarifier"
              ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-black"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Monitor className="w-3.5 h-3.5 text-cyan-300" />
          <span>صورة شاشة كمبيوتر</span>
        </button>

        <button
          onClick={() => applyPreset("invert_screen")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activePreset === "invert_screen"
              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>شاشة سودا (اقلبها أبيض)</span>
        </button>

        <button
          onClick={() => applyPreset("camscanner")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activePreset === "camscanner"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 font-black"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>ورقة متصورة (بيّضها)</span>
        </button>

        <button
          onClick={() => applyPreset("sharp_only")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activePreset === "sharp_only"
              ? "bg-emerald-600 text-white shadow-md font-black"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>وضّح الكلام بس</span>
        </button>

        <button
          onClick={() => applyPreset("reset")}
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition flex items-center gap-1.5 cursor-pointer mr-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>رجّع زي الأول</span>
        </button>
      </div>

      {/* Detailed Sliders & Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-center shadow-xs">
        {/* Invert Toggle */}
        <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div>
            <span className="text-xs font-bold text-slate-900 block">اقلب الألوان</span>
            <span className="text-[10px] text-amber-700 font-medium">الأسود يبقى أبيض</span>
          </div>
          <input
            type="checkbox"
            checked={invert}
            onChange={(e) => updateSettings({ invert: e.target.checked })}
            className="w-5 h-5 accent-amber-500 cursor-pointer"
          />
        </div>

        {/* Screen Clarifier Mode Toggle (Requirement #13) */}
        <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div>
            <span className="text-xs font-bold text-cyan-900 block">فلتر الشاشات</span>
            <span className="text-[10px] text-slate-500 font-medium">بيشيل التموجات اللي بتطلع في صورة الشاشة</span>
          </div>
          <input
            type="checkbox"
            checked={screenClarifierMode}
            onChange={(e) => updateSettings({ screen: e.target.checked })}
            className="w-5 h-5 accent-cyan-500 cursor-pointer"
          />
        </div>

        {/* Sharpness Slider */}
        <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="flex justify-between text-xs font-bold text-slate-900">
            <span>الحدة</span>
            <span className="text-amber-700 font-mono font-black">{sharpness}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="10"
            value={sharpness}
            onChange={(e) => updateSettings({ sharpness: Number(e.target.value) }, SLIDER_DELAY_MS)}
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>

        {/* Brightness Slider */}
        <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="flex justify-between text-xs font-bold text-slate-900">
            <span>الإضاءة</span>
            <span className="text-blue-700 font-mono font-black">{brightness}%</span>
          </div>
          <input
            type="range"
            min="60"
            max="160"
            value={brightness}
            onChange={(e) => updateSettings({ brightness: Number(e.target.value) }, SLIDER_DELAY_MS)}
            className="w-full accent-blue-600 cursor-pointer"
          />
        </div>

        {/* Contrast Slider */}
        <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="flex justify-between text-xs font-bold text-slate-900">
            <span>التباين</span>
            <span className="text-purple-700 font-mono font-black">{contrast}%</span>
          </div>
          <input
            type="range"
            min="60"
            max="160"
            value={contrast}
            onChange={(e) => updateSettings({ contrast: Number(e.target.value) }, SLIDER_DELAY_MS)}
            className="w-full accent-purple-600 cursor-pointer"
          />
        </div>
      </div>

      {/* Drop area: stays on the page after the first upload so more photos can be added any time */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="space-y-4"
      >
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed transition-all rounded-2xl text-center cursor-pointer flex items-center justify-center gap-3 group ${
            hasImages ? "flex-row p-4" : "flex-col p-8 sm:p-12"
          } ${
            isDragging
              ? "border-amber-400 bg-amber-50 scale-[1.01] shadow-2xl shadow-amber-500/10"
              : "border-slate-200 hover:border-amber-500/60 bg-slate-50 hover:bg-white"
          }`}
        >
          <div
            className={`rounded-2xl flex items-center justify-center transition-transform shrink-0 ${
              hasImages ? "w-10 h-10" : "w-16 h-16"
            } ${
              isDragging
                ? "scale-125 bg-amber-500 text-slate-950"
                : "bg-amber-500/10 text-amber-500 group-hover:scale-110"
            }`}
          >
            {hasImages ? <ImagePlus className="w-5 h-5" /> : <Upload className="w-8 h-8" />}
          </div>
          <div className={hasImages ? "text-right" : ""}>
            <span className={`font-bold text-slate-900 block ${hasImages ? "text-sm" : "text-base"}`}>
              {isDragging
                ? "سيب الصور هنا"
                : hasImages
                ? "عايز تضيف صور تانية؟ اسحبها هنا أو دوس واختارها"
                : "دوس هنا وارفع الصور، أو اسحبها وسيبها هنا"}
            </span>
            <span className="text-xs text-slate-500 mt-1 block">
              لحد 30 صورة مرة واحدة (JPG أو PNG أو WEBP)، والشغل كله على الجهاز
            </span>
          </div>
        </div>

        {/* Processed Images Gallery Grid (Requirements #6, #7, #9) */}
        {hasImages && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-slate-500">
                <span className="font-bold text-slate-700">{images.length} صورة جاهزين</span>
                <span className="text-amber-500 font-semibold">
                  دوس على أي صورة عشان تكبرها وتشوف الكلام واضح ولا لأ
                </span>
              </div>
              <button
                onClick={clearAll}
                disabled={images.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>امسح كل الصور</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {images.map((img, index) => {
                const stale = staleIds.has(img.id);
                return (
                  <motion.div
                    key={img.id}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25 }}
                    className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl overflow-hidden p-2.5 flex flex-col justify-between shadow-xs relative group transition-colors"
                  >
                    {/* Delete 'X' Button Overlay */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(img.id);
                      }}
                      className="absolute top-3 left-3 z-20 w-6 h-6 rounded-full bg-red-600/90 hover:bg-red-500 text-white flex items-center justify-center shadow-md transition-transform hover:scale-110 cursor-pointer"
                      title="امسح الصورة دي"
                    >
                      <X className="w-3.5 h-3.5 stroke-[3]" />
                    </button>

                    {/* Compact Image Container fitting horizontal / landscape documents (Requirement #6) */}
                    <div
                      onClick={() => setEnlargedImage(img)}
                      className="relative h-32 sm:h-36 w-full bg-slate-50 rounded-xl overflow-hidden mb-2 border border-slate-200 flex items-center justify-center cursor-zoom-in group/img p-1"
                      title="كبّر الصورة"
                    >
                      <NextImage
                        src={img.processedSrc}
                        alt={img.name}
                        width={400}
                        height={400}
                        unoptimized
                        className={`max-w-full max-h-full object-contain transition-all group-hover/img:scale-105 ${
                          stale ? "opacity-40 blur-[1px]" : ""
                        }`}
                      />

                      {/* Page indicator badge */}
                      <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-white/90 text-slate-900 font-mono text-[9px] font-bold border border-slate-200 shadow-2xs backdrop-blur-xs">
                        #{index + 1}
                      </span>

                      {stale ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                          <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                          <span className="text-[10px] font-black text-slate-700 bg-white/85 rounded px-1.5 py-0.5">
                            بنعدّلها...
                          </span>
                        </div>
                      ) : (
                        /* Hover enlarge overlay */
                        <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="px-2 py-1 rounded-lg bg-white/95 text-slate-900 text-[11px] font-bold flex items-center gap-1 shadow-sm">
                            <Maximize2 className="w-3 h-3 text-blue-600" />
                            كبّر
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Footer Controls for each image */}
                    <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] text-slate-700 font-medium truncate max-w-[100px]" title={img.name}>
                          {img.name}
                        </span>

                        {/* Fine Rotation / Crop Tool Button */}
                        <button
                          onClick={() => {
                            setEditingDoc(img);
                            setFineAngle(img.rotation || 0);
                          }}
                          className="p-1 text-slate-600 hover:text-blue-600 rounded-md hover:bg-slate-100 transition flex items-center gap-0.5 text-[10px] font-bold cursor-pointer"
                          title="لف الصورة"
                        >
                          <RotateCw className="w-3 h-3 text-blue-500" />
                          <span>لف</span>
                        </button>
                      </div>

                      {/* Dedicated Vivid Download Button (Requirement #7) */}
                      <button
                        onClick={() => handleDownloadSingleImage(img, index)}
                        disabled={stale}
                        className="w-full py-1.5 px-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>نزّل الصورة</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}

              {/* Photos received but not ready yet */}
              {Array.from({ length: pendingUploads }, (_, k) => (
                <div
                  key={`pending-${k}`}
                  className="bg-white border border-dashed border-amber-300 rounded-2xl p-2.5 flex flex-col gap-2"
                >
                  <div className="relative h-32 sm:h-36 w-full rounded-xl overflow-hidden bg-slate-100">
                    <motion.div
                      className="absolute inset-y-0 w-1/2 bg-gradient-to-l from-transparent via-white/80 to-transparent"
                      animate={{ left: ["-50%", "100%"] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: "linear", delay: k * 0.08 }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-slate-500">
                      {k === 0 ? "بنجهزها دلوقتي..." : "مستنية دورها"}
                    </span>
                  </div>
                  <div className="h-3 w-2/3 rounded bg-slate-100" />
                  <div className="h-7 rounded-xl bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>{busy && <BusyCard busy={busy} />}</AnimatePresence>

      {/* Lightbox Modal (Click to Enlarge - Requirement #12) */}
      {enlargedImage && (
        <div
          onClick={() => setEnlargedImage(null)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl w-full max-h-[92vh] bg-white border border-slate-200 rounded-2xl p-5 shadow-2xl flex flex-col justify-between cursor-default"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-slate-900">{enlargedImage.name} </span>
              </div>
              <button
                onClick={() => setEnlargedImage(null)}
                className="p-1 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 flex-1 overflow-auto max-h-[70vh] flex items-center justify-center bg-slate-50 rounded-2xl p-2 border border-slate-200">
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
              <span className="text-xs text-slate-500">
                شوف الكلام بقى واضح ولا لأ
              </span>
              <button
                onClick={() =>
                  handleDownloadSingleImage(
                    enlargedImage,
                    Math.max(0, images.findIndex((i) => i.id === enlargedImage.id))
                  )
                }
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span>نزّل الصورة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fine-Angle Rotation Modal (Requirement #12) */}
      {editingDoc && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <RotateCw className="w-4 h-4 text-amber-400" />
                <h3 className="text-base font-black text-slate-900">لف الصورة</h3>
              </div>
              <button
                onClick={() => setEditingDoc(null)}
                className="text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-[4/3] bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center p-2">
              <NextImage
                src={editingDoc.processedSrc}
                alt="Preview"
                width={600}
                height={450}
                unoptimized
                style={{ transform: `rotate(${fineAngle - (editingDoc.rotation || 0)}deg)` }}
                className="max-w-full max-h-full object-contain transition-transform"
              />
            </div>

            {/* Slider for exact degrees */}
            <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>الزاوية:</span>
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
                  className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  -90° شمال
                </button>
                <button
                  onClick={() => setFineAngle(0)}
                  className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs transition cursor-pointer"
                >
                  من غير لف (0°)
                </button>
                <button
                  onClick={() => setFineAngle((prev) => (prev + 90) % 360)}
                  className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  +90° يمين
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleApplyFineRotation}
                className="flex-1 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-white transition cursor-pointer shadow-lg shadow-amber-500/20"
              >
                لف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
