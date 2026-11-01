"use client";

import { useState, useRef, useEffect } from "react";
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
  Wand2,
} from "lucide-react";
import { generatePassportPhotosDocx } from "@/lib/docx/passport-docx";
import { useToast } from "@/components/toast-provider";
import { getFriendlyErrorMessage, readFileAsDataURL } from "@/lib/utils";
import {
  autoEnhanceCanvas,
  enhanceAndFramePassportPhoto,
  extractHeadRegion,
  rotateCanvasClockwise,
  FRAME_BORDER_PX,
  FRAME_H,
  FRAME_W,
  HeadBox,
} from "@/lib/portrait-enhancer";
import { detectHeadLocally, warmUpFaceDetector } from "@/lib/face-fallback";

/** Height of the optional name strip at the bottom of the photo: 8mm of the 52mm print */
const NAME_STRIP_MM = 8;

/**
 * Same 40x52mm photo with its bottom 8mm turned into a white strip carrying the name (the photo keeps its
 * printed size; the frame crops the lowest part of the shoulders instead).
 */
async function composeNameStrip(framedDataUrl: string, name: string): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = framedDataUrl;
  });
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const strip = Math.round((H * NAME_STRIP_MM) / 52);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return framedDataUrl;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H - strip, 0, 0, W, H - strip);
  // Thin rule between photo and name, then the name sized to fit the strip
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, H - strip - 1, W, 2);
  let size = Math.round(strip * 0.55);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  const fit = () => {
    ctx.font = `bold ${size}px Arial, "Segoe UI", sans-serif`;
    return ctx.measureText(name).width;
  };
  while (size > 12 && fit() > W * 0.9) size -= 2;
  ctx.fillText(name, W / 2, H - strip / 2 + 1);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = FRAME_BORDER_PX;
  ctx.strokeRect(FRAME_BORDER_PX / 2, FRAME_BORDER_PX / 2, W - FRAME_BORDER_PX, H - FRAME_BORDER_PX);
  return canvas.toDataURL("image/jpeg", 0.96);
}

/** The photo as printed: with the name strip when the person has it switched on */
function printedImage(p: PhotoPerson): string {
  return p.includeName && p.namedDataUrl ? p.namedDataUrl : p.imageDataUrl;
}

/**
 * Head box [ymin, xmin, ymax, xmax] (0..1000) estimated from a cut-out's alpha mask, for photos where no
 * face detector answered (full-body shots, quota used up): the head is the narrow top of the silhouette,
 * and it ends where the outline widens into the shoulders.
 */
function headBoxFromMask(cutout: HTMLCanvasElement): HeadBox | undefined {
  const scale = Math.min(1, 400 / Math.max(cutout.width, cutout.height));
  const w = Math.max(1, Math.round(cutout.width * scale));
  const h = Math.max(1, Math.round(cutout.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return undefined;
  ctx.drawImage(cutout, 0, 0, w, h);
  const a = ctx.getImageData(0, 0, w, h).data;
  const rows: Array<{ l: number; r: number } | null> = [];
  for (let y = 0; y < h; y++) {
    let l = -1;
    let r = -1;
    for (let x = 0; x < w; x++) {
      if (a[(y * w + x) * 4 + 3] > 128) {
        if (l < 0) l = x;
        r = x;
      }
    }
    rows.push(l < 0 ? null : { l, r });
  }
  const top = rows.findIndex((r) => r && r.r - r.l > w * 0.02);
  if (top < 0) return undefined;
  let headW = 0;
  let bottom = h - 1;
  for (let y = top; y < h; y++) {
    const row = rows[y];
    if (!row) continue;
    const width = row.r - row.l;
    // Past a head-sized stretch, a row much wider than the head so far is the shoulders
    if (y - top > headW * 0.9 && headW > 0 && width > headW * 1.45) {
      bottom = y;
      break;
    }
    headW = Math.max(headW, width);
  }
  const headRows = rows.slice(top, bottom).filter(Boolean) as Array<{ l: number; r: number }>;
  if (headRows.length < 3) return undefined;
  const l = Math.min(...headRows.map((r) => r.l));
  const r = Math.max(...headRows.map((r) => r.r));
  // The outline ends at the neck; the chin sits a little above that
  const chin = top + (bottom - top) * 0.92;
  return [(top / h) * 1000, (l / w) * 1000, (chin / h) * 1000, (r / w) * 1000];
}

/** A cut-out that kept almost every pixel (or none) did not actually remove the background */
function maskLooksValid(cutout: HTMLCanvasElement): boolean {
  const w = 120;
  const h = Math.max(1, Math.round((cutout.height / cutout.width) * 120));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return true;
  ctx.drawImage(cutout, 0, 0, w, h);
  const a = ctx.getImageData(0, 0, w, h).data;
  let opaque = 0;
  for (let i = 3; i < a.length; i += 4) if (a[i] > 128) opaque++;
  const share = opaque / (w * h);
  return share > 0.03 && share < 0.97;
}

/** Decodes a photo (EXIF orientation applied by the browser) onto a canvas, long side capped at maxSide */
async function loadImageToCanvas(file: Blob, maxSide: number): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function downscaleCanvas(src: HTMLCanvasElement, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  if (scale === 1) return src;
  const out = document.createElement("canvas");
  out.width = Math.round(src.width * scale);
  out.height = Math.round(src.height * scale);
  const ctx = out.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, out.width, out.height);
  }
  return out;
}

