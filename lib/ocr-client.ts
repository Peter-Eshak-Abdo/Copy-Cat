"use client";

import type { OcrFigure } from "@/lib/docx/ocr-docx";

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
export async function prepareOcrImage(dataUrl: string, maxSide = 2400): Promise<string> {
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
  return canvas.toDataURL("image/jpeg", 0.92);
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
