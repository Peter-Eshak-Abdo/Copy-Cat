"use client";

import type { OcrFigure } from "@/lib/docx/ocr-docx";
import { findColumnSplit } from "@/lib/column-split";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Page image sent to the OCR models: long side capped at 2400px (enough for small exam digits and
 * superscripts) as JPEG, so a phone photo stays under the hosting request limit (~4.5MB).
 */
export async function prepareOcrImage(dataUrl: string, maxSide = 2200): Promise<string> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  // 0.85 keeps print sharp for the models and roughly halves the upload on a slow line
  return canvas.toDataURL("image/jpeg", 0.85);
}

/** Turns an image clockwise by 90 / 180 / 270 degrees (JPEG) */
export async function rotateImage(dataUrl: string, degrees: number): Promise<string> {
  const deg = ((degrees % 360) + 360) % 360;
  if (!deg) return dataUrl;
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = deg === 180 ? w : h;
  canvas.height = deg === 180 ? h : w;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2);
  return canvas.toDataURL("image/jpeg", 0.92);
}

/**
 * A page printed in two side-by-side columns, cut into its columns in reading order (right column first
 * for Arabic). Null when no clear divider or gutter is found. See lib/column-split.ts.
 */
export async function splitColumns(dataUrl: string, rtl: boolean): Promise<[string, string] | null> {
  const img = await loadImage(dataUrl);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  // Measured on a small copy (fast), cut on the full one
  const sw = Math.min(900, W);
  const sh = Math.max(1, Math.round((H * sw) / W));
  const small = document.createElement("canvas");
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext("2d", { willReadFrequently: true });
  if (!sctx) return null;
  sctx.fillStyle = "#ffffff";
  sctx.fillRect(0, 0, sw, sh);
  sctx.drawImage(img, 0, 0, sw, sh);
  const rgba = sctx.getImageData(0, 0, sw, sh).data;
  const gray = new Uint8Array(sw * sh);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = (rgba[i * 4] * 299 + rgba[i * 4 + 1] * 587 + rgba[i * 4 + 2] * 114) / 1000;
  }
  const cut = findColumnSplit(gray, sw, sh);
  if (cut === null) return null;

  const x = Math.round(W * cut);
  const part = (sx: number, width: number) => {
    const c = document.createElement("canvas");
    c.width = Math.max(1, width);
    c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, H);
    ctx.drawImage(img, sx, 0, width, H, 0, 0, width, H);
    return c.toDataURL("image/jpeg", 0.88);
  };
  const left = part(0, x);
  const right = part(x, W - x);
  return rtl ? [right, left] : [left, right];
}

/** Width / height of an image */
export async function imageAspect(dataUrl: string): Promise<number> {
  const img = await loadImage(dataUrl);
  return img.naturalWidth / Math.max(1, img.naturalHeight);
}

/**
 * Asks the server which way the page is turned and returns it upright. Without an AI answer the page is
 * read by Tesseract at each quarter turn and the turn with the most confident text wins.
 */
export async function uprightPage(dataUrl: string): Promise<{ dataUrl: string; rotation: number }> {
  const small = await prepareOcrImage(dataUrl, 1000);
  let rotation: number | null = null;
  try {
    const res = await fetch("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "orient", imageBase64: small }),
    });
    const data = await res.json();
    if (res.ok && data.success) rotation = Number(data.rotation) || 0;
  } catch {}
  if (rotation === null) rotation = await tesseractOrientation(small).catch(() => 0);
  return { dataUrl: rotation ? await rotateImage(dataUrl, rotation) : dataUrl, rotation };
}

async function tesseractOrientation(small: string): Promise<number> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["ara", "eng"], 1);
  try {
    let best = { rotation: 0, confidence: -1 };
    for (const rotation of [0, 90, 270, 180]) {
      const { data } = await worker.recognize(await rotateImage(small, rotation));
      if (data.confidence > best.confidence) best = { rotation, confidence: data.confidence };
      // An upright page usually reads well above this; no need to try the other turns
      if (rotation === 0 && data.confidence > 70) break;
    }
    return best.rotation;
  } finally {
    await worker.terminate();
  }
}

/**
 * Crops every "[FIGURE: ymin, xmin, ymax, xmax]" box (0..1000) out of the page image and replaces the line
 * with a numbered placeholder ("[شكل 3]" / "[Figure 3]") that the preview and the Word export resolve.
 */
export async function cropFigures(
  pageDataUrl: string,
  text: string,
  firstNumber: number,
  arabic: boolean
): Promise<{ text: string; figures: Record<number, OcrFigure> }> {
  const boxRe = /\[FIGURE:\s*([\d.\s]+),\s*([\d.\s]+),\s*([\d.\s]+),\s*([\d.\s]+)\]/gi;
  if (!boxRe.test(text)) return { text, figures: {} };
  boxRe.lastIndex = 0;

  const img = await loadImage(pageDataUrl);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const figures: Record<number, OcrFigure> = {};
  let n = firstNumber;

  const out = text.replace(boxRe, (whole, a, b, c, d) => {
    const [ymin, xmin, ymax, xmax] = [a, b, c, d].map((v: string) => Math.min(1000, Math.max(0, parseFloat(v))));
    if (!(ymax > ymin && xmax > xmin)) return "";
    // A little margin: model boxes tend to clip the labels on a figure's edge
    const pad = 12;
    const x0 = Math.floor((Math.max(0, xmin - pad) / 1000) * W);
    const y0 = Math.floor((Math.max(0, ymin - pad) / 1000) * H);
    const x1 = Math.ceil((Math.min(1000, xmax + pad) / 1000) * W);
    const y1 = Math.ceil((Math.min(1000, ymax + pad) / 1000) * H);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, x1 - x0);
    canvas.height = Math.max(1, y1 - y0);
    const ctx = canvas.getContext("2d");
    if (!ctx) return whole;
    ctx.drawImage(img, x0, y0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    figures[n] = {
      dataUrl: canvas.toDataURL("image/png"),
      widthPx: canvas.width,
      heightPx: canvas.height,
      widthFrac: canvas.width / W,
    };
    return arabic ? `[شكل ${n++}]` : `[Figure ${n++}]`;
  });
  return { text: out, figures };
}

/**
 * Every page of a PDF as a JPEG data URL (long side about `maxSide` px), so a PDF goes through exactly the
 * same reading as photographed pages ("PDF لـ Word" uses the OCR page).
 */
export async function pdfToImages(
  file: File,
  maxSide = 2200,
  onPage?: (done: number, total: number) => void
): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.js`;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const out: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(4, maxSide / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    out.push(canvas.toDataURL("image/jpeg", 0.9));
    page.cleanup();
    onPage?.(i, pdf.numPages);
  }
  await pdf.destroy();
  return out;
}

/**
 * Last-resort OCR in the browser (Tesseract, Arabic + English) when every server model is unavailable.
 * Plain text only: no maths, tables or figures, and noticeably less accurate on Arabic.
 */
export async function tesseractOcr(dataUrl: string, onProgress?: (pct: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["ara", "eng"], 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(Math.round(m.progress * 100));
    },
  });
  try {
    const { data } = await worker.recognize(dataUrl);
    // Tesseract scatters invisible direction marks (LRM / RLM) through Arabic lines
    return data.text.replace(/[‎‏]/g, "").replace(/\n{3,}/g, "\n\n").trim();
  } finally {
    await worker.terminate();
  }
}