function canvasToPreviewDataUrl(src: HTMLCanvasElement, maxSide: number): string {
  return downscaleCanvas(src, maxSide).toDataURL("image/jpeg", 0.9);
}

function canvasToBlob(canvas: HTMLCanvasElement, type = "image/jpeg"): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, 0.95)
  );
}

/**
 * remove.bg's free calls return a preview-size cut-out (~0.25MP). Its alpha channel is scaled up and used
 * as a mask over the full-resolution photo, so the face keeps its sharpness and only the edge mask is upscaled.
 */
async function applyCutoutMask(photo: HTMLCanvasElement, cutoutDataUrl: string): Promise<HTMLCanvasElement> {
  const cutout = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = cutoutDataUrl;
  });
  const out = document.createElement("canvas");
  out.width = photo.width;
  out.height = photo.height;
  const ctx = out.getContext("2d");
  if (!ctx) return photo;
  ctx.drawImage(photo, 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cutout, 0, 0, out.width, out.height);
  ctx.globalCompositeOperation = "source-over";
  return out;
}

/**
 * Server AI restoration (/api/admin/enhance-photo: Gemini image -> Replicate CodeFormer). Image models
 * answer in fixed aspect ratios, so the photo is padded to 3:4, sent, and the padding cropped back off.
 * Returns a canvas the size of `photo`, or null when no provider was available (the caller keeps going).
 */
async function aiRestorePhoto(photo: HTMLCanvasElement): Promise<HTMLCanvasElement | null> {
  const ratio = 3 / 4;
  const padW = Math.max(photo.width, Math.round(photo.height * ratio));
  const padH = Math.max(photo.height, Math.round(photo.width / ratio));
  const ox = Math.round((padW - photo.width) / 2);
  const oy = Math.round((padH - photo.height) / 2);
  const padded = document.createElement("canvas");
  padded.width = padW;
  padded.height = padH;
  const pctx = padded.getContext("2d");
  if (!pctx) return null;
  pctx.fillStyle = "#ffffff";
  pctx.fillRect(0, 0, padW, padH);
  pctx.drawImage(photo, ox, oy);

  try {
    const res = await fetch("/api/admin/enhance-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: canvasToPreviewDataUrl(padded, 1536) }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.imageBase64 !== "string") return null;

    const restored = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = data.imageBase64;
    });
    // A result in another aspect ratio was re-framed by the model and would misplace the head box
    if (Math.abs(restored.naturalWidth / restored.naturalHeight - padW / padH) > 0.03) return null;

    const sx = restored.naturalWidth / padW;
    const sy = restored.naturalHeight / padH;
    // An upscaling model (CodeFormer x2) keeps its extra detail, up to twice the input size
    const k = Math.min(2, Math.max(1, sx));
    const out = document.createElement("canvas");
    out.width = Math.round(photo.width * k);
    out.height = Math.round(photo.height * k);
    const octx = out.getContext("2d");
    if (!octx) return null;
    octx.imageSmoothingQuality = "high";
    octx.drawImage(restored, ox * sx, oy * sy, photo.width * sx, photo.height * sy, 0, 0, out.width, out.height);
    return out;
  } catch {
    return null;
  }
}

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
  /** imageDataUrl with the name strip, rebuilt whenever the photo or the name changes */
  namedDataUrl?: string;
  namedFor?: string;
}

