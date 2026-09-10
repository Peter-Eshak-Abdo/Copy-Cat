"use client";

import { useState, useRef } from "react";
import NextImage from "next/image";
import {
  Upload,
  FileDown,
  Trash2,
  RotateCw,
  Sparkles,
  Layers,
  CheckCircle2,
  ArrowUpDown,
  Zap,
  ChevronUp,
  ChevronDown,
  X,
  RotateCcw,
  Scissors,
  ShieldCheck,
  Maximize2,
  Wand2,
  Scan,
  Compass,
} from "lucide-react";
import { generateIdCardsDocx } from "@/lib/docx/id-cards-docx";
import { processImageOnCanvas, CropRect, QuadCorners, Point2D } from "@/lib/canvas-filters";
import { useToast } from "@/components/toast-provider";
import { readFileAsDataURL, getFriendlyErrorMessage } from "@/lib/utils";

interface CardSide {
  id: string;
  name: string;
  originalSrc: string;
  processedSrc: string;
  rotation: number;
  brightness: number;
  contrast: number;
  sharpness: number;
  sideType: "front" | "back";
  crop?: CropRect;
  quad?: QuadCorners;
  camScannerMode?: boolean;
}

interface CardPair {
  pairId: string;
  cardName: string;
  front: CardSide | null;
  back: CardSide | null;
}

