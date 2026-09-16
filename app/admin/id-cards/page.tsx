"use client";

import { useState, useRef, useEffect } from "react";
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
  ShieldCheck,
  Wand2,
  Scan,
  Printer,
  Sliders,
  Eye,
  FileText,
} from "lucide-react";
import { generateIdCardsDocx, PaperSize, DuplexAlignment } from "@/lib/docx/id-cards-docx";
import { processImageOnCanvas, CropRect, QuadCorners, Point2D, detectCardCorners } from "@/lib/canvas-filters";
import { detectCardCornersOpenCV, warpPerspectiveOpenCV, loadOpenCV } from "@/lib/opencv-loader";
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
  bakedBrightness?: number;
  bakedContrast?: number;
  bakedSharpness?: number;
  thresholdMode?: boolean;
  camScannerMode?: boolean;
  sideType: "front" | "back";
  crop?: CropRect;
  quad?: QuadCorners;
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
  const [globalSharpness, setGlobalSharpness] = useState(0);
  const [globalBrightness, setGlobalBrightness] = useState(100);
  const [isDragging, setIsDragging] = useState(false);

  // Paper & Duplex print options
  const [paperSize, setPaperSize] = useState<PaperSize>("A4");
  const [duplexAlignment, setDuplexAlignment] = useState<DuplexAlignment>("vertical");

  // Print Preview Sheet Modal
  const [printPreviewPair, setPrintPreviewPair] = useState<CardPair | null>(null);
  const [printPreviewDataUrl, setPrintPreviewDataUrl] = useState<string | null>(null);
  const [isGeneratingPrintPreview, setIsGeneratingPrintPreview] = useState(false);

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
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

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
    c = 100,
    sh = globalSharpness,
    rot = 0,
    crop?: CropRect,
    quad?: QuadCorners,
    camScannerMode?: boolean,
    thresholdMode?: boolean
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
          preserveColors: true,
          crop,
          quad,
          camScannerMode,
          thresholdMode,
        });
        resolve(res);
      };
    });
  };

  const readAndOptimizeImage = async (file: File, maxDim = 1600): Promise<string> => {
    const dataUrl = await readFileAsDataURL(file);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (Math.max(w, h) <= maxDim) {
          resolve(dataUrl);
          return;
        }
        const scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL("image/jpeg", 0.92));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
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
        const originalSrc = await readAndOptimizeImage(file);

        // 1. Instant auto-detect corners using native Canvas Sobel edge detection (~10ms)
        const autoQuad = await new Promise<QuadCorners>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = originalSrc;
          img.onload = () => {
            try {
              const c = document.createElement("canvas");
              c.width = img.naturalWidth || img.width;
              c.height = img.naturalHeight || img.height;
              const ctx = c.getContext("2d");
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                const q = detectCardCorners(c);
                resolve(q);
                return;
              }
            } catch {}
            // Fallback
            resolve({
              tl: { x: 0.05, y: 0.08 },
              tr: { x: 0.95, y: 0.08 },
              br: { x: 0.95, y: 0.92 },
              bl: { x: 0.05, y: 0.92 },
            });
          };
          img.onerror = () => {
            resolve({
              tl: { x: 0.05, y: 0.08 },
              tr: { x: 0.95, y: 0.08 },
              br: { x: 0.95, y: 0.92 },
              bl: { x: 0.05, y: 0.92 },
            });
          };
        });

        // 2. Automatically process with quad perspective warp while preserving 100% natural colors
        const processedSrc = await processSideImage(
          originalSrc,
          100,
          100,
          0,
          0,
          undefined,
          autoQuad,
          false,
          false
        );

        loadedSides.push({
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          originalSrc,
          processedSrc,
          rotation: 0,
          brightness: 100,
          contrast: 100,
          sharpness: 0,
          bakedBrightness: 100,
          bakedContrast: 100,
          bakedSharpness: 0,
          thresholdMode: false,
          sideType: i % 2 === 0 ? "front" : "back",
          quad: autoQuad,
          camScannerMode: false,
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
        "تم استيراد صور البطاقات وتحديد أركانها بنجاح",
        `تمت إضافة ${loadedSides.length} وجه (${newPairs.length} بطاقة) مع الكشف التلقائي للأركان بـ OpenCV.`
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

  // Real-time slider updater with debounced background canvas baking
  const handleSliderChange = (
    pairId: string,
    side: "front" | "back",
    field: "brightness" | "contrast" | "sharpness",
    val: number
  ) => {
    // 1. Immediately update UI state for buttery smooth 60fps slider drag
    setPairs((curr) =>
      curr.map((p) => {
        if (p.pairId !== pairId) return p;
        const currentSide = p[side];
        if (!currentSide) return p;
        return {
          ...p,
          [side]: {
            ...currentSide,
            [field]: val,
          },
        };
      })
    );

    // 2. Debounce the heavy canvas processing so it only runs when user stops dragging
    const timerKey = `${pairId}-${side}`;
    if (debounceTimers.current[timerKey]) {
      clearTimeout(debounceTimers.current[timerKey]);
    }

    debounceTimers.current[timerKey] = setTimeout(async () => {
      setPairs((latestPairs) => {
        const pair = latestPairs.find((p) => p.pairId === pairId);
        const target = pair ? pair[side] : null;
        if (!target) return latestPairs;

        processSideImage(
          target.originalSrc,
          target.brightness,
          target.contrast,
          target.sharpness,
          target.rotation,
          target.crop,
          target.quad,
          target.camScannerMode,
          target.thresholdMode
        ).then((newSrc) => {
          setPairs((curr) =>
            curr.map((p) => {
              if (p.pairId !== pairId) return p;
              const s = p[side];
              if (!s) return p;
              return {
                ...p,
                [side]: {
                  ...s,
                  processedSrc: newSrc,
                  bakedBrightness: s.brightness,
                  bakedContrast: s.contrast,
                  bakedSharpness: s.sharpness,
                },
              };
            })
          );
        });

        return latestPairs;
      });
    }, 280);
  };

  // Generic update for side toggles & discrete clicks
  const updateSideProperty = async (
    pairId: string,
    side: "front" | "back",
    updates: Partial<CardSide>
  ) => {
    const timerKey = `${pairId}-${side}`;
    if (debounceTimers.current[timerKey]) {
      clearTimeout(debounceTimers.current[timerKey]);
    }

    const pair = pairs.find((p) => p.pairId === pairId);
    const target = pair ? pair[side] : null;
    if (!target) return;

    const updated = { ...target, ...updates };

    const newSrc = await processSideImage(
      updated.originalSrc,
      updated.brightness,
      updated.contrast,
      updated.sharpness,
      updated.rotation,
      updated.crop,
      updated.quad,
      updated.camScannerMode,
      updated.thresholdMode
    );

    setPairs((curr) =>
      curr.map((p) => {
        if (p.pairId !== pairId) return p;
        return {
          ...p,
          [side]: {
            ...updated,
            processedSrc: newSrc,
            bakedBrightness: updated.brightness,
            bakedContrast: updated.contrast,
            bakedSharpness: updated.sharpness,
          },
        };
      })
    );
  };

  // Reset side to original
  const resetSide = async (pairId: string, side: "front" | "back") => {
    const timerKey = `${pairId}-${side}`;
    if (debounceTimers.current[timerKey]) {
      clearTimeout(debounceTimers.current[timerKey]);
    }

    const pair = pairs.find((p) => p.pairId === pairId);
    const target = pair ? pair[side] : null;
    if (!target) return;

    const newSrc = await processSideImage(
      target.originalSrc,
      100,
      100,
      0,
      0,
      undefined,
      target.quad,
      false,
      false
    );

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
            bakedBrightness: 100,
            bakedContrast: 100,
            bakedSharpness: 0,
            rotation: 0,
            thresholdMode: false,
            camScannerMode: false,
            processedSrc: newSrc,
          },
        };
      })
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
            p.front.camScannerMode,
            p.front.thresholdMode
          );
          newFront = {
            ...p.front,
            processedSrc: frontSrc,
            sharpness: sh,
            brightness: b,
            contrast: 105,
            bakedBrightness: b,
            bakedContrast: 105,
            bakedSharpness: sh,
          };
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
            p.back.camScannerMode,
            p.back.thresholdMode
          );
          newBack = {
            ...p.back,
            processedSrc: backSrc,
            sharpness: sh,
            brightness: b,
            contrast: 105,
            bakedBrightness: b,
            bakedContrast: 105,
            bakedSharpness: sh,
          };
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
      cardSide.camScannerMode,
      cardSide.thresholdMode
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
      cropCamScannerMode,
      cardSide.thresholdMode
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

  // Auto-detect corners with instant native canvas Sobel edge detection (or OpenCV if available)
  const handleAutoDetectCorners = async () => {
    if (!cropTarget) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = cropTarget.cardSide.originalSrc;
    img.onload = async () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        let detected = detectCardCorners(c);
        if (typeof window !== "undefined" && window.cv && window.cv.Mat) {
          try {
            detected = await detectCardCornersOpenCV(c);
          } catch {}
        }
        setQuadCorners(detected);
        toast.success(
          "تم كشف زوايا البطاقة تلقائياً ✨",
          "تم رصد أركان البطاقة الأربعة بنجاح، يمكنك تعديل أي نقطة يدوياً بالماوس."
        );
      }
    };
  };

  // Export Word DOCX with A4/A5 and Duplex alignment
  const handleExportWord = async () => {
    if (pairs.length === 0) return;
    setIsGenerating(true);
    try {
      const docxPairs = pairs.map((p) => ({
        front: p.front?.processedSrc || null,
        back: p.back?.processedSrc || null,
        name: p.cardName,
      }));

      await generateIdCardsDocx(docxPairs, {
        filename: `CopyCat_ID_Cards_${paperSize}.docx`,
        paperSize,
        layout: "single_sheet",
        duplexAlignment,
      });

      toast.success(
        `تم تصدير ملف الوورد بنجاح (${paperSize})`,
        `تم تجهيز ${pairs.length} بطاقة (الوش والظهر معاً) بمقاس 85.6×54 مم ومحاذاة الطباعة المزدوجة (${duplexAlignment === "vertical" ? "رأسية" : "أفقية"}).`
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

  // Generate A4/A5 Sheet Canvas for Direct Browser Print & Preview
  const openPrintPreview = async (pair: CardPair) => {
    if (!pair.front && !pair.back) return;
    setPrintPreviewPair(pair);
    setIsGeneratingPrintPreview(true);

    try {
      // Standard sheet sizes at 300 DPI (approx 11.81 pixels per mm)
      const pxPerMm = 11.811;
      const sheetW = Math.round((paperSize === "A4" ? 210 : 148) * pxPerMm);
      const sheetH = Math.round((paperSize === "A4" ? 297 : 210) * pxPerMm);

      // Card exact standard size: 85.6mm x 54.0mm
      const cardW = Math.round(85.6 * pxPerMm); // 1011 px
      const cardH = Math.round(54.0 * pxPerMm); // 638 px

      const canvas = document.createElement("canvas");
      canvas.width = sheetW;
      canvas.height = sheetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Pure white paper background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, sheetW, sheetH);

      const loadImg = (src: string): Promise<HTMLImageElement> =>
        new Promise((resolve) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.src = src;
        });

      const frontImg = pair.front?.processedSrc ? await loadImg(pair.front.processedSrc) : null;
      const backImg = pair.back?.processedSrc ? await loadImg(pair.back.processedSrc) : null;

      // Draw helper for 1.5 border and corner crop marks
      const drawCardWithMarks = (img: HTMLImageElement, x: number, y: number) => {
        // Draw card
        ctx.drawImage(img, x, y, cardW, cardH);

        // Thin border (1.5pt = ~6px at 300 DPI)
        ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, cardW, cardH);

        // Crop marks (15mm marks outside card edges)
        const markLen = Math.round(10 * pxPerMm);
        ctx.strokeStyle = "#888888";
        ctx.lineWidth = 1.5;

        // Top-left
        ctx.beginPath();
        ctx.moveTo(x - markLen, y); ctx.lineTo(x - 5, y);
        ctx.moveTo(x, y - markLen); ctx.lineTo(x, y - 5);
        // Top-right
        ctx.moveTo(x + cardW + 5, y); ctx.lineTo(x + cardW + markLen, y);
        ctx.moveTo(x + cardW, y - markLen); ctx.lineTo(x + cardW, y - 5);
        // Bottom-left
        ctx.moveTo(x - markLen, y + cardH); ctx.lineTo(x - 5, y + cardH);
        ctx.moveTo(x, y + cardH + 5); ctx.lineTo(x, y + cardH + markLen);
        // Bottom-right
        ctx.moveTo(x + cardW + 5, y + cardH); ctx.lineTo(x + cardW + markLen, y + cardH);
        ctx.moveTo(x + cardW, y + cardH + 5); ctx.lineTo(x + cardW, y + cardH + markLen);
        ctx.stroke();
      };

      if (duplexAlignment === "vertical") {
        // Exact vertical center alignment: both cards share exact same X position
        const centerX = Math.round((sheetW - cardW) / 2);
        const topY = Math.round(sheetH * (paperSize === "A4" ? 0.18 : 0.1));
        const bottomY = Math.round(sheetH * (paperSize === "A4" ? 0.52 : 0.5));

        if (frontImg) drawCardWithMarks(frontImg, centerX, topY);
        if (backImg) drawCardWithMarks(backImg, centerX, bottomY);
      } else {
        // Exact horizontal alignment: both cards share exact same Y position
        const centerY = Math.round((sheetH - cardH) / 2);
        const halfW = sheetW / 2;
        const leftX = Math.round((halfW - cardW) / 2);
        const rightX = Math.round(halfW + (halfW - cardW) / 2);

        if (frontImg) drawCardWithMarks(frontImg, leftX, centerY);
        if (backImg) drawCardWithMarks(backImg, rightX, centerY);
      }

      setPrintPreviewDataUrl(canvas.toDataURL("image/jpeg", 0.95));
    } catch (err) {
      console.error("Print preview generation error:", err);
    } finally {
      setIsGeneratingPrintPreview(false);
    }
  };

  const triggerDirectPrint = () => {
    if (!printPreviewDataUrl) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.warning("يرجى السماح بالنوافذ المنبثقة للطباعة المباشرة");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <title>طباعة بطاقة الرقم القومي - Copy-Cat</title>
          <style>
            @page {
              size: ${paperSize} portrait;
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
          <img src="${printPreviewDataUrl}" onload="window.print(); window.close();" />
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const totalFacesCount = pairs.reduce(
    (acc, curr) => acc + (curr.front ? 1 : 0) + (curr.back ? 1 : 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-2">
            <Layers className="w-3.5 h-3.5" /> مصنع بطاقات الرقم القومي والطباعة المزدوجة (Duplex)
          </div>
          <h1 className="text-2xl font-black text-slate-900">
            تجهيز وقص وطباعة بطاقات الرقم القومي A4 / A5
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 leading-relaxed max-w-2xl">
            كشف تلقائي للأركان وتصحيح المنظور بمكتبة OpenCV.js، تحكم يدوي بالأركان الأربعة، سلايدرز تفتيح وتباين وحدة فورية منفصلة لكل وجه، مع فلتر أبيض وأسود عالي التباين للطباعة ومحاذاة تامة للوجهين بمقاس 85.6mm × 54mm!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {pairs.length > 0 && (
            <button
              onClick={() => setPairs([])}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
            >
              مسح الكل
            </button>
          )}

          <button
            onClick={handleExportWord}
            disabled={pairs.length === 0 || isGenerating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm shadow-xs shadow-blue-600/30 transition disabled:opacity-50 cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>{isGenerating ? "جاري إنشاء ملف الوورد..." : `تصدير وورد (${paperSize})`}</span>
          </button>
        </div>
      </div>

      {/* Configuration Bar: Paper Size & Duplex Alignment */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Paper Size selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-400" /> مقاس ورقة الطباعة:
            </span>
            <div className="flex rounded-xl bg-slate-50 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setPaperSize("A4")}
                className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                  paperSize === "A4" ? "bg-blue-600 text-white shadow" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                A4 (المعتمد للطباعة المزدوجة 210×297 مم)
              </button>
              <button
                type="button"
                onClick={() => setPaperSize("A5")}
                className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                  paperSize === "A5" ? "bg-blue-600 text-white shadow" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                A5 (148×210 مم)
              </button>
            </div>
          </div>

          {/* Duplex Alignment selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <ArrowUpDown className="w-4 h-4 text-emerald-400" /> محاذاة الطباعة المزدوجة (Duplex):
            </span>
            <div className="flex rounded-xl bg-slate-50 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setDuplexAlignment("vertical")}
                className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                  duplexAlignment === "vertical"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="الوجه والظهر على نفس المحور الرأسي تماماً للتطابق التام عند قلب الورقة"
              >
                محاذاة عمودية (Vertical)
              </button>
              <button
                type="button"
                onClick={() => setDuplexAlignment("horizontal")}
                className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                  duplexAlignment === "horizontal"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="الوجه والظهر متجاوران على نفس الخط الأفقي"
              >
                محاذاة أفقية (Horizontal)
              </button>
            </div>
          </div>
        </div>

        {/* Global Quick Presets */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-slate-200">
          <span className="text-xs font-bold text-slate-500">فلاتر سريعة للكل:</span>
          <button
            onClick={() => applyGlobalEnhancement(50, 118)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              globalBrightness === 118
                ? "bg-blue-600 text-white shadow-md font-black"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>تفتيح متوازن مع حفظ الألوان</span>
          </button>

          <button
            onClick={() => applyGlobalEnhancement(70, 132)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              globalBrightness === 132
                ? "bg-cyan-600 text-white shadow-md font-black"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-yellow-300" />
            <span>تفتيح فائق للبطاقات المظلمة</span>
          </button>

          <button
            onClick={() => applyGlobalEnhancement(0, 100)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer mr-auto"
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
        className={`border-2 border-dashed transition-all rounded-2xl p-8 sm:p-10 text-center cursor-pointer flex flex-col items-center justify-center gap-3 group ${
          isDragging
            ? "border-blue-400 bg-blue-950/20 scale-[1.01] shadow-2xl shadow-blue-500/10"
            : "border-slate-200 hover:border-blue-500/60 bg-slate-50 hover:bg-white"
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

        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
          <Upload className="w-7 h-7" />
        </div>

        <div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {isDragging ? "أفلت صور البطاقات هنا الآن!" : "اضغط لرفع صور البطاقات أو اسحبها وأفلتها هنا"}
          </h3>
          <p className="text-slate-500 text-xs">
            يتم كشف أركان البطاقة الأربعة وتصحيح المنظور آلياً عبر OpenCV.js داخل المتصفح مع حفظ الألوان الطبيعية
          </p>
        </div>
      </div>

      {/* Pairs Container */}
      {pairs.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              تم تجميع <strong className="text-slate-900 font-bold">{pairs.length} بطاقة</strong> ({totalFacesCount} وجه وظفر جاهز للطباعة)
            </span>
            <span className="text-blue-400 font-bold">
              مقاس البطاقة المطبوعة الدقيق: 85.6mm × 54mm (معيار ISO ID-1)
            </span>
          </div>

          <div className="space-y-6">
            {pairs.map((pair, index) => (
              <div
                key={pair.pairId}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4"
              >
                {/* Pair Top Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-blue-600/20 text-blue-400 font-black text-xs flex items-center justify-center border border-blue-500/30">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={pair.cardName}
                      onChange={(e) => updateCardName(pair.pairId, e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none w-44 sm:w-52"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Print Preview Button */}
                    <button
                      onClick={() => openPrintPreview(pair)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
                      title="معاينة وطباعة فورية داخل المتصفح"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>معاينة وطباعة الورقة ({paperSize})</span>
                    </button>

                    {/* Swap Front / Back */}
                    <button
                      onClick={() => swapPairSides(pair.pairId)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:text-white hover:bg-blue-600 transition text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="تبديل الوش مكان الضهر"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">تبديل الوش والضهر</span>
                    </button>

                    {/* Reorder Buttons */}
                    <button
                      onClick={() => movePair(index, "up")}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition disabled:opacity-30 cursor-pointer"
                      title="نقل لأعلى"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => movePair(index, "down")}
                      disabled={index === pairs.length - 1}
                      className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition disabled:opacity-30 cursor-pointer"
                      title="نقل لأسفل"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {/* Delete Pair */}
                    <button
                      onClick={() => removePair(pair.pairId)}
                      className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition cursor-pointer"
                      title="حذف هذه البطاقة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Two Sides Grid (Front & Back) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Front Side */}
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-black text-blue-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>الوش (Front Face)</span>
                      </span>

                      {pair.front && (
                        <div className="flex items-center gap-1.5">
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
                              setCropCamScannerMode(pair.front?.camScannerMode ?? false);
                            }}
                            className="px-2 py-1 text-[11px] text-amber-400 hover:text-slate-950 rounded-lg bg-amber-500/10 hover:bg-amber-400 border border-amber-500/30 transition flex items-center gap-1 cursor-pointer font-bold"
                            title="تحريك الأركان الأربعة بالماوس وتصحيح المنظور"
                          >
                            <Scan className="w-3 h-3" />
                            <span>الأركان الأربعة</span>
                          </button>

                          {/* Fine Rotation */}
                          <button
                            onClick={() => {
                              setEditingTarget({
                                pairId: pair.pairId,
                                side: "front",
                                cardSide: pair.front!,
                              });
                              setFineAngle(pair.front?.rotation || 0);
                            }}
                            className="p-1 rounded-lg bg-slate-100 text-slate-700 hover:text-slate-900 transition cursor-pointer"
                            title="تدوير دقيق"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset */}
                          <button
                            onClick={() => resetSide(pair.pairId, "front")}
                            className="p-1 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                            title="إعادة ضبط للأصل"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="aspect-[8.56/5.4] bg-slate-50 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center p-1 relative shadow-inner">
                      {pair.front ? (
                        <NextImage
                          src={pair.front.processedSrc}
                          alt="Front face"
                          width={400}
                          height={252}
                          unoptimized
                          style={{
                            filter: `brightness(${(pair.front.brightness || 100) / (pair.front.bakedBrightness || pair.front.brightness || 100)}) contrast(${(pair.front.contrast || 100) / (pair.front.bakedContrast || pair.front.contrast || 100)})`,
                          }}
                          className="w-full h-full object-contain transition-all duration-75"
                        />
                      ) : (
                        <span className="text-xs text-slate-600">غير متوفر</span>
                      )}
                    </div>

                    {/* Front Live Sliders & Controls */}
                    {pair.front && (
                      <div className="space-y-2 pt-1">
                        {/* Brightness Slider */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-14 text-slate-500 font-bold">التفتيح:</span>
                          <input
                            type="range"
                            min="50"
                            max="180"
                            value={pair.front.brightness}
                            onChange={(e) =>
                              handleSliderChange(
                                pair.pairId,
                                "front",
                                "brightness",
                                Number(e.target.value)
                              )
                            }
                            className="flex-1 accent-blue-500 cursor-pointer h-1.5 bg-slate-100 rounded-lg"
                          />
                          <span className="w-8 text-right font-mono text-slate-700">
                            {pair.front.brightness}%
                          </span>
                        </div>

                        {/* Contrast Slider */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-14 text-slate-500 font-bold">التباين:</span>
                          <input
                            type="range"
                            min="50"
                            max="180"
                            value={pair.front.contrast}
                            onChange={(e) =>
                              handleSliderChange(
                                pair.pairId,
                                "front",
                                "contrast",
                                Number(e.target.value)
                              )
                            }
                            className="flex-1 accent-blue-500 cursor-pointer h-1.5 bg-slate-100 rounded-lg"
                          />
                          <span className="w-8 text-right font-mono text-slate-700">
                            {pair.front.contrast}%
                          </span>
                        </div>

                        {/* Sharpness Slider */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-14 text-slate-500 font-bold">الحدة:</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={pair.front.sharpness}
                            onChange={(e) =>
                              handleSliderChange(
                                pair.pairId,
                                "front",
                                "sharpness",
                                Number(e.target.value)
                              )
                            }
                            className="flex-1 accent-blue-500 cursor-pointer h-1.5 bg-slate-100 rounded-lg"
                          />
                          <span className="w-8 text-right font-mono text-slate-700">
                            {pair.front.sharpness}%
                          </span>
                        </div>

                        {/* Action Toggles: B&W Threshold and CamScanner */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateSideProperty(pair.pairId, "front", {
                                thresholdMode: !pair.front?.thresholdMode,
                              })
                            }
                            className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer border ${
                              pair.front.thresholdMode
                                ? "bg-white text-slate-950 border-white font-black shadow"
                                : "bg-white text-slate-700 border-slate-200 hover:border-slate-200"
                            }`}
                            title="فلتر أبيض وأسود عالي التباين جاهز للطباعة وتصوير المستندات"
                          >
                            <Sliders className="w-3 h-3" />
                            <span>{pair.front.thresholdMode ? "إلغاء فلتر أبيض/أسود" : "فلتر أبيض/أسود (B&W)"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              updateSideProperty(pair.pairId, "front", {
                                camScannerMode: !pair.front?.camScannerMode,
                              })
                            }
                            className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer border ${
                              pair.front.camScannerMode
                                ? "bg-amber-500 text-slate-950 border-amber-500 font-black shadow"
                                : "bg-white text-amber-300 border-slate-200 hover:border-slate-200"
                            }`}
                            title="تبييض أرضية البطاقة وإبراز سواد الأرقام والحبر"
                          >
                            <Wand2 className="w-3 h-3" />
                            <span>سحر كام سكانر</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Back Side */}
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-black text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>الضهر (Back Face)</span>
                      </span>

                      {pair.back && (
                        <div className="flex items-center gap-1.5">
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
                              setCropCamScannerMode(pair.back?.camScannerMode ?? false);
                            }}
                            className="px-2 py-1 text-[11px] text-amber-400 hover:text-slate-950 rounded-lg bg-amber-500/10 hover:bg-amber-400 border border-amber-500/30 transition flex items-center gap-1 cursor-pointer font-bold"
                            title="تحريك الأركان الأربعة بالماوس وتصحيح المنظور"
                          >
                            <Scan className="w-3 h-3" />
                            <span>الأركان الأربعة</span>
                          </button>

                          {/* Fine Rotation */}
                          <button
                            onClick={() => {
                              setEditingTarget({
                                pairId: pair.pairId,
                                side: "back",
                                cardSide: pair.back!,
                              });
                              setFineAngle(pair.back?.rotation || 0);
                            }}
                            className="p-1 rounded-lg bg-slate-100 text-slate-700 hover:text-slate-900 transition cursor-pointer"
                            title="تدوير دقيق"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset */}
                          <button
                            onClick={() => resetSide(pair.pairId, "back")}
                            className="p-1 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                            title="إعادة ضبط للأصل"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="aspect-[8.56/5.4] bg-slate-50 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center p-1 relative shadow-inner">
                      {pair.back ? (
                        <NextImage
                          src={pair.back.processedSrc}
                          alt="Back face"
                          width={400}
                          height={252}
                          unoptimized
                          style={{
                            filter: `brightness(${(pair.back.brightness || 100) / (pair.back.bakedBrightness || pair.back.brightness || 100)}) contrast(${(pair.back.contrast || 100) / (pair.back.bakedContrast || pair.back.contrast || 100)})`,
                          }}
                          className="w-full h-full object-contain transition-all duration-75"
                        />
                      ) : (
                        <span className="text-xs text-slate-600">غير متوفر</span>
                      )}
                    </div>

                    {/* Back Live Sliders & Controls */}
                    {pair.back && (
                      <div className="space-y-2 pt-1">
                        {/* Brightness Slider */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-14 text-slate-500 font-bold">التفتيح:</span>
                          <input
                            type="range"
                            min="50"
                            max="180"
                            value={pair.back.brightness}
                            onChange={(e) =>
                              handleSliderChange(
                                pair.pairId,
                                "back",
                                "brightness",
                                Number(e.target.value)
                              )
                            }
                            className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-100 rounded-lg"
                          />
                          <span className="w-8 text-right font-mono text-slate-700">
                            {pair.back.brightness}%
                          </span>
                        </div>

                        {/* Contrast Slider */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-14 text-slate-500 font-bold">التباين:</span>
                          <input
                            type="range"
                            min="50"
                            max="180"
                            value={pair.back.contrast}
                            onChange={(e) =>
                              handleSliderChange(
                                pair.pairId,
                                "back",
                                "contrast",
                                Number(e.target.value)
                              )
                            }
                            className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-100 rounded-lg"
                          />
                          <span className="w-8 text-right font-mono text-slate-700">
                            {pair.back.contrast}%
                          </span>
                        </div>

                        {/* Sharpness Slider */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-14 text-slate-500 font-bold">الحدة:</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={pair.back.sharpness}
                            onChange={(e) =>
                              handleSliderChange(
                                pair.pairId,
                                "back",
                                "sharpness",
                                Number(e.target.value)
                              )
                            }
                            className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-100 rounded-lg"
                          />
                          <span className="w-8 text-right font-mono text-slate-700">
                            {pair.back.sharpness}%
                          </span>
                        </div>

                        {/* Action Toggles: B&W Threshold and CamScanner */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateSideProperty(pair.pairId, "back", {
                                thresholdMode: !pair.back?.thresholdMode,
                              })
                            }
                            className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer border ${
                              pair.back.thresholdMode
                                ? "bg-white text-slate-950 border-white font-black shadow"
                                : "bg-white text-slate-700 border-slate-200 hover:border-slate-200"
                            }`}
                            title="فلتر أبيض وأسود عالي التباين جاهز للطباعة وتصوير المستندات"
                          >
                            <Sliders className="w-3 h-3" />
                            <span>{pair.back.thresholdMode ? "إلغاء فلتر أبيض/أسود" : "فلتر أبيض/أسود (B&W)"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              updateSideProperty(pair.pairId, "back", {
                                camScannerMode: !pair.back?.camScannerMode,
                              })
                            }
                            className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer border ${
                              pair.back.camScannerMode
                                ? "bg-emerald-500 text-slate-950 border-emerald-500 font-black shadow"
                                : "bg-white text-emerald-300 border-slate-200 hover:border-slate-200"
                            }`}
                            title="تبييض أرضية البطاقة وإبراز سواد الأرقام والحبر"
                          >
                            <Wand2 className="w-3 h-3" />
                            <span>سحر كام سكانر</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CamScanner Pro 4-Corner Quad Perspective Modal */}
      {cropTarget && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Scan className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    قص وضبط أركان البطاقة الأربعة (OpenCV.js & CamScanner)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    اسحب الدوائر الأربعة بالماوس فوق زوايا البطاقة بالضبط لتعديل المنظور واستواء الكادر
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCropTarget(null)}
                className="text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Interactive 4-Corner Editor Container */}
            <div
              ref={cropContainerRef}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="relative w-full aspect-[4/3] bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 select-none touch-none flex items-center justify-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cropTarget.cardSide.originalSrc}
                alt="Source Card"
                className="w-full h-full object-contain pointer-events-none"
              />

              {/* SVG Quadrilateral Polygon Overlay */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                <polygon
                  points={`
                    ${quadCorners.tl.x * 100}%,${quadCorners.tl.y * 100}%
                    ${quadCorners.tr.x * 100}%,${quadCorners.tr.y * 100}%
                    ${quadCorners.br.x * 100}%,${quadCorners.br.y * 100}%
                    ${quadCorners.bl.x * 100}%,${quadCorners.bl.y * 100}%
                  `}
                  fill="rgba(245, 158, 11, 0.15)"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeDasharray="4 3"
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
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-white bg-amber-500 shadow-xs cursor-grab active:cursor-grabbing flex items-center justify-center hover:scale-125 transition-transform z-20 group touch-none"
                    title={`اسحب زاوية ${label}`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-50" />
                    <span className="absolute -bottom-6 px-1.5 py-0.5 rounded bg-white text-[10px] font-bold text-amber-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {label}
                    </span>
                  </div>
                );
              })}

              {/* Loupe / Magnifying Lens Preview */}
              {activeCornerDrag && loupePoint && (
                <div className="absolute top-3 left-3 w-28 h-28 rounded-full border-2 border-amber-400 shadow-2xl overflow-hidden bg-white z-30 pointer-events-none">
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
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-5 h-0.5 bg-amber-400" />
                    <div className="h-5 w-0.5 bg-amber-400 absolute" />
                  </div>
                  <div className="absolute bottom-1 inset-x-0 text-center">
                    <span className="text-[9px] font-black bg-slate-50/90 text-amber-400 px-1.5 py-0.5 rounded-full">
                      مكبرة 3.5x
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Presets & Controls */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">خيارات ضبط الكادر:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAutoDetectCorners}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-amber-400 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border border-amber-500/20"
                    title="كشف حدود البطاقة وتوجيه الأركان الأربعة آلياً بمكتبة OpenCV"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>كشف الزوايا التلقائي (OpenCV)</span>
                  </button>

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
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
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
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
                  >
                    كامل الصورة
                  </button>
                </div>
              </div>

              {/* CamScanner Magic Mode Switch */}
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-amber-500/40 transition">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">سحر كام سكانر (Magic Color)</span>
                    <span className="text-[10px] text-slate-500 block">تبييض الأرضية وإزالة الظلال مع إبراز سواد أرقام البطاقة</span>
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
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleApplyCrop}
                className="flex-1 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-white transition cursor-pointer shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5"
              >
                <Scan className="w-4 h-4" />
                <span>تطبيق وقص المنظور (Warp Perspective)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fine-Angle Rotation Modal */}
      {editingTarget && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <RotateCw className="w-4 h-4 text-blue-400" />
                <h3 className="text-base font-black text-slate-900">
                  تدوير دقيق لوجه البطاقة ({editingTarget.side === "front" ? "الوش" : "الضهر"})
                </h3>
              </div>
              <button
                onClick={() => setEditingTarget(null)}
                className="text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-[8.56/5.4] bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center p-2">
              <NextImage
                src={editingTarget.cardSide.processedSrc}
                alt="Card Face"
                width={400}
                height={252}
                unoptimized
                style={{ transform: `rotate(${fineAngle}deg)` }}
                className="max-w-full max-h-full object-contain transition-transform"
              />
            </div>

            <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
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
                  className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  -90° يسار
                </button>
                <button
                  onClick={() => setFineAngle(0)}
                  className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs transition cursor-pointer"
                >
                  إلغاء الميلان (0°)
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
                onClick={() => setEditingTarget(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
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

      {/* Direct Browser Print & High-Res Sheet Preview Modal */}
      {printPreviewPair && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    معاينة ورقة الطباعة {paperSize} (مقاس البطاقة: 85.6mm × 54mm)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    محاذاة الطباعة المزدوجة: {duplexAlignment === "vertical" ? "رأسية (Vertical Duplex)" : "أفقية (Horizontal Duplex)"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setPrintPreviewPair(null);
                  setPrintPreviewDataUrl(null);
                }}
                className="text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-center bg-slate-50 p-4 rounded-2xl border border-slate-200 min-h-[300px]">
              {isGeneratingPrintPreview ? (
                <div className="text-center text-slate-500 text-xs">جاري تجهيز ورقة الطباعة الدقيقة...</div>
              ) : printPreviewDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={printPreviewDataUrl}
                  alt="Sheet Preview"
                  className="max-h-[60vh] object-contain rounded-lg shadow-2xl border border-slate-200 bg-white"
                />
              ) : (
                <div className="text-xs text-rose-600">تعذر توليد المعاينة</div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPrintPreviewPair(null);
                  setPrintPreviewDataUrl(null);
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={triggerDirectPrint}
                disabled={!printPreviewDataUrl}
                className="flex-1 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الورقة الآن (Print)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
