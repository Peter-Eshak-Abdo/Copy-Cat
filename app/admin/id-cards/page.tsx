"use client";

import { useState, useRef, useEffect } from "react";
import NextImage from "next/image";
import {
  Upload,
  FileDown,
  Trash2,
  RotateCw,
  Sparkles,
  CheckCircle2,
  ArrowUpDown,
  Zap,
  ChevronUp,
  ChevronDown,
  X,
  RotateCcw,
  Wand2,
  Scan,
  Printer,
  Sliders,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { generateIdCardsDocx, PaperSize, DuplexAlignment } from "@/lib/docx/id-cards-docx";
import { processImageOnCanvas, CropRect, QuadCorners, Point2D, detectCardCorners } from "@/lib/canvas-filters";
import { detectCardCornersOpenCV } from "@/lib/opencv-loader";
import { useToast } from "@/components/toast-provider";
import { detectHeadLocally, warmUpFaceDetector } from "@/lib/face-fallback";

/** Portrait on a straightened card side (in-browser BlazeFace); null on a back side */
async function findFaceOnCard(src: string): Promise<{ rotation: number } | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = src;
    });
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d")?.drawImage(img, 0, 0);
    const face = await detectHeadLocally(c);
    return face ? { rotation: face.rotation } : null;
  } catch {
    return null;
  }
}
import { readFileAsDataURL, getFriendlyErrorMessage } from "@/lib/utils";
import { landscapeQuad, pairCardSides, sameCardNumber, turnQuad, type ScannedSide } from "@/lib/card-pairing";

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
  /** Side and national number the AI read, used to complete a card from a later upload */
  scan?: ScannedSide;
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
  const [isAiSnappingCorners, setIsAiSnappingCorners] = useState<boolean>(false);
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
          resolve(c.toDataURL("image/jpeg", 0.86));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Upload queue: photos dropped while a batch is running join that batch instead of starting a second
  // run that raced the first one (the first batch never showed up)
  const queueRef = useRef<File[]>([]);
  // The face detector (fallback for front / back and direction) downloads in the background on page open
  useEffect(() => {
    const t = window.setTimeout(warmUpFaceDetector, 1500);
    return () => window.clearTimeout(t);
  }, []);
  const runningRef = useRef(false);
  const [progress, setProgress] = useState<{ total: number; done: number } | null>(null);

  /** Straightens one photo: AI corners and direction, OpenCV / Sobel edges as fallback */
  const processOneSide = async (file: File): Promise<{ side: CardSide; scan: ScannedSide }> => {
    const originalSrc = await readAndOptimizeImage(file);

    // 1. AI corners first: edge detectors latch onto fingers, desk grain and backgrounds, while the
    // vision model finds the card itself and extends its edges under a thumb. The corners come back already
    // renamed for the card's own direction, so a card photographed sideways comes out upright.
    let aiQuad: QuadCorners | null = null;
    let aiTurned = false;
    let scan: ScannedSide = { side: "unknown", nationalId: null };
    try {
      const res = await fetch("/api/admin/card-align", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: originalSrc }),
      });
      const data = await res.json();
      if (data.success && data.corners) aiQuad = data.corners;
      aiTurned = typeof data.rotation === "number";
      scan = {
        side: data.side === "front" || data.side === "back" ? data.side : "unknown",
        nationalId: data.nationalId || null,
        idTail: data.idTail || null,
      };
    } catch {}

    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => resolve(null);
      el.src = originalSrc;
    });
    const inset: QuadCorners = {
      tl: { x: 0.04, y: 0.06 },
      tr: { x: 0.96, y: 0.06 },
      br: { x: 0.96, y: 0.94 },
      bl: { x: 0.04, y: 0.94 },
    };

    // 2. Fallback: OpenCV or native Canvas Sobel edge detection
    let quad: QuadCorners = aiQuad ?? inset;
    if (!aiQuad && img) {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          quad =
            window.cv && window.cv.Mat
              ? await detectCardCornersOpenCV(c).catch(() => detectCardCorners(c))
              : detectCardCorners(c);
        }
      } catch {}
    }
    // Without the AI's direction a card is at least made landscape (a sideways photo came out squashed)
    if (!aiTurned && img) quad = landscapeQuad(quad, img.naturalWidth, img.naturalHeight) as QuadCorners;

    // 3. Perspective warp, CamScanner whitening and sharpening
    const initialBrightness = 118;
    const initialContrast = 105;
    const initialSharpness = 45;
    const warp = (q: QuadCorners) =>
      processSideImage(originalSrc, initialBrightness, initialContrast, initialSharpness, 0, undefined, q, true, false);
    let processedSrc = await warp(quad);

    // 4. No answer from the AI about the side (quota used up, no internet): the front is the side with the
    // portrait, so the face detector in the browser decides, and the face's direction turns the card upright
    if (scan.side === "unknown" || !aiTurned) {
      const face = await findFaceOnCard(processedSrc);
      if (scan.side === "unknown") scan = { ...scan, side: face ? "front" : "back" };
      if (face && face.rotation && !aiTurned) {
        quad = turnQuad(quad, face.rotation) as QuadCorners;
        processedSrc = await warp(quad);
      }
    }

    return {
      scan,
      side: {
        id: Math.random().toString(36).substring(2, 9),
        name: file.name,
        originalSrc,
        processedSrc,
        rotation: 0,
        brightness: initialBrightness,
        contrast: initialContrast,
        sharpness: initialSharpness,
        bakedBrightness: initialBrightness,
        bakedContrast: initialContrast,
        bakedSharpness: initialSharpness,
        thresholdMode: false,
        sideType: scan.side === "back" ? "back" : "front",
        quad,
        camScannerMode: true,
        scan,
      },
    };
  };

  /** Pairs a finished batch, and lets a lone side complete an earlier card that is missing it */
  const addBatch = (batch: Array<{ side: CardSide; scan: ScannedSide }>) => {
    const pairing = pairCardSides(batch.map((b) => b.scan));
    setPairs((prev) => {
      const merged = prev.map((p) => ({ ...p }));
      const fresh: CardPair[] = [];
      for (const p of pairing) {
        const front = p.front !== null ? { ...batch[p.front].side, sideType: "front" as const } : null;
        const back = p.back !== null ? { ...batch[p.back].side, sideType: "back" as const } : null;
        const lone = front ?? back;
        if (lone?.scan && !(front && back)) {
          const loneScan = lone.scan;
          const target = merged.find((m) => {
            const have = front ? m.back : m.front;
            const missing = front ? m.front : m.back;
            return !missing && !!have?.scan && sameCardNumber(have.scan, loneScan);
          });
          if (target) {
            if (front) target.front = front;
            else target.back = back;
            continue;
          }
        }
        const label = p.nationalId || (p.idTail ? `...${p.idTail}` : "");
        fresh.push({
          pairId: Math.random().toString(36).substring(2, 9),
          cardName: `بطاقة ${merged.length + fresh.length + 1}${label ? ` (${label})` : ""}${
            p.guessed ? " - اتأكد إن الوش مع ضهره" : ""
          }`,
          front,
          back,
        });
      }
      return [...merged, ...fresh];
    });
    const cards = pairing.length;
    const complete = pairing.filter((p) => p.front !== null && p.back !== null).length;
    const guessedCount = pairing.filter((p) => p.guessed).length;
    if (guessedCount > 0) {
      toast.warning(
        "رقم قومي مش مقري",
        `${guessedCount} بطاقة اتحط وشها مع ضهرها بترتيب الرفع مش بالرقم القومي. بص عليهم، ولو في غلط استخدم زرار «بدّل الوش والضهر».`
      );
    }
    toast.success(
      "الصور جاهزة",
      `ظبطنا ${batch.length} صورة: ${complete} بطاقة وشها مع ضهرها${
        cards - complete
          ? `، و${cards - complete} ناقصها وش أو ضهر (لو ليها صورة تانية ارفعها وهتتحط مكانها لوحدها)`
          : ""
      }.`
    );
  };

  const processFiles = async (fileList: File[]) => {
    if (!fileList || fileList.length === 0) return;
    const images = fileList.filter((f) => f.type.startsWith("image/"));
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (images.length < fileList.length) {
      toast.warning("في ملفات اتسابت", `${fileList.length - images.length} ملف مش صور، سبناهم.`);
    }
    if (images.length === 0) return;

    queueRef.current.push(...images);
    setProgress((p) => ({ total: (p?.total ?? 0) + images.length, done: p?.done ?? 0 }));
    if (runningRef.current) {
      toast.info("ضفناهم على الشغل", `${images.length} صورة زيادة، هنظبطهم مع اللي شغالين فيهم.`);
      return;
    }

    toast.info("استلمنا الصور", `${images.length} صورة، بنظبطهم دلوقتي...`);
    runningRef.current = true;
    const batch: Array<{ side: CardSide; scan: ScannedSide }> = [];
    let failed = 0;
    try {
      // Two photos at a time (more only hits the AI's per-minute limit); results keep the upload order
      while (queueRef.current.length > 0) {
        const chunk = queueRef.current.splice(0, 2);
        const results = await Promise.all(
          chunk.map((f) =>
            processOneSide(f).catch((err) => {
              console.error(`Error reading card image ${f.name}:`, err);
              return null;
            })
          )
        );
        for (const r of results) {
          if (r) batch.push(r);
          else failed++;
        }
        setProgress((p) => (p ? { ...p, done: p.done + chunk.length } : p));
      }
      if (batch.length > 0) addBatch(batch);
      if (failed > 0) toast.warning("في صور معرفناش نفتحها", `${failed} صورة باظت أو مش مدعومة.`);
    } finally {
      runningRef.current = false;
      setProgress(null);
    }
  };

  /** Quarter turn of a straightened side (the corners are renamed, so the warp itself turns) */
  const turnSideQuarter = (pairId: string, side: "front" | "back") => {
    const target = pairs.find((p) => p.pairId === pairId)?.[side];
    if (!target) return;
    const quad: QuadCorners = target.quad ?? {
      tl: { x: 0, y: 0 },
      tr: { x: 1, y: 0 },
      br: { x: 1, y: 1 },
      bl: { x: 0, y: 1 },
    };
    updateSideProperty(pairId, side, { quad: turnQuad(quad, 90) as QuadCorners });
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
    toast.success("الفلتر اتطبق على الكل", "كل البطاقات اتفتحت والأرقام فضلت واضحة.");
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
    toast.success("البطاقة اتقصت واتعدلت", "عدّل القص اتظبطت والبطاقة بقت مفرودة.");
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
          "لقينا أركان البطاقة ✨",
          "لو في ركن مش مظبوط اسحبه بالماوس."
        );
      }
    };
  };

  // AI Smart Snap: Detects 4 corners and extrapolates true card border through hand/fingers
  const handleAiSnapCorners = async () => {
    if (!cropTarget) return;
    setIsAiSnappingCorners(true);
    try {
      const res = await fetch("/api/admin/card-align", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: cropTarget.cardSide.originalSrc,
        }),
      });
      const data = await res.json();
      if (data.success && data.corners) {
        setQuadCorners(data.corners);
        toast.success(
          "الذكاء الاصطناعي لقى أركان البطاقة ✨",
          "حدد البطاقة بالظبط حتى لو في صوابع أو مكتب في الصورة."
        );
      } else {
        await handleAutoDetectCorners();
      }
    } catch {
      await handleAutoDetectCorners();
    } finally {
      setIsAiSnappingCorners(false);
    }
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
        `ملف Word نزل (${paperSize})`,
        `${pairs.length} بطاقة (الوش مع الضهر) بمقاس البطاقة الحقيقي 85.6×54 مم، والوش والضهر ${duplexAlignment === "vertical" ? "تحت بعض" : "جنب بعض"}.`
      );
    } catch (err) {
      console.error("Error generating docx:", err);
      toast.error(
        "ملف Word منزلش",
        getFriendlyErrorMessage(err, "جرب تاني.")
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
      toast.warning("اسمح للموقع يفتح نوافذ جديدة (Pop-ups) عشان الطباعة تشتغل");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <title>طباعة بطاقة - Copy-Cat</title>
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
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-slate-800">البطايق (وش وضهر)</span>
          {pairs.length > 0 && (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-100">
              {pairs.length} بطاقة
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {pairs.length > 0 && (
            <button
              onClick={() => setPairs([])}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
            >
              امسح الكل
            </button>
          )}

          <button
            onClick={handleExportWord}
            disabled={pairs.length === 0 || isGenerating}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>{isGenerating ? "بنجهز الملف..." : `نزّل Word (${paperSize})`}</span>
          </button>
        </div>
      </div>

      {/* Configuration Bar: Paper Size & Duplex Alignment */}
      <div className="bg-white border-2 border-slate-200/90 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Paper Size selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-500" /> مقاس الورقة:
            </span>
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setPaperSize("A4")}
                className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-black transition cursor-pointer ${
                  paperSize === "A4" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                A4 (العادي)
              </button>
              <button
                type="button"
                onClick={() => setPaperSize("A5")}
                className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-black transition cursor-pointer ${
                  paperSize === "A5" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                A5 (نص A4)
              </button>
            </div>
          </div>

          {/* Duplex Alignment selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <ArrowUpDown className="w-4 h-4 text-emerald-500" /> مكان الوش والضهر:
            </span>
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setDuplexAlignment("vertical")}
                className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-black transition cursor-pointer ${
                  duplexAlignment === "vertical"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="الوش فوق والضهر تحته بالظبط، عشان لما تقلب الورقة ييجوا على بعض"
              >
                تحت بعض
              </button>
              <button
                type="button"
                onClick={() => setDuplexAlignment("horizontal")}
                className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-black transition cursor-pointer ${
                  duplexAlignment === "horizontal"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="الوش والضهر جنب بعض في نفس السطر"
              >
                جنب بعض
              </button>
            </div>
          </div>
        </div>

        {/* Global Quick Presets */}
        <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-200">
          <span className="text-sm font-bold text-slate-700">فلاتر للكل:</span>
          <button
            onClick={() => applyGlobalEnhancement(50, 118)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer ${
              globalBrightness === 118
                ? "bg-blue-600 text-white shadow-md font-black"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>فتّح شوية</span>
          </button>

          <button
            onClick={() => applyGlobalEnhancement(70, 132)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer ${
              globalBrightness === 132
                ? "bg-cyan-600 text-white shadow-md font-black"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Zap className="w-4 h-4 text-yellow-500" />
            <span>فتّح جامد (للصور الضلمة)</span>
          </button>

          <button
            onClick={() => applyGlobalEnhancement(0, 100)}
            className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition cursor-pointer mr-auto"
          >
            رجّعها زي الأول
          </button>
        </div>
      </div>

      {/* Upload Box with Drag & Drop */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed transition-all rounded-2xl sm:rounded-3xl p-10 sm:p-14 text-center cursor-pointer flex flex-col items-center justify-center gap-4 group ${
          isDragging
            ? "border-blue-500 bg-blue-50 scale-[1.01] shadow-2xl shadow-blue-500/10"
            : "border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-white"
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

        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
          <Upload className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>

        <div>
          <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-1.5">
            {isDragging ? "سيب الصور هنا" : "دوس هنا وارفع صور البطاقات، أو اسحبها وسيبها هنا"}
          </h3>
          <p className="text-slate-500 text-xs sm:text-sm font-medium">
            ارفع صور الوش والضهر مع بعض بأي ترتيب. البرنامج بيقص البطاقة ويعدلها لو متصورة بالعرض أو بالمقلوب، وبيحط كل وش مع ضهره بالرقم القومي.
          </p>
        </div>
      </div>

      {/* Progress of the running batch; photos added meanwhile join it */}
      {progress && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-200" role="status" aria-live="polite">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
          <div className="flex-1 space-y-1.5">
            <p className="text-sm font-bold text-blue-900">
              استلمنا {progress.total} صورة، وبنظبطهم دلوقتي ({progress.done} من {progress.total} خلصوا)
            </p>
            <p className="text-xs text-blue-700">
              لو عندك صور تانية ارفعها عادي، هتتضاف على الشغل ومش هتوقف اللي شغالين فيه.
            </p>
            <div className="h-1.5 rounded-full bg-blue-100 overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-500"
                style={{ width: `${Math.max(5, (progress.done / Math.max(1, progress.total)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Pairs Container */}
      {pairs.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              عندك <strong className="text-slate-900 font-bold">{pairs.length} بطاقة</strong> ({totalFacesCount} صورة وش وضهر جاهزين للطباعة)
            </span>
            <span className="text-blue-400 font-bold">
              البطاقة بتتطبع بمقاسها الحقيقي 85.6 × 54 مم
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
                      title="شوف الورقة واطبعها على طول"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>معاينة وطباعة الورقة ({paperSize})</span>
                    </button>

                    {/* Swap Front / Back */}
                    <button
                      onClick={() => swapPairSides(pair.pairId)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:text-white hover:bg-blue-600 transition text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="بدّل الوش مكان الضهر"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">بدّل الوش والضهر</span>
                    </button>

                    {/* Reorder Buttons */}
                    <button
                      onClick={() => movePair(index, "up")}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition disabled:opacity-30 cursor-pointer"
                      title="طلّعها فوق"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => movePair(index, "down")}
                      disabled={index === pairs.length - 1}
                      className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition disabled:opacity-30 cursor-pointer"
                      title="نزّلها تحت"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {/* Delete Pair */}
                    <button
                      onClick={() => removePair(pair.pairId)}
                      className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition cursor-pointer"
                      title="امسح البطاقة دي"
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
                        <span>الوش</span>
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
                            title="حرّك عدّل القص بالماوس عشان تعدل القص"
                          >
                            <Scan className="w-3 h-3" />
                            <span>عدّل القص</span>
                          </button>

                          {/* Quarter turn: sideways card */}
                          <button
                            onClick={() => turnSideQuarter(pair.pairId, "front")}
                            className="p-1 rounded-lg bg-slate-100 text-slate-700 hover:text-slate-900 transition cursor-pointer"
                            title="لف البطاقة ربع لفة (90°)"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
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
                            title="لف بزاوية صغيرة"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset */}
                          <button
                            onClick={() => resetSide(pair.pairId, "front")}
                            className="p-1 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                            title="رجّعها زي الأول"
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
                        <span className="text-xs text-slate-600">مفيش صورة</span>
                      )}
                    </div>

                    {/* Front Live Sliders & Controls */}
                    {pair.front && (
                      <div className="space-y-2 pt-1">
                        {/* Brightness Slider */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-14 text-slate-500 font-bold">الإضاءة:</span>
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
                            title="أبيض وأسود بس، واضح في التصوير"
                          >
                            <Sliders className="w-3 h-3" />
                            <span>{pair.front.thresholdMode ? "رجّع الألوان" : "أبيض وأسود"}</span>
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
                            title="بيبيّض أرضية البطاقة ويغمّق الأرقام والكلام"
                          >
                            <Wand2 className="w-3 h-3" />
                            <span>تبييض زي الماسح</span>
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
                        <span>الضهر</span>
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
                            title="حرّك عدّل القص بالماوس عشان تعدل القص"
                          >
                            <Scan className="w-3 h-3" />
                            <span>عدّل القص</span>
                          </button>

                          {/* Quarter turn: sideways card */}
                          <button
                            onClick={() => turnSideQuarter(pair.pairId, "back")}
                            className="p-1 rounded-lg bg-slate-100 text-slate-700 hover:text-slate-900 transition cursor-pointer"
                            title="لف البطاقة ربع لفة (90°)"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
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
                            title="لف بزاوية صغيرة"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset */}
                          <button
                            onClick={() => resetSide(pair.pairId, "back")}
                            className="p-1 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                            title="رجّعها زي الأول"
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
                        <span className="text-xs text-slate-600">مفيش صورة</span>
                      )}
                    </div>

                    {/* Back Live Sliders & Controls */}
                    {pair.back && (
                      <div className="space-y-2 pt-1">
                        {/* Brightness Slider */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="w-14 text-slate-500 font-bold">الإضاءة:</span>
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
                            title="أبيض وأسود بس، واضح في التصوير"
                          >
                            <Sliders className="w-3 h-3" />
                            <span>{pair.back.thresholdMode ? "رجّع الألوان" : "أبيض وأسود"}</span>
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
                            title="بيبيّض أرضية البطاقة ويغمّق الأرقام والكلام"
                          >
                            <Wand2 className="w-3 h-3" />
                            <span>تبييض زي الماسح</span>
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
                    عدّل قص البطاقة
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    اسحب كل دايرة من الأربعة وحطها على ركن البطاقة بالظبط
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
                    ? "فوق شمال"
                    : key === "tr"
                    ? "فوق يمين"
                    : key === "br"
                    ? "تحت يمين"
                    : "تحت شمال";
                return (
                  <div
                    key={key}
                    style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%` }}
                    onPointerDown={(e) => handleCornerPointerDown(key, e)}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-white bg-amber-500 shadow-xs cursor-grab active:cursor-grabbing flex items-center justify-center hover:scale-125 transition-transform z-20 group touch-none"
                    title={`اسحب ركن ${label}`}
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
                      مكبّرة 3.5 مرة
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Presets & Controls */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">اختيارات القص:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAiSnapCorners}
                    disabled={isAiSnappingCorners}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    title="خلّي الذكاء الاصطناعي يلاقي الأركان (حتى لو في صوابع أو مكتب في الصورة)"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isAiSnappingCorners ? "animate-spin" : ""}`} />
                    <span>{isAiSnappingCorners ? "بندوّر..." : "لاقي الأركان بالذكاء الاصطناعي"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAutoDetectCorners}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-amber-500 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border border-amber-500/20"
                    title="لاقي حدود البطاقة من على الجهاز (من غير نت)"
                  >
                    <Scan className="w-3.5 h-3.5" />
                    <span>لاقي الأركان لوحده</span>
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
                    مقاس بطاقة عادي
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
                    الصورة كلها
                  </button>
                </div>
              </div>

              {/* CamScanner Magic Mode Switch */}
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-amber-500/40 transition">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">تبييض زي الماسح</span>
                    <span className="text-[10px] text-slate-500 block">بيبيّض الأرضية ويشيل الضل ويغمّق الأرقام</span>
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
                <span>قص وعدّل</span>
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
                  لف بزاوية صغيرة لوجه البطاقة ({editingTarget.side === "front" ? "الوش" : "الضهر"})
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
                <span>زاوية اللف:</span>
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
                لف
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
                    محاذاة الطباعة المزدوجة: {duplexAlignment === "vertical" ? "تحت بعض" : "جنب بعض"}
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
                <div className="text-center text-slate-500 text-xs">بنجهز ورقة الطباعة...</div>
              ) : printPreviewDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={printPreviewDataUrl}
                  alt="Sheet Preview"
                  className="max-h-[60vh] object-contain rounded-lg shadow-2xl border border-slate-200 bg-white"
                />
              ) : (
                <div className="text-xs text-rose-600">مقدرناش نجهز الورقة</div>
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
                اقفل
              </button>
              <button
                type="button"
                onClick={triggerDirectPrint}
                disabled={!printPreviewDataUrl}
                className="flex-1 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>اطبع</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