export default function IdCardsPage() {
  const { toast } = useToast();
  const [pairs, setPairs] = useState<CardPair[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [globalSharpness, setGlobalSharpness] = useState(50);
  const [globalBrightness, setGlobalBrightness] = useState(118);
  const [isDragging, setIsDragging] = useState(false);

  // Modal for fine-angle rotation
  const [editingTarget, setEditingTarget] = useState<{
    pairId: string;
    side: "front" | "back";
    cardSide: CardSide;
  } | null>(null);
  const [fineAngle, setFineAngle] = useState(0);

  // Modal for CamScanner Pro 4-Corner Quad Cropping & Perspective Warp
  const [cropTarget, setCropTarget] = useState<{
    pairId: string;
    side: "front" | "back";
    cardSide: CardSide;
  } | null>(null);

  const [quadCorners, setQuadCorners] = useState<QuadCorners>({
    tl: { x: 0.05, y: 0.08 },
    tr: { x: 0.95, y: 0.08 },
    br: { x: 0.95, y: 0.92 },
    bl: { x: 0.05, y: 0.92 },
  });
  const [cropCamScannerMode, setCropCamScannerMode] = useState<boolean>(true);
  const [activeCornerDrag, setActiveCornerDrag] = useState<"tl" | "tr" | "br" | "bl" | null>(null);
  const [loupePoint, setLoupePoint] = useState<Point2D | null>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCornerPointerDown = (
    corner: "tl" | "tr" | "br" | "bl",
    e: React.PointerEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // fallback
    }
    setActiveCornerDrag(corner);
    setLoupePoint(quadCorners[corner]);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeCornerDrag || !cropContainerRef.current) return;
    const rect = cropContainerRef.current.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / rect.width;
    const rawY = (e.clientY - rect.top) / rect.height;
    const clampedX = Math.max(0, Math.min(1, Math.round(rawX * 1000) / 1000));
    const clampedY = Math.max(0, Math.min(1, Math.round(rawY * 1000) / 1000));

    const newPt = { x: clampedX, y: clampedY };
    setQuadCorners((prev) => ({ ...prev, [activeCornerDrag]: newPt }));
    setLoupePoint(newPt);
  };

  const handlePointerUp = () => {
    if (activeCornerDrag) {
      setActiveCornerDrag(null);
      setLoupePoint(null);
    }
  };

  const processSideImage = (
    src: string,
    b = globalBrightness,
    c = 105,
    sh = globalSharpness,
    rot = 0,
    crop?: CropRect,
    quad?: QuadCorners,
    camScannerMode?: boolean
  ): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        const res = processImageOnCanvas(img, {
          brightness: b,
          contrast: c,
          sharpness: sh,
          fineAngle: rot,
          preserveColors: true, // 100% Color-Safe HSL lightening
          crop,
          quad,
          camScannerMode,
        });
        resolve(res);
      };
    });
  };

  const processFiles = async (fileList: File[]) => {
    if (!fileList || fileList.length === 0) return;

    const loadedSides: CardSide[] = [];
    let invalidCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.type.startsWith("image/")) {
        invalidCount++;
        continue;
      }

      try {
        const originalSrc = await readFileAsDataURL(file);
        const processedSrc = await processSideImage(originalSrc);

        loadedSides.push({
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          originalSrc,
          processedSrc,
          rotation: 0,
          brightness: globalBrightness,
          contrast: 105,
          sharpness: globalSharpness,
          sideType: i % 2 === 0 ? "front" : "back",
        });
      } catch (err) {
        console.error(`Error reading card image ${file.name}:`, err);
        invalidCount++;
      }
    }

    // Pair up consecutively
    const newPairs: CardPair[] = [];
    for (let i = 0; i < loadedSides.length; i += 2) {
      const front = loadedSides[i] || null;
      const back = loadedSides[i + 1] || null;
      const pairIndex = Math.floor(i / 2) + 1;

      newPairs.push({
        pairId: Math.random().toString(36).substring(2, 9),
        cardName: `بطاقة رقم ${pairs.length + pairIndex}`,
        front,
        back,
      });
    }

    setPairs((prev) => [...prev, ...newPairs]);

    if (newPairs.length > 0) {
      toast.success(
        "تم استيراد صور البطاقات وتفتيحها بنجاح",
        `تمت إضافة ${loadedSides.length} وجه (${newPairs.length} بطاقة) مع حفظ الألوان الطبيعية ونقاء الأرقام.`
      );
    }
    if (invalidCount > 0) {
      toast.warning("تنبيه", `تم تخطي ${invalidCount} ملفات غير صالحة.`);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(Array.from(files));
  };

  // Drag & drop
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

  // Reordering pairs
  const movePair = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pairs.length) return;

    const newPairs = [...pairs];
    const temp = newPairs[index];
    newPairs[index] = newPairs[targetIndex];
    newPairs[targetIndex] = temp;
    setPairs(newPairs);
  };

  const removePair = (pairId: string) => {
    setPairs((prev) => prev.filter((p) => p.pairId !== pairId));
  };

  const updateCardName = (pairId: string, name: string) => {
    setPairs((prev) =>
      prev.map((p) => (p.pairId === pairId ? { ...p, cardName: name } : p))
    );
  };

  // Swap front and back of a pair
  const swapPairSides = (pairId: string) => {
    setPairs((prev) =>
      prev.map((p) => {
        if (p.pairId !== pairId) return p;
        return {
          ...p,
          front: p.back ? { ...p.back, sideType: "front" } : null,
          back: p.front ? { ...p.front, sideType: "back" } : null,
        };
      })
    );
  };

  // Adjust brightness/contrast per side
  const adjustSideValue = async (
    pairId: string,
    side: "front" | "back",
    bDelta: number,
    cDelta: number
  ) => {
    const pair = pairs.find((p) => p.pairId === pairId);
    const target = pair ? pair[side] : null;
    if (!target) return;

    const newB = Math.max(50, Math.min(180, target.brightness + bDelta));
    const newC = Math.max(80, Math.min(160, target.contrast + cDelta));

    const newSrc = await processSideImage(
      target.originalSrc,
      newB,
      newC,
      target.sharpness,
      target.rotation,
      target.crop,
      target.quad,
      target.camScannerMode
    );

    setPairs((curr) =>
      curr.map((p) => {
        if (p.pairId !== pairId) return p;
        return {
          ...p,
          [side]: {
            ...target,
            brightness: newB,
            contrast: newC,
            processedSrc: newSrc,
          },
        };
      })
    );
  };

  // Reset side to original
  const resetSide = async (pairId: string, side: "front" | "back") => {
    const pair = pairs.find((p) => p.pairId === pairId);
    const target = pair ? pair[side] : null;
    if (!target) return;

    const newSrc = await processSideImage(target.originalSrc, 100, 100, 0, 0, undefined, undefined, false);

    setPairs((curr) =>
      curr.map((p) => {
        if (p.pairId !== pairId) return p;
        return {
          ...p,
          [side]: {
            ...target,
            brightness: 100,
            contrast: 100,
            sharpness: 0,
            rotation: 0,
            crop: undefined,
            quad: undefined,
            camScannerMode: false,
            processedSrc: newSrc,
          },
        };
      })
    );
  };

  // 1-Click CamScanner Magic Mode toggle
  const toggleSideCamScanner = async (pairId: string, side: "front" | "back") => {
    const pair = pairs.find((p) => p.pairId === pairId);
    const target = pair ? pair[side] : null;
    if (!target) return;

    const newMode = !target.camScannerMode;
    const newSrc = await processSideImage(
      target.originalSrc,
      target.brightness,
      target.contrast,
      target.sharpness,
      target.rotation,
      target.crop,
      target.quad,
      newMode
    );

    setPairs((curr) =>
      curr.map((p) => {
        if (p.pairId !== pairId) return p;
        return {
          ...p,
          [side]: {
            ...target,
            camScannerMode: newMode,
            processedSrc: newSrc,
          },
        };
      })
    );
    toast.success(
      newMode ? "تم تفعيل سحر كام سكانر ✨" : "تم إلغاء سحر كام سكانر",
      newMode ? "تم تبييض أرضية البطاقة وإبراز سواد الأرقام والحبر بوضوح تام." : "تمت العودة للألوان الطبيعية."
    );
  };

  // Global Presets with color-preservation
  const applyGlobalEnhancement = async (sh: number, b: number) => {
    setGlobalSharpness(sh);
    setGlobalBrightness(b);

    const updated = await Promise.all(
      pairs.map(async (p) => {
        let newFront = p.front;
        let newBack = p.back;

        if (p.front) {
          const frontSrc = await processSideImage(
            p.front.originalSrc,
            b,
            105,
            sh,
            p.front.rotation,
            p.front.crop,
            p.front.quad,
            p.front.camScannerMode
          );
          newFront = { ...p.front, processedSrc: frontSrc, sharpness: sh, brightness: b };
        }
        if (p.back) {
          const backSrc = await processSideImage(
            p.back.originalSrc,
            b,
            105,
            sh,
            p.back.rotation,
            p.back.crop,
            p.back.quad,
            p.back.camScannerMode
          );
          newBack = { ...p.back, processedSrc: backSrc, sharpness: sh, brightness: b };
        }

        return { ...p, front: newFront, back: newBack };
      })
    );

    setPairs(updated);
    toast.success("تم تطبيق التفتيح العام", "تم حفظ نقاء الألوان وسواد الأرقام في كافة البطاقات.");
  };

  // Apply fine rotation from modal
  const handleApplyFineRotation = async () => {
    if (!editingTarget) return;
    const { pairId, side, cardSide } = editingTarget;

    const newSrc = await processSideImage(
      cardSide.originalSrc,
      cardSide.brightness,
      cardSide.contrast,
      cardSide.sharpness,
      fineAngle,
      cardSide.crop,
      cardSide.quad,
      cardSide.camScannerMode
    );

    setPairs((curr) =>
      curr.map((item) => {
        if (item.pairId !== pairId) return item;
        return {
          ...item,
          [side]: { ...cardSide, rotation: fineAngle, processedSrc: newSrc },
        };
      })
    );

    setEditingTarget(null);
  };

  // Apply CamScanner Pro 4-Corner Quad Crop & Warp
  const handleApplyCrop = async () => {
    if (!cropTarget) return;
    const { pairId, side, cardSide } = cropTarget;

    const newSrc = await processSideImage(
      cardSide.originalSrc,
      cardSide.brightness,
      cardSide.contrast,
      cardSide.sharpness,
      cardSide.rotation,
      undefined,
      quadCorners,
      cropCamScannerMode
    );

    setPairs((curr) =>
      curr.map((item) => {
        if (item.pairId !== pairId) return item;
        return {
          ...item,
          [side]: {
            ...cardSide,
            quad: quadCorners,
            camScannerMode: cropCamScannerMode,
            processedSrc: newSrc,
          },
        };
      })
    );

    setCropTarget(null);
    toast.success("تم قص وتعديل المنظور بنجاح", "تمت محاذاة أركان البطاقة الأربعة وتحويلها لكادر مستوي قياسي بجودة فائقة.");
  };

  const handleExportWord = async () => {
    if (pairs.length === 0) return;
    setIsGenerating(true);
    try {
      const imagesInOrder: string[] = [];

      pairs.forEach((p) => {
        if (p.front) imagesInOrder.push(p.front.processedSrc);
        if (p.back) imagesInOrder.push(p.back.processedSrc);
      });

      await generateIdCardsDocx(imagesInOrder, "CopyCat_ID_Cards_A5.docx");
      toast.success(
        "تم تصدير ملف الوورد بنجاح",
        `تم تجهيز ${imagesInOrder.length} وجه في ملف CopyCat_ID_Cards_A5.docx جاهز للطباعة فوراً.`
      );
    } catch (err) {
      console.error("Error generating docx:", err);
      toast.error(
        "حدث خطأ أثناء إنشاء ملف الوورد",
        getFriendlyErrorMessage(err, "يرجى المحاولة مرة أخرى.")
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const totalFacesCount = pairs.reduce(
    (acc, curr) => acc + (curr.front ? 1 : 0) + (curr.back ? 1 : 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-2">
            <Layers className="w-3.5 h-3.5" /> مصنع بطاقات الرقم القومي A5 (وش وضهر 9 سم)
          </div>
          <h1 className="text-2xl font-black text-white">
            تجهيز وقص وطباعة بطاقات الرقم القومي الفورية A5
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed max-w-2xl">
            أداة قص دقيقة لحواف البطاقات، وتفتيح لوني متطور (HSL) يحافظ على الألوان الطبيعية وسواد الأرقام بدون بهتان أو تشويش، مع تدوير دقيق وتصدير مقاس A5 حقيقي للتسليف والطباعة الفورية!
          </p>
        </div>

        <div className="flex items-center gap-3">
          {pairs.length > 0 && (
            <button
              onClick={() => setPairs([])}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-red-950/40 text-red-400 hover:bg-red-900/50 border border-red-900/50 transition cursor-pointer"
            >
              مسح الكل
            </button>
          )}

          <button
            onClick={handleExportWord}
            disabled={pairs.length === 0 || isGenerating}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-blue-600/30 transition disabled:opacity-50 cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>{isGenerating ? "جاري إنشاء ملف الوورد..." : "تصدير الوورد A5"}</span>
          </button>
        </div>
      </div>

      {/* Global Presets with Color-Preservation Badge (Point 4 in edits2.0.md) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300">نظام التفتيح اللوني وحفظ الألوان:</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> حفظ الألوان الطبيعية 100%
            </span>
          </div>
          <span className="text-xs text-slate-500">
            العرض المعتمد لكل بطاقة: 9.0 سم (مقاس التسليف القياسي)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => applyGlobalEnhancement(50, 118)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              globalBrightness === 118
                ? "bg-blue-600 text-white shadow-md font-black"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>تفتيح متوازن مع حفظ الألوان (الموصى به للبطاقات)</span>
          </button>

          <button
            onClick={() => applyGlobalEnhancement(70, 132)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              globalBrightness === 132
                ? "bg-cyan-600 text-white shadow-md font-black"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-yellow-300" />
            <span>تفتيح فائق للبطاقات المظلمة جداً</span>
          </button>

          <button
            onClick={() => applyGlobalEnhancement(0, 100)}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer mr-auto"
          >
            إعادة ضبط للأصل
          </button>
        </div>
      </div>

      {/* Upload Box with Drag & Drop */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed transition-all rounded-3xl p-8 sm:p-12 text-center cursor-pointer flex flex-col items-center justify-center gap-3 group ${
          isDragging
            ? "border-blue-400 bg-blue-950/20 scale-[1.01] shadow-2xl shadow-blue-500/10"
            : "border-slate-800 hover:border-blue-500/60 bg-slate-900/50 hover:bg-slate-900"
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

        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
          <Upload className="w-8 h-8" />
        </div>

        <div>
          <h3 className="text-base sm:text-lg font-bold text-white mb-1">
            {isDragging ? "أفلت صور البطاقات هنا الآن!" : "اضغط هنا لرفع صور البطاقات أو اسحبها وأفلتها مباشرة (Drag & Drop)"}
          </h3>
          <p className="text-slate-400 text-xs sm:text-sm">
            يمكنك رفع الوش والضهر معاً، وسيقوم النظام بتجميع كل وجهين متتاليين في بطاقة واحدة تلقائياً
          </p>
        </div>
      </div>

      {/* Pairs Container */}
      {pairs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              تم تجميع <strong className="text-white font-bold">{pairs.length} بطاقات</strong> (إجمالي {totalFacesCount} وجه وظفر جاهز للطباعة)
            </span>
            <span className="text-blue-400 font-bold">
              الوجه الأول = وش البطاقة • الوجه الثاني = ضهر البطاقة
            </span>
          </div>

          <div className="space-y-4">
            {pairs.map((pair, index) => (
              <div
                key={pair.pairId}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4 transition-all"
              >
                {/* Pair Top Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 font-black text-xs flex items-center justify-center border border-blue-500/30">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={pair.cardName}
                      onChange={(e) => updateCardName(pair.pairId, e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1 text-xs font-bold text-white focus:border-blue-500 focus:outline-none w-48"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Reorder Buttons */}
                    <button
                      onClick={() => movePair(index, "up")}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition disabled:opacity-30 cursor-pointer"
                      title="نقل البطاقة لأعلى"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => movePair(index, "down")}
                      disabled={index === pairs.length - 1}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition disabled:opacity-30 cursor-pointer"
                      title="نقل البطاقة لأسفل"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {/* Swap Front / Back */}
                    <button
                      onClick={() => swapPairSides(pair.pairId)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-blue-600 transition text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="تبديل الوش مكان الضهر"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      <span>تبديل الوش والضهر</span>
                    </button>

                    {/* Delete Pair */}
                    <button
                      onClick={() => removePair(pair.pairId)}
                      className="p-1.5 rounded-lg bg-red-950/40 text-red-400 hover:bg-red-900/50 hover:text-red-300 transition cursor-pointer"
                      title="حذف هذه البطاقة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Two Sides Grid (Front & Back) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Front Side */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-blue-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-blue-400" />
                        <span>الوش (صفحة 1)</span>
                      </span>

                      {pair.front && (
                        <div className="flex items-center gap-1.5">
                          {/* CamScanner Magic Mode Button */}
                          <button
                            onClick={() => toggleSideCamScanner(pair.pairId, "front")}
                            className={`px-2 py-1 text-[11px] rounded-lg transition flex items-center gap-1 cursor-pointer font-bold ${
                              pair.front?.camScannerMode
                                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                                : "bg-slate-800 text-amber-300 hover:bg-slate-700"
                            }`}
                            title="سحر كام سكانر: تبييض الأرضية وإبراز سواد أرقام البطاقة"
                          >
                            <Wand2 className="w-3 h-3" />
                            <span>سحر كام سكانر</span>
                          </button>

                          {/* 4-Corner Quad Crop Button */}
                          <button
                            onClick={() => {
                              setCropTarget({
                                pairId: pair.pairId,
                                side: "front",
                                cardSide: pair.front!,
                              });
                              setQuadCorners(
                                pair.front?.quad || {
                                  tl: { x: 0.05, y: 0.08 },
                                  tr: { x: 0.95, y: 0.08 },
                                  br: { x: 0.95, y: 0.92 },
                                  bl: { x: 0.05, y: 0.92 },
                                }
                              );
                              setCropCamScannerMode(pair.front?.camScannerMode ?? true);
                            }}
                            className="px-2.5 py-1 text-[11px] text-blue-400 hover:text-white rounded-lg bg-slate-800 hover:bg-blue-600 transition flex items-center gap-1 cursor-pointer font-bold"
                            title="قص وتعديل منظور الأركان الأربعة (CamScanner Pro)"
                          >
                            <Scan className="w-3 h-3" />
                            <span>قص 4 أركان</span>
                          </button>

                          {/* Fine Rotation Button */}
                          <button
                            onClick={() => {
                              setEditingTarget({
                                pairId: pair.pairId,
                                side: "front",
                                cardSide: pair.front!,
                              });
                              setFineAngle(pair.front?.rotation || 0);
                            }}
                            className="px-2 py-1 text-[11px] text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1 cursor-pointer font-bold"
                            title="تدوير وضبط بزوايا دقيقة"
                          >
                            <RotateCw className="w-3 h-3" />
                            <span>تدوير</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="aspect-[8.6/5.4] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center p-1.5 relative">
                      {pair.front ? (
                        <NextImage
                          src={pair.front.processedSrc}
                          alt="Front face"
                          width={400}
                          height={250}
                          unoptimized
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-slate-600">غير متوفر</span>
                      )}
                    </div>

                    {/* Per-Side Controls */}
                    {pair.front && (
                      <div className="flex items-center justify-between bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 text-[11px]">
                        <span className="text-slate-400 font-bold mr-1">تعديل الوش:</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => adjustSideValue(pair.pairId, "front", 12, 5)}
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white transition cursor-pointer font-bold"
                            title="تفتيح هذا الوجه"
                          >
                            تفتيح +
                          </button>
                          <button
                            onClick={() => adjustSideValue(pair.pairId, "front", -12, -5)}
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer font-bold"
                            title="تغميق هذا الوجه"
                          >
                            تغميق -
                          </button>
                          <button
                            onClick={() => resetSide(pair.pairId, "front")}
                            className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                            title="إعادة ضبط للأصل"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Back Side */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>الضهر (صفحة 2)</span>
                      </span>

                      {pair.back && (
                        <div className="flex items-center gap-1.5">
                          {/* CamScanner Magic Mode Button */}
                          <button
                            onClick={() => toggleSideCamScanner(pair.pairId, "back")}
                            className={`px-2 py-1 text-[11px] rounded-lg transition flex items-center gap-1 cursor-pointer font-bold ${
                              pair.back?.camScannerMode
                                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                                : "bg-slate-800 text-emerald-300 hover:bg-slate-700"
                            }`}
                            title="سحر كام سكانر: تبييض الأرضية وإبراز سواد أرقام البطاقة"
                          >
                            <Wand2 className="w-3 h-3" />
                            <span>سحر كام سكانر</span>
                          </button>

                          {/* 4-Corner Quad Crop Button */}
                          <button
                            onClick={() => {
                              setCropTarget({
                                pairId: pair.pairId,
                                side: "back",
                                cardSide: pair.back!,
                              });
                              setQuadCorners(
                                pair.back?.quad || {
                                  tl: { x: 0.05, y: 0.08 },
                                  tr: { x: 0.95, y: 0.08 },
                                  br: { x: 0.95, y: 0.92 },
                                  bl: { x: 0.05, y: 0.92 },
                                }
                              );
                              setCropCamScannerMode(pair.back?.camScannerMode ?? true);
                            }}
                            className="px-2.5 py-1 text-[11px] text-blue-400 hover:text-white rounded-lg bg-slate-800 hover:bg-blue-600 transition flex items-center gap-1 cursor-pointer font-bold"
                            title="قص وتعديل منظور الأركان الأربعة (CamScanner Pro)"
                          >
                            <Scan className="w-3 h-3" />
                            <span>قص 4 أركان</span>
                          </button>

                          {/* Fine Rotation Button */}
                          <button
                            onClick={() => {
                              setEditingTarget({
                                pairId: pair.pairId,
                                side: "back",
                                cardSide: pair.back!,
                              });
                              setFineAngle(pair.back?.rotation || 0);
                            }}
                            className="px-2 py-1 text-[11px] text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1 cursor-pointer font-bold"
                            title="تدوير وضبط بزوايا دقيقة"
                          >
                            <RotateCw className="w-3 h-3" />
                            <span>تدوير</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="aspect-[8.6/5.4] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center p-1.5 relative">
                      {pair.back ? (
                        <NextImage
                          src={pair.back.processedSrc}
                          alt="Back face"
                          width={400}
                          height={250}
                          unoptimized
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-slate-600">غير متوفر</span>
                      )}
                    </div>

                    {/* Per-Side Controls */}
                    {pair.back && (
                      <div className="flex items-center justify-between bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 text-[11px]">
                        <span className="text-slate-400 font-bold mr-1">تعديل الضهر:</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => adjustSideValue(pair.pairId, "back", 12, 5)}
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white transition cursor-pointer font-bold"
                            title="تفتيح هذا الوجه"
                          >
                            تفتيح +
                          </button>
                          <button
                            onClick={() => adjustSideValue(pair.pairId, "back", -12, -5)}
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer font-bold"
                            title="تغميق هذا الوجه"
                          >
                            تغميق -
                          </button>
                          <button
                            onClick={() => resetSide(pair.pairId, "back")}
                            className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                            title="إعادة ضبط للأصل"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 text-center bg-slate-950/40 py-1.5 rounded-xl border border-slate-800/40">
                  عرض الصورة في الطباعة: 9.0 سم • مقاس الورقة: A5 • ألوان طبيعية 100% وأرقام قومية واضحة
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CamScanner Pro 4-Corner Quad Perspective Modal */}
      {cropTarget && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Scan className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    قص وضبط منظور البطاقة (CamScanner Pro)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    اسحب الأركان الأربعة لتطابق زوايا البطاقة الأصلية بدقة، وسيتم تعديل المنظور وتبييض الأرضية
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCropTarget(null)}
                className="text-slate-400 hover:text-white cursor-pointer p-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Interactive Quad Viewport */}
            <div
              ref={cropContainerRef}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="relative aspect-[8.6/5.4] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 select-none touch-none cursor-crosshair flex items-center justify-center p-1"
            >
              {/* Card Original Image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cropTarget.cardSide.originalSrc}
                alt="Original for quad warp"
                className="max-w-full max-h-full object-contain pointer-events-none select-none"
              />

              {/* SVG Mask and Quad Lines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {/* Quad polygon */}
                <polygon
                  points={`${quadCorners.tl.x * 100}%,${quadCorners.tl.y * 100}% ${quadCorners.tr.x * 100}%,${quadCorners.tr.y * 100}% ${quadCorners.br.x * 100}%,${quadCorners.br.y * 100}% ${quadCorners.bl.x * 100}%,${quadCorners.bl.y * 100}%`}
                  fill="rgba(245, 158, 11, 0.15)"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  strokeDasharray="4 2"
                />
                {/* Connecting Cross diagonals for center alignment */}
                <line
                  x1={`${quadCorners.tl.x * 100}%`}
                  y1={`${quadCorners.tl.y * 100}%`}
                  x2={`${quadCorners.br.x * 100}%`}
                  y2={`${quadCorners.br.y * 100}%`}
                  stroke="rgba(245, 158, 11, 0.25)"
                  strokeWidth="1"
                />
                <line
                  x1={`${quadCorners.tr.x * 100}%`}
                  y1={`${quadCorners.tr.y * 100}%`}
                  x2={`${quadCorners.bl.x * 100}%`}
                  y2={`${quadCorners.bl.y * 100}%`}
                  stroke="rgba(245, 158, 11, 0.25)"
                  strokeWidth="1"
                />
              </svg>

              {/* 4 Interactive Corner Pins */}
              {(["tl", "tr", "br", "bl"] as const).map((key) => {
                const pt = quadCorners[key];
                const label =
                  key === "tl"
                    ? "أعلى يسار"
                    : key === "tr"
                    ? "أعلى يمين"
                    : key === "br"
                    ? "أسفل يمين"
                    : "أسفل يسار";
                return (
                  <div
                    key={key}
                    style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%` }}
                    onPointerDown={(e) => handleCornerPointerDown(key, e)}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-white bg-amber-500 shadow-xl cursor-grab active:cursor-grabbing flex items-center justify-center hover:scale-125 transition-transform z-20 group touch-none"
                    title={`اسحب زاوية ${label}`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-950" />
                    <span className="absolute -bottom-6 px-1.5 py-0.5 rounded bg-slate-900/90 text-[10px] font-bold text-amber-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {label}
                    </span>
                  </div>
                );
              })}

              {/* Loupe / Magnifying Lens Preview when dragging a corner */}
              {activeCornerDrag && loupePoint && (
                <div className="absolute top-3 left-3 w-28 h-28 rounded-full border-2 border-amber-400 shadow-2xl overflow-hidden bg-slate-900 z-30 pointer-events-none">
                  <div
                    style={{
                      position: "absolute",
                      width: "350%",
                      height: "350%",
                      left: `${-loupePoint.x * 350 + 50}%`,
                      top: `${-loupePoint.y * 350 + 50}%`,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cropTarget.cardSide.originalSrc}
                      alt="Loupe Zoom"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  {/* Loupe Crosshairs */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-5 h-0.5 bg-amber-400" />
                    <div className="h-5 w-0.5 bg-amber-400 absolute" />
                  </div>
                  <div className="absolute bottom-1 inset-x-0 text-center">
                    <span className="text-[9px] font-black bg-slate-950/90 text-amber-400 px-1.5 py-0.5 rounded-full">
                      مكبرة دقيقة 3.5x
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Presets & CamScanner Magic Mode Switch */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-300">خيارات ضبط الكادر السريعة:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQuadCorners({
                        tl: { x: 0.05, y: 0.08 },
                        tr: { x: 0.95, y: 0.08 },
                        br: { x: 0.95, y: 0.92 },
                        bl: { x: 0.05, y: 0.92 },
                      });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-[11px] cursor-pointer"
                  >
                    كادر بطاقة قياسي
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuadCorners({
                        tl: { x: 0, y: 0 },
                        tr: { x: 1, y: 0 },
                        br: { x: 1, y: 1 },
                        bl: { x: 0, y: 1 },
                      });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] cursor-pointer"
                  >
                    تحديد كامل الصورة
                  </button>
                </div>
              </div>

              {/* CamScanner Magic Color Whitening Toggle */}
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-amber-500/40 transition">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="text-xs font-bold text-white block">سحر كام سكانر (Magic Color)</span>
                    <span className="text-[10px] text-slate-400 block">تبييض الأرضية وإزالة الظلال مع إبراز سواد أرقام البطاقة</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={cropCamScannerMode}
                  onChange={(e) => setCropCamScannerMode(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCropTarget(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleApplyCrop}
                className="flex-1 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5"
              >
                <Scan className="w-4 h-4" />
                <span>تطبيق وقص المنظور (CamScanner Warp)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fine-Angle Rotation Modal */}
      {editingTarget && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <RotateCw className="w-4 h-4 text-blue-400" />
                <h3 className="text-base font-black text-white">
                  تدوير دقيق لوجه البطاقة ({editingTarget.side === "front" ? "الوش" : "الضهر"})
                </h3>
              </div>
              <button
                onClick={() => setEditingTarget(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-[8.6/5.4] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center p-2">
              <NextImage
                src={editingTarget.cardSide.processedSrc}
                alt="Card Face"
                width={400}
                height={250}
                unoptimized
                style={{ transform: `rotate(${fineAngle}deg)` }}
                className="max-w-full max-h-full object-contain transition-transform"
              />
            </div>

            <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>زاوية التعديل والميلان الدقيقة:</span>
                <span className="text-blue-400 font-mono text-sm">{fineAngle > 0 ? `+${fineAngle}` : fineAngle}°</span>
              </div>
              <input
                type="range"
                min="-45"
                max="45"
                step="1"
                value={fineAngle}
                onChange={(e) => setFineAngle(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer"
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
                onClick={() => setEditingTarget(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleApplyFineRotation}
                className="flex-1 py-2.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 text-white transition cursor-pointer shadow-lg shadow-blue-600/30"
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
