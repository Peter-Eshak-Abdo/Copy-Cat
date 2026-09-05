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
} from "lucide-react";
import { generateIdCardsDocx } from "@/lib/docx/id-cards-docx";
import { processImageOnCanvas } from "@/lib/canvas-filters";
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
  const [globalSharpness, setGlobalSharpness] = useState(60);
  const [globalBrightness, setGlobalBrightness] = useState(115);
  const [isDragging, setIsDragging] = useState(false);

  // Modal for fine-angle rotation
  const [editingTarget, setEditingTarget] = useState<{
    pairId: string;
    side: "front" | "back";
    cardSide: CardSide;
  } | null>(null);
  const [fineAngle, setFineAngle] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processSideImage = (
    src: string,
    b = globalBrightness,
    c = 120,
    sh = globalSharpness,
    rot = 0
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
          camScannerMode: false,
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
          contrast: 120,
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
      const pairIndex = Math.floor(i / 2) + 1;
      newPairs.push({
        pairId: Math.random().toString(36).substring(2, 9),
        cardName: `بطاقة رقم ${pairs.length + pairIndex}`,
        front: loadedSides[i] || null,
        back: loadedSides[i + 1] || null,
      });
    }

    if (newPairs.length > 0) {
      setPairs((prev) => [...prev, ...newPairs]);
      toast.success(
        `تمت إضافة ${loadedSides.length} وجه (${newPairs.length} بطاقة) بنجاح`,
        invalidCount > 0 ? `تم استبعاد ${invalidCount} ملف غير صالح.` : undefined
      );
    } else if (invalidCount > 0) {
      toast.error("تعذر تحميل الملفات", "يرجى التأكد من اختيار صور صالحة (JPG أو PNG).");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
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
      const validFiles = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith("image/")
      );
      if (validFiles.length > 0) {
        await processFiles(validFiles);
      }
    }
  };

  // Reorder Cards Up/Down (Requirement #14)
  const movePairUp = (index: number) => {
    if (index <= 0) return;
    setPairs((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const movePairDown = (index: number) => {
    setPairs((prev) => {
      if (index >= prev.length - 1) return prev;
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const swapFrontAndBack = (pairId: string) => {
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

  const removePair = (pairId: string) => {
    setPairs((prev) => prev.filter((p) => p.pairId !== pairId));
  };

  // Individual Per-Side Custom Adjustments (Requirement #14)
  const adjustSideValue = async (
    pairId: string,
    side: "front" | "back",
    bDelta: number,
    shDelta: number
  ) => {
    const pair = pairs.find((p) => p.pairId === pairId);
    const target = pair ? pair[side] : null;
    if (!target) return;

    const newB = Math.max(60, Math.min(170, target.brightness + bDelta));
    const newSh = Math.max(0, Math.min(100, target.sharpness + shDelta));

    const newSrc = await processSideImage(
      target.originalSrc,
      newB,
      target.contrast,
      newSh,
      target.rotation
    );

    setPairs((curr) =>
      curr.map((p) => {
        if (p.pairId !== pairId) return p;
        return {
          ...p,
          [side]: {
            ...target,
            brightness: newB,
            sharpness: newSh,
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

    const newSrc = await processSideImage(target.originalSrc, 100, 100, 0, 0);

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
            processedSrc: newSrc,
          },
        };
      })
    );
  };

  // Global Presets (Requirement #14: مخصصة ومعممة في نفس الوقت)
  const applyGlobalEnhancement = async (sh: number, b: number) => {
    setGlobalSharpness(sh);
    setGlobalBrightness(b);

    const updated = await Promise.all(
      pairs.map(async (p) => {
        let newFront = p.front;
        let newBack = p.back;

        if (p.front) {
          const frontSrc = await processSideImage(p.front.originalSrc, b, 120, sh, p.front.rotation);
          newFront = { ...p.front, processedSrc: frontSrc, sharpness: sh, brightness: b };
        }
        if (p.back) {
          const backSrc = await processSideImage(p.back.originalSrc, b, 120, sh, p.back.rotation);
          newBack = { ...p.back, processedSrc: backSrc, sharpness: sh, brightness: b };
        }

        return { ...p, front: newFront, back: newBack };
      })
    );

    setPairs(updated);
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
      fineAngle
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

  const totalFacesCount = pairs.reduce((acc, p) => acc + (p.front ? 1 : 0) + (p.back ? 1 : 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-2">
            <Layers className="w-3.5 h-3.5" /> مصنع بطاقات الرقم القومي A5 (وش وضهر 9 سم)
          </div>
          <h1 className="text-2xl font-black text-white">
            تجهيز وطباعة بطاقات الرقم القومي الفورية A5
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed max-w-2xl">
            تفتيح متطور وذكي يحافظ على وضوح وسواد الأرقام بدون بهتان أو تشويش، تدوير دقيق لضبط ميلان البطاقة بالدرجة،
            إمكانية نقل وترتيب البطاقات، وتحكم مخصص لكل وجه (تفتيح الوش وتغميق الضهر حسب الحاجة) أو تعميم التعديلات على الكل!
          </p>
        </div>

        {pairs.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPairs([])}
              className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-red-950/40 text-red-400 hover:bg-red-900/50 border border-red-900/50 transition cursor-pointer"
            >
              مسح الكل
            </button>
            <button
              onClick={handleExportWord}
              disabled={isGenerating}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition disabled:opacity-50 cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>{isGenerating ? "جاري تجهيز الوورد..." : "تصدير وورد A5 فوري (Ctrl + P)"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Global Presets (Requirement #14: تعديلات معممة) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-slate-400 ml-2">تحسين وتفتيح عام لكافة البطاقات:</span>
        <button
          onClick={() => applyGlobalEnhancement(60, 115)}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            globalSharpness === 60 && globalBrightness === 115
              ? "bg-blue-600 text-white shadow-md font-black"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>تفتيح ذكي ناصع + حدة 60% (الموصى به)</span>
        </button>

        <button
          onClick={() => applyGlobalEnhancement(100, 125)}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            globalSharpness === 100
              ? "bg-cyan-600 text-white shadow-md font-black"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-yellow-300" />
          <span>أعلى حدة وتفتيح قوي (للبطاقات الغامقة والمبكسلة)</span>
        </button>

        <button
          onClick={() => applyGlobalEnhancement(0, 100)}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer mr-auto"
        >
          إعادة ضبط للأصل
        </button>
      </div>

      {/* Upload Box with Drag & Drop (Requirement #5) */}
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
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform ${
            isDragging
              ? "scale-125 bg-blue-500 text-slate-950"
              : "bg-blue-500/10 text-blue-400 group-hover:scale-110"
          }`}
        >
          <Upload className="w-8 h-8" />
        </div>
        <div>
          <span className="text-base font-bold text-white block">
            {isDragging ? "أفلت صور البطاقات هنا الآن!" : "اضغط هنا لرفع صور البطاقات أو اسحبها وأفلتها مباشرة (Drag & Drop)"}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            سيتم تجميع كل صورتين تلقائياً [وش في صفحة + ضهر في صفحة A5 مستقلة بعرض 9 سم بدقة]
          </span>
        </div>
      </div>

      {/* Pairs Showcase */}
      {pairs.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              تم تجميع <strong className="text-white font-bold">{pairs.length} بطاقات</strong> (إجمالي {totalFacesCount} وجه وظفر جاهز للطباعة)
            </span>
            <span className="text-blue-400 font-semibold">
              مقاس الصورة في الوورد: 9.0 سم بالضبط متوافقة مع الطباعة المباشرة Ctrl + P
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pairs.map((pair, index) => (
              <div
                key={pair.pairId}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl relative"
              >
                {/* Pair Header with Reorder buttons (Requirement #14: نقل الصور) */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-black flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="font-extrabold text-white text-sm">{pair.cardName}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Move Up / Down Buttons */}
                    <div className="flex items-center bg-slate-950 rounded-xl border border-slate-800 p-0.5">
                      <button
                        onClick={() => movePairUp(index)}
                        disabled={index === 0}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition cursor-pointer"
                        title="نقل البطاقة لأعلى"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => movePairDown(index)}
                        disabled={index === pairs.length - 1}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition cursor-pointer"
                        title="نقل البطاقة لأسفل"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => swapFrontAndBack(pair.pairId)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition cursor-pointer"
                      title="تبديل الوجه والظهر"
                    >
                      <ArrowUpDown className="w-3 h-3 text-cyan-400" />
                      <span>تبديل وش/ضهر</span>
                    </button>

                    <button
                      onClick={() => removePair(pair.pairId)}
                      className="p-1.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-950/40 transition cursor-pointer"
                      title="حذف هذه البطاقة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Faces Grid with Individual Custom Controls (Requirement #14) */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Front Side */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-blue-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-blue-400" />
                        <span>الوش (صفحة 1)</span>
                      </span>

                      {pair.front && (
                        <button
                          onClick={() => {
                            setEditingTarget({
                              pairId: pair.pairId,
                              side: "front",
                              cardSide: pair.front!,
                            });
                            setFineAngle(pair.front?.rotation || 0);
                          }}
                          className="px-2 py-0.5 text-[11px] text-blue-400 hover:text-white rounded-lg bg-slate-800 hover:bg-blue-600 transition flex items-center gap-1 cursor-pointer font-bold"
                          title="تدوير وضبط بزوايا دقيقة"
                        >
                          <RotateCw className="w-3 h-3" />
                          <span>تدوير دقيق</span>
                        </button>
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

                    {/* Per-Side Controls (Requirement #14: مخصصة لكل وجه) */}
                    {pair.front && (
                      <div className="flex items-center justify-between bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 text-[11px]">
                        <span className="text-slate-400 font-bold mr-1">تعديل الوش:</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => adjustSideValue(pair.pairId, "front", 15, 10)}
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white transition cursor-pointer font-bold"
                            title="تفتيح هذا الوجه"
                          >
                            تفتيح +
                          </button>
                          <button
                            onClick={() => adjustSideValue(pair.pairId, "front", -15, 0)}
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
                        <button
                          onClick={() => {
                            setEditingTarget({
                              pairId: pair.pairId,
                              side: "back",
                              cardSide: pair.back!,
                            });
                            setFineAngle(pair.back?.rotation || 0);
                          }}
                          className="px-2 py-0.5 text-[11px] text-emerald-400 hover:text-white rounded-lg bg-slate-800 hover:bg-emerald-600 transition flex items-center gap-1 cursor-pointer font-bold"
                          title="تدوير وضبط بزوايا دقيقة"
                        >
                          <RotateCw className="w-3 h-3" />
                          <span>تدوير دقيق</span>
                        </button>
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

                    {/* Per-Side Controls (Requirement #14: مخصصة لكل وجه) */}
                    {pair.back && (
                      <div className="flex items-center justify-between bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 text-[11px]">
                        <span className="text-slate-400 font-bold mr-1">تعديل الضهر:</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => adjustSideValue(pair.pairId, "back", 15, 10)}
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white transition cursor-pointer font-bold"
                            title="تفتيح هذا الظهر"
                          >
                            تفتيح +
                          </button>
                          <button
                            onClick={() => adjustSideValue(pair.pairId, "back", -15, 0)}
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer font-bold"
                            title="تغميق هذا الظهر"
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
                  عرض الصورة في الطباعة: 9.0 سم • مقاس الورقة: A5 • نصوص وأرقام قومية واضحة بدون لغوشة
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fine-Angle Rotation Modal for ID Card Face (Requirement #14) */}
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