export default function PassportPhotosPage() {
  const { toast } = useToast();
  const [persons, setPersons] = useState<PhotoPerson[]>([]);
  const [isProcessingBg, setIsProcessingBg] = useState(false);
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [globalIncludeName] = useState(false);
  // AI restoration (free Hugging Face spaces) can take 1-2 minutes a photo, so it is opt-in
  const [aiEnhance, setAiEnhance] = useState(false);
  // In-browser tools downloaded in the background when the page opens (see the warm-up effect)
  const [toolsState, setToolsState] = useState<"idle" | "loading" | "ready" | "failed">("idle");

  // Warm-up: the face detector (~1MB) and the background-removal model (~40MB) start downloading while the
  // page is idle, and the service worker keeps them, so a slow line pays for them once and the fallback is
  // ready the moment remove.bg or Gemini cannot answer
  useEffect(() => {
    let cancelled = false;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;
    const start = () => {
      if (cancelled) return;
      setToolsState("loading");
      warmUpFaceDetector();
      import("@imgly/background-removal")
        .then((m) => m.preload({ model: "isnet_fp16", output: { format: "image/png" } }))
        .then(() => !cancelled && setToolsState("ready"))
        .catch(() => !cancelled && setToolsState("failed"));
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const id = w.requestIdleCallback ? w.requestIdleCallback(start) : window.setTimeout(start, 1500);
    return () => {
      cancelled = true;
      if (!w.requestIdleCallback) window.clearTimeout(id);
    };
  }, []);
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
    const targetW = FRAME_W;
    const targetH = FRAME_H;
    // Pan offsets are stored in the original 400px frame units
    const panScale = FRAME_W / 400;

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
    ctx.translate(targetW / 2 + panX * panScale, targetH / 2 + panY * panScale);
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
    ctx.lineWidth = FRAME_BORDER_PX;
    ctx.strokeRect(FRAME_BORDER_PX / 2, FRAME_BORDER_PX / 2, targetW - FRAME_BORDER_PX, targetH - FRAME_BORDER_PX);

    return canvas.toDataURL("image/jpeg", 0.96);
  };

  // Upload queue: photos added while others are being prepared join the running job (a second upload used
  // to start a parallel run that interrupted the first one)
  const queueRef = useRef<File[]>([]);
  const runningRef = useRef(false);
  const doneRef = useRef(0);
  const totalRef = useRef(0);
  const quotaWarnedRef = useRef(false);
  const [progress, setProgress] = useState<{ total: number; done: number } | null>(null);

  const processFiles = async (fileList: File[]) => {
    if (!fileList || fileList.length === 0) return;
    const images = fileList.filter((f) => f.type.startsWith("image/"));
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (images.length === 0) {
      toast.warning("الملف ده مش صورة", "اختار صور بس (JPG أو PNG)");
      return;
    }

    queueRef.current.push(...images);
    totalRef.current += images.length;
    setProgress({ total: totalRef.current, done: doneRef.current });
    if (runningRef.current) {
      toast.info("ضفناهم على الشغل", `${images.length} صورة زيادة، هنظبطهم بعد اللي شغالين فيهم.`);
      return;
    }

    runningRef.current = true;
    setIsProcessingBg(true);
    toast.info("استلمنا الصور", `${images.length} صورة، بنظبطهم دلوقتي واحدة واحدة...`);

    // Client-side WebAssembly background removal (ISNet). fp16 halves the first-run model download.
    type ImglyModule = typeof import("@imgly/background-removal");
    let imgly: ImglyModule | null = null;
    try {
      imgly = await import("@imgly/background-removal");
    } catch {
      // Fallback
    }
    const imglyConfig = { model: "isnet_fp16" as const, output: { format: "image/png" as const } };
    let started = 0;
    let ready = 0;
    let failed = 0;

    // Two photos at a time: most of the wait is the network (Gemini, remove.bg), not this computer
    const worker = async () => {
      while (queueRef.current.length > 0) {
        const file = queueRef.current.shift()!;
        const index = ++started;
        const pos = () => `(صورة ${index} من ${totalRef.current})`;
        try {
            setStatusMessage(`بنفتح الصورة ${pos()}...`);

            // 1. Find the head (and the photo's orientation) on a light preview of the full photo
            let fullCanvas = await loadImageToCanvas(file, 3000);
            const detectHead = async (canvas: HTMLCanvasElement) => {
              try {
                const res = await fetch("/api/enhance-portrait", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "detect_face", imageBase64: canvasToPreviewDataUrl(canvas, 1024) }),
                  // A busy model must not hold the photo for a minute: the in-browser detector takes over
                  signal: AbortSignal.timeout(20_000),
                });
                if (!res.ok) return null;
                const d = await res.json();
                return {
                  box: Array.isArray(d.box_2d) && d.box_2d.length === 4 ? (d.box_2d as HeadBox) : undefined,
                  rotation: typeof d.rotation === "number" ? d.rotation : 0,
                };
              } catch {
                return null;
              }
            };
            setStatusMessage(`بندوّر على الوش ونعدل اتجاه الصورة ${pos()}...`);
            let detection = await detectHead(fullCanvas);
            if (detection?.rotation) {
              // Sideways / upside-down phone shots are stood upright, then the head is located again
              fullCanvas = rotateCanvasClockwise(fullCanvas, detection.rotation);
              detection = await detectHead(fullCanvas);
            }
            if (!detection?.box) {
              // Fallback when every Gemini model failed: BlazeFace in the browser (also finds the orientation)
              setStatusMessage(`بندوّر على الوش من على الجهاز ${pos()}...`);
              const local = await detectHeadLocally(fullCanvas);
              if (local) {
                fullCanvas = rotateCanvasClockwise(fullCanvas, local.rotation);
                detection = { box: local.box, rotation: 0 };
              }
              // Otherwise the skin-tone heuristic in enhanceAndFramePassportPhoto is the last resort
            }

            // 2. Work on the head-and-shoulders region cut from the full-resolution photo
            let aiFaceBox: HeadBox | undefined = undefined;
            let workCanvas: HTMLCanvasElement;
            if (detection?.box) {
              const region = extractHeadRegion(fullCanvas, detection.box);
              workCanvas = region.canvas;
              aiFaceBox = region.box;
            } else {
              workCanvas = downscaleCanvas(fullCanvas, 1200);
            }

            // 3. Quality: AI restoration when a provider is available, then the local tone correction always
            let aiEnhanced = false;
            if (aiEnhance) {
              setStatusMessage(`بنحسّن جودة الصورة بالذكاء الاصطناعي، ممكن ياخد لحد دقيقتين ${pos()}...`);
              const restored = await aiRestorePhoto(workCanvas);
              if (restored) {
                workCanvas = restored;
                aiEnhanced = true;
              }
            }
            autoEnhanceCanvas(workCanvas, aiFaceBox);

            const preprocessedBlob = await canvasToBlob(workCanvas);
            // The cut-out only supplies a mask (applied to the full-size canvas), so the upload stays small
            // enough for the host's request-size limit
            const preprocessedDataUrl = canvasToPreviewDataUrl(workCanvas, 1600);
            let processedBlob: Blob = preprocessedBlob;
            let cutoutDataUrl: string | undefined = undefined;
            let maskCanvas: HTMLCanvasElement | null = null;

            // 1. Server cut-out (remove.bg / Photoroom when a key is configured): studio-grade hair edges
            setStatusMessage(`بنشيل الخلفية ${pos()}...`);
            try {
              const serverBgRes = await fetch("/api/admin/remove-bg", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageBase64: preprocessedDataUrl }),
                signal: AbortSignal.timeout(45_000),
              });
              if (serverBgRes.ok) {
                const serverBgData = await serverBgRes.json();
                if (typeof serverBgData.cutoutBase64 === "string" && serverBgData.cutoutBase64.length > 0) {
                  const fullResCutout = await applyCutoutMask(workCanvas, serverBgData.cutoutBase64 as string);
                  if (maskLooksValid(fullResCutout)) {
                    processedBlob = await canvasToBlob(fullResCutout, "image/png");
                    cutoutDataUrl = fullResCutout.toDataURL("image/png");
                    maskCanvas = fullResCutout;
                  } else {
                    console.warn(`remove.bg returned an unusable mask for ${file.name}`);
                  }
                } else if (Array.isArray(serverBgData.errors) && serverBgData.errors.length > 0) {
                  console.warn(`Server background removal failed for ${file.name}:`, serverBgData.errors);
                }
                if (
                  Array.isArray(serverBgData.quotaExhausted) &&
                  serverBgData.quotaExhausted.length > 0 &&
                  !quotaWarnedRef.current
                ) {
                  quotaWarnedRef.current = true;
                  toast.warning(
                    "رصيد remove.bg المجاني خلص الشهر ده",
                    "هنشيل الخلفية من على الجهاز. لو عايز جودة أعلى اشحن رصيد من remove.bg/dashboard."
                  );
                }
              }
            } catch {}

            // 2. In-browser model. The first run downloads the model (~40MB), so no short timeout here:
            // a timeout used to silently return the photo with its original background.
            if (!cutoutDataUrl && imgly) {
              try {
                setStatusMessage(`بنشيل الخلفية من على الجهاز (أول مرة بتاخد وقت) ${pos()}...`);
                const bgPromise = imgly.removeBackground(preprocessedBlob, imglyConfig);
                const timeoutPromise = new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error("Timeout")), 180000)
                );
                processedBlob = await Promise.race([bgPromise, timeoutPromise]);
                cutoutDataUrl = await readFileAsDataURL(new File([processedBlob], file.name));
                maskCanvas = await loadImageToCanvas(processedBlob, 1600);
              } catch (bgErr) {
                console.warn("Background removal failed:", bgErr);
                processedBlob = preprocessedBlob;
              }
            }

            if (!cutoutDataUrl) {
              toast.warning("الخلفية متشالتش", `${file.name} اتظبطت بخلفيتها الأصلية.`);
            }

            // No face detector answered: the cut-out's outline still shows where the head is, so a full-body
            // shot is cropped to head and shoulders instead of being framed whole
            if (!aiFaceBox && maskCanvas) {
              const maskBox = headBoxFromMask(maskCanvas);
              if (maskBox) {
                // Same head-and-shoulders area cut from the full-resolution photo and from the mask (both
                // share the photo's proportions), so a small far-away head is not upscaled from 1200px
                const region = extractHeadRegion(fullCanvas, maskBox);
                const maskRegion = extractHeadRegion(maskCanvas, maskBox);
                autoEnhanceCanvas(region.canvas, region.box);
                const masked = await applyCutoutMask(region.canvas, maskRegion.canvas.toDataURL("image/png"));
                processedBlob = await canvasToBlob(masked, "image/png");
                cutoutDataUrl = masked.toDataURL("image/png");
                aiFaceBox = region.box;
              }
            }

            const originalDataUrl = await readFileAsDataURL(file);

            // Frame to 40mm x 52mm studio standard with white background and pure client canvas
            const framedDataUrl = await enhanceAndFramePassportPhoto(processedBlob, {
              autoCompleteCropped: true,
              superResolution: true,
              preserveIdentity: true,
              aiBox: aiFaceBox,
              aiEnhanced,
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
          ready++;
        } catch (err) {
          console.error("Passport photos process error:", err);
          failed++;
        }
        doneRef.current++;
        setProgress({ total: totalRef.current, done: doneRef.current });
      }
    };

    try {
      await Promise.all([worker(), worker()]);

      if (ready > 0) toast.success("الصور جاهزة", `${ready} صورة اتظبطت بمقاس 4×6 (40×52 مم).`);
      if (failed > 0) toast.error("في صور ماتظبطتش", `${failed} صورة حصل فيها مشكلة. جرب ترفعها تاني.`);
    } finally {
      runningRef.current = false;
      doneRef.current = 0;
      totalRef.current = 0;
      setProgress(null);
      setIsProcessingBg(false);
      setStatusMessage("");
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

  /** Name strip switch / name text; the strip image is rebuilt by the effect below */
  const setPersonName = (id: string, updates: { includeName?: boolean; name?: string }) => {
    setPersons((curr) => curr.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  // Keeps every switched-on name strip in step with its photo and name (debounced while typing)
  useEffect(() => {
    const stale = persons.filter((p) => p.includeName && p.name.trim() && p.namedFor !== `${p.imageDataUrl.length}|${p.name}`);
    if (stale.length === 0) return;
    const timer = window.setTimeout(async () => {
      for (const p of stale) {
        const key = `${p.imageDataUrl.length}|${p.name}`;
        const named = await composeNameStrip(p.imageDataUrl, p.name.trim()).catch(() => undefined);
        if (named) setPersons((curr) => curr.map((x) => (x.id === p.id ? { ...x, namedDataUrl: named, namedFor: key } : x)));
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [persons]);

  const removePerson = (id: string) => {
    setPersons((prev) => prev.filter((p) => p.id !== id));
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
    toast.success("الصورة اتحفظت", "القص والألوان الجديدة اتحفظوا بمقاس 4×6.");
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
      img.src = printedImage(person);
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
      toast.warning("اسمح للموقع يفتح نوافذ جديدة (Pop-ups) عشان الطباعة تشتغل");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <title>طباعة الصور الشخصية (${paper}) - Copy-Cat</title>
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
      // The name is already printed inside the photo strip, so Word gets the final image and no extra line
      await generatePassportPhotosDocx(
        persons.map((p) => ({ ...p, imageDataUrl: printedImage(p), includeName: false })),
        layoutCount
      );
      toast.success(
        "ملف Word نزل",
        `${layoutCount} صور في الورقة، كل صورة 40×52 مم وحواليها مسافة للقص.`
      );
    } catch (err) {
      console.error("Docx generation error:", err);
      toast.error(
        "ملف Word منزلش",
        getFriendlyErrorMessage(err, "جرب تاني.")
      );
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-slate-800">الصور الشخصية (4×6)</span>
          {persons.length > 0 && (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
              {persons.length} صورة
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {persons.length > 0 && (
            <button
              onClick={() => setPersons([])}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
            >
              امسح الكل
            </button>
          )}

          <button
            onClick={() => handleExportDocx(4)}
            disabled={persons.length === 0 || isGeneratingDocx}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>نزّل Word (4 صور على A6)</span>
          </button>

          <button
            onClick={() => handleExportDocx(9)}
            disabled={persons.length === 0 || isGeneratingDocx}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>نزّل Word (9 صور على A5)</span>
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
            {isDragging ? "سيب الصور هنا" : "دوس هنا وارفع الصور الشخصية، أو اسحبها وسيبها هنا"}
          </h3>
          <p className="text-slate-500 text-xs">
            البرنامج بيحسّن الصورة ويشيل الخلفية ويخليها بيضا ويقصها مقاس 4×6 لوحده. تقدر ترفع صور زيادة وهو شغال.
          </p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={aiEnhance}
          onChange={(e) => setAiEnhance(e.target.checked)}
          className="w-4 h-4 accent-emerald-500 cursor-pointer"
        />
        <Wand2 className="w-4 h-4 text-emerald-500" />
        <span>
          حسّن الجودة بالذكاء الاصطناعي (أبطأ بكتير: ممكن دقيقة أو اتنين لكل صورة. لو مقفول بيظبط الإضاءة والألوان والحدة بس)
        </span>
      </label>

      {toolsState === "loading" && (
        <p className="text-xs text-slate-500">⏳ بننزّل أدوات الصور على الجهاز في الخلفية (مرة واحدة بس، وبعد كده بتشتغل على طول)...</p>
      )}
      {toolsState === "ready" && (
        <p className="text-xs text-emerald-700 font-bold">✓ أدوات الصور متنزلة على الجهاز: لو remove.bg مردش، الخلفية هتتشال من على الجهاز على طول.</p>
      )}

      {isProcessingBg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3" role="status" aria-live="polite">
          <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0" />
          <div className="flex-1 space-y-1.5">
            {progress && (
              <p className="text-sm font-bold text-emerald-900">
                استلمنا {progress.total} صورة، وبنظبطهم دلوقتي ({progress.done} من {progress.total} خلصوا)
              </p>
            )}
            <p className="text-xs font-bold text-emerald-700">{statusMessage}</p>
            <p className="text-xs text-emerald-700">لو عندك صور تانية ارفعها عادي، هتتضاف على الشغل ومش هتوقف اللي شغالين فيه.</p>
            {progress && (
              <div className="h-1.5 rounded-full bg-emerald-100 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-500"
                  style={{ width: `${Math.max(5, (progress.done / Math.max(1, progress.total)) * 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Persons Gallery */}
      {persons.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              جاهز <strong className="text-slate-900 font-bold">{persons.length} صورة</strong> مقاس 4×6 (40 × 52 مم)
            </span>
            <span className="text-emerald-400 font-bold">
              كل صورة ليها برواز أسود رفيع ومسافة للقص بالمقص
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
                      صورة {index + 1}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setPreviewModalUrl(printedImage(person))}
                        className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                        title="كبّر الصورة"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removePerson(person.id)}
                        className="p-1.5 text-rose-600 hover:text-rose-700 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                        title="امسح"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Photo Display (40mm x 52mm aspect ratio) */}
                  <div className="aspect-[40/52] max-w-[200px] mx-auto bg-white rounded-xl overflow-hidden mb-3 border-2 border-slate-950 flex items-center justify-center p-0.5 shadow-lg relative">
                    <NextImage
                      src={printedImage(person)}
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
                      <span className="w-14 text-slate-500 font-bold">الإضاءة:</span>
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
                      <span className="w-14 text-slate-500 font-bold">الألوان:</span>
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

                  {/* Name strip under the photo (8mm of the 52mm), per photo */}
                  <div className="mt-3 p-3 rounded-2xl border border-slate-200 bg-white space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!person.includeName}
                        onChange={(e) => setPersonName(person.id, { includeName: e.target.checked })}
                        className="w-4 h-4 accent-emerald-600 cursor-pointer"
                      />
                      <span>اكتب الاسم تحت الصورة</span>
                    </label>
                    {person.includeName && (
                      <input
                        type="text"
                        value={person.name}
                        onChange={(e) => setPersonName(person.id, { name: e.target.value })}
                        placeholder="اكتب الاسم هنا"
                        dir="rtl"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                      />
                    )}
                  </div>

                  {/* 4:6 Crop / Framing Tool Button */}
                  <button
                    type="button"
                    onClick={() => openFramingModal(person)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black transition cursor-pointer shadow-sm"
                    title="عدّل القص (الراس والكتاف)"
                  >
                    <Focus className="w-4 h-4" />
                    <span>عدّل القص</span>
                  </button>

                  {/* Grid Print Buttons */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => openGridSheetModal(person, 4)}
                      className="py-2 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1"
                      title="شوف واطبع 4 صور على ورقة A6"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>اطبع 4 صور (A6)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openGridSheetModal(person, 9)}
                      className="py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1"
                      title="شوف واطبع 9 صور على ورقة A5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>اطبع 9 صور (A5)</span>
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> مقاس 40 × 52 مم
                  </span>
                  <span>برواز رفيع ومسافة للقص</span>
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
                    عدّل قص الصورة الشخصية
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    اسحب الصورة بالماوس لحد ما الوش ييجي في النص، وظبط التكبير واللف والإضاءة
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
                  أعلى الراس
                </span>
                <span className="absolute top-[39%] right-2 text-[9px] font-bold text-amber-800 bg-amber-100/90 px-1 rounded pointer-events-none">
                  العينين
                </span>
                <span className="absolute top-[67%] right-2 text-[9px] font-bold text-amber-800 bg-amber-100/90 px-1 rounded pointer-events-none">
                  آخر الدقن
                </span>
                <span className="absolute top-[83%] right-2 text-[9px] font-bold text-blue-800 bg-blue-100/90 px-1 rounded pointer-events-none">
                  الكتاف
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 text-center">
                اسحب الصورة بالماوس عشان تحط الوش في النص. المقاس ثابت 4×6 (40 × 52 مم)
              </p>
            </div>

            {/* Adjustments: Zoom, Rotation, Brightness, Contrast, Saturation */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">القص والألوان:</span>
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
                  <span>رجّعها زي الأول</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Zoom */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span className="flex items-center gap-1">
                      <ZoomIn className="w-3 h-3" /> التكبير:
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
                      <RotateCw className="w-3 h-3" /> لف الصورة:
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
                    <span>الإضاءة:</span>
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
                    <span>التباين:</span>
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
                    <span>الألوان:</span>
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
                  <span className="text-xs font-bold text-slate-900">خلّي الخلفية بيضا</span>
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
                <span>احفظ</span>
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
                    الصورة بتتطبع 40 × 52 مم بالظبط، وحواليها برواز رفيع ومسافة للقص
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
                اقفل
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

            <h3 className="text-base font-extrabold text-slate-900">الصورة الشخصية (40 × 52 مم)</h3>

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
              خلفية بيضا وبرواز أسود رفيع، مقاس 4×6.
            </p>

            <button
              onClick={() => setPreviewModalUrl(null)}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs cursor-pointer transition"
            >
              اقفل
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
