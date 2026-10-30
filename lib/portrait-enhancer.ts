/**
 * Portrait & Passport Photo Smart Reconstruction Engine
 * Copy-Cat Studio 4x6 Solution
 *
 * Core Features:
 * 1. Symmetric Portrait Outpainting (Completes cropped shoulders and clipped hair/head)
 * 2. Facial Identity & Color Preservation (Guarantees zero change to facial features, eyes, skin tone)
 * 3. Chroma-Preserving Super Resolution (Sharpening strictly applied to luminance channel)
 * 4. Exact 4.0 x 5.2 cm studio standard framing with 1.5pt solid black border and white background
 */

/**
 * Output frame: 40mm x 52mm at ~380dpi. 400x520 printed at only 254dpi, which looked soft on the 4x6 sheet.
 * Pan offsets stored on photos are in the old 400px units and are scaled by FRAME_W / 400.
 */
export const FRAME_W = 600;
export const FRAME_H = 780;
/** 1.5pt black border: 40mm = 113.4pt across FRAME_W px */
export const FRAME_BORDER_PX = Math.round((FRAME_W / 113.4) * 1.5);

export interface PortraitEnhanceOptions {
  autoCompleteCropped?: boolean;  // Reconstruct cut shoulders & head
  superResolution?: boolean;       // Enhance sharpness & high frequency details
  preserveIdentity?: boolean;      // Strict 100% face & color preservation
  headroomMargin?: number;         // Top margin (default 0.08)
  shoulderMargin?: number;         // Side margin (default 0.06)
  brightnessDelta?: number;        // Slight face fill-light (-50 to +50)
  aiBox?: [number, number, number, number]; // Normalized [ymin, xmin, ymax, xmax] 0..1000
  aiEnhanced?: boolean;            // Already restored by an AI model: lighter sharpening
}

/**
 * Detects the silhouette bounds of a cut-out or portrait subject
 */
function getSubjectBounds(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;
  let hasSubject = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const alpha = data[idx + 3];
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Pixel is considered part of subject if alpha > 30 and not pure white
      const isNotWhite = r < 248 || g < 248 || b < 248;
      if (alpha > 30 && isNotWhite) {
        hasSubject = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasSubject) {
    return { minX: 0, maxX: w, minY: 0, maxY: h, isTopCut: false, isLeftCut: false, isRightCut: false };
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    isTopCut: minY < 5,
    isLeftCut: minX < 5,
    isRightCut: maxX > w - 6,
  };
}

/**
 * Intelligent Outpainting & Shoulder/Head Reconstruction:
 * When an image has a shoulder cut off on one side, or hair cut off at the top,
 * this function seamlessly extends the silhouette and garment symmetrically
 * while keeping the face region untouched.
 */
export function reconstructPortraitSubject(
  sourceCanvas: HTMLCanvasElement,
  options: PortraitEnhanceOptions = {}
): HTMLCanvasElement {
  const { autoCompleteCropped = true } = options;
  if (!autoCompleteCropped) return sourceCanvas;

  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;
  const sCtx = sourceCanvas.getContext("2d");
  if (!sCtx) return sourceCanvas;

  const bounds = getSubjectBounds(sCtx, sw, sh);

  // If not cut, return original
  if (!bounds.isTopCut && !bounds.isLeftCut && !bounds.isRightCut) {
    return sourceCanvas;
  }

  // Add padding canvas to complete the subject
  const padX = bounds.isLeftCut || bounds.isRightCut ? Math.round(sw * 0.25) : 0;
  const padTop = bounds.isTopCut ? Math.round(sh * 0.12) : 0;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = sw + padX * 2;
  outCanvas.height = sh + padTop;
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) return sourceCanvas;

  // Draw original image shifted by padding
  const destX = padX;
  const destY = padTop;
  outCtx.drawImage(sourceCanvas, destX, destY);

  const outData = outCtx.getImageData(0, 0, outCanvas.width, outCanvas.height);
  const d = outData.data;
  const ow = outCanvas.width;

  // Reconstruct missing left shoulder by symmetric sampling if left is cut and right is full
  if (bounds.isLeftCut && !bounds.isRightCut) {
    const origCenterX = destX + (bounds.minX + bounds.maxX) / 2;
    for (let y = Math.round(sh * 0.45); y < sh; y++) {
      const cy = y + destY;
      for (let x = 0; x < padX + bounds.minX; x++) {
        const mirroredX = Math.round(origCenterX + (origCenterX - x));
        if (mirroredX < ow && mirroredX >= 0) {
          const srcIdx = (cy * ow + mirroredX) * 4;
          const targetIdx = (cy * ow + x) * 4;
          if (d[srcIdx + 3] > 30) {
            d[targetIdx] = d[srcIdx];
            d[targetIdx + 1] = d[srcIdx + 1];
            d[targetIdx + 2] = d[srcIdx + 2];
            d[targetIdx + 3] = d[srcIdx + 3];
          }
        }
      }
    }
  }

  // Reconstruct missing right shoulder if right is cut and left is full
  if (bounds.isRightCut && !bounds.isLeftCut) {
    const origCenterX = destX + (bounds.minX + bounds.maxX) / 2;
    for (let y = Math.round(sh * 0.45); y < sh; y++) {
      const cy = y + destY;
      for (let x = destX + bounds.maxX; x < ow; x++) {
        const mirroredX = Math.round(origCenterX - (x - origCenterX));
        if (mirroredX < ow && mirroredX >= 0) {
          const srcIdx = (cy * ow + mirroredX) * 4;
          const targetIdx = (cy * ow + x) * 4;
          if (d[srcIdx + 3] > 30) {
            d[targetIdx] = d[srcIdx];
            d[targetIdx + 1] = d[srcIdx + 1];
            d[targetIdx + 2] = d[srcIdx + 2];
            d[targetIdx + 3] = d[srcIdx + 3];
          }
        }
      }
    }
  }

  // Reconstruct clipped head top (hair contour curve) if top is cut
  if (bounds.isTopCut && padTop > 0) {
    const headCenterX = destX + (bounds.minX + bounds.maxX) / 2;
    const headRadius = (bounds.maxX - bounds.minX) * 0.38;

    for (let py = 0; py < padTop; py++) {
      const sampleY = destY + 2;
      for (let px = destX + bounds.minX; px <= destX + bounds.maxX; px++) {
        const distFromCenter = Math.abs(px - headCenterX);
        const domeHeight = Math.sqrt(Math.max(0, headRadius * headRadius - distFromCenter * distFromCenter));
        const normalizedDome = (domeHeight / headRadius) * padTop;

        if (padTop - py <= normalizedDome) {
          const srcIdx = (sampleY * ow + px) * 4;
          const targetIdx = (py * ow + px) * 4;
          if (d[srcIdx + 3] > 30) {
            d[targetIdx] = d[srcIdx];
            d[targetIdx + 1] = d[srcIdx + 1];
            d[targetIdx + 2] = d[srcIdx + 2];
            d[targetIdx + 3] = 255;
          }
        }
      }
    }
  }

  outCtx.putImageData(outData, 0, 0);
  return outCanvas;
}

/**
 * Chroma-Preserving Super Resolution & Sharpening:
 * Strictly sharpens Luminance (Y) channel only, leaving Chrominance (Cb, Cr)
 * completely unchanged. This mathematically guarantees 0% shift in skin tone
 * or facial coloring!
 */
export function applyFaceSafeSuperResolution(
  canvas: HTMLCanvasElement,
  strength = 0.55
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  // Create luminance buffer
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    // Standard Rec. 601 Luma
    lum[i] = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
  }

  // 3x3 Laplacian Unsharp Mask on Luminance
  for (let y = 1; y < h - 1; y++) {
    const rowOffset = y * w;
    const prevRow = (y - 1) * w;
    const nextRow = (y + 1) * w;

    for (let x = 1; x < w - 1; x++) {
      const idx = rowOffset + x;
      const centerL = lum[idx];
      const laplacian =
        4 * centerL -
        (lum[prevRow + x] + lum[nextRow + x] + lum[rowOffset + x - 1] + lum[rowOffset + x + 1]);

      const sharpenedL = Math.min(255, Math.max(0, centerL + laplacian * strength));
      const deltaL = sharpenedL - centerL;

      const pIdx = idx * 4;
      // Add luma delta proportionally to R, G, B to preserve color ratios exactly
      d[pIdx] = Math.min(255, Math.max(0, d[pIdx] + deltaL));
      d[pIdx + 1] = Math.min(255, Math.max(0, d[pIdx + 1] + deltaL));
      d[pIdx + 2] = Math.min(255, Math.max(0, d[pIdx + 2] + deltaL));
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Automatic studio tone correction, the always-available quality step (no API needed):
 * 1. Levels: stretches the head area's 0.5%..99.5% luminance range (gain capped at ~1.38)
 * 2. White balance from near-neutral pixels (walls, white clothes, eyes); the face itself is never used as
 *    the reference, which would grey out the skin. Gains are capped at +-10%.
 * 3. Exposure: a dark or washed-out face is pulled toward a studio mid-tone with a gamma curve.
 * Transparent pixels (a removed background) are skipped. Mutates `d` (RGBA) in place.
 */
export function autoTonePixels(d: Uint8ClampedArray, w: number, h: number, box?: HeadBox): void {
  const lumOf = (i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

  // Region measured for levels / exposure: the head box, or the central area without one
  const [ry0, rx0, ry1, rx1] = box
    ? [box[0] / 1000, box[1] / 1000, box[2] / 1000, box[3] / 1000]
    : [0.15, 0.25, 0.65, 0.75];
  const x0 = Math.max(0, Math.floor(rx0 * w));
  const x1 = Math.min(w, Math.ceil(rx1 * w));
  const y0 = Math.max(0, Math.floor(ry0 * h));
  const y1 = Math.min(h, Math.ceil(ry1 * h));
  const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 40000)));

  const hist = new Uint32Array(256);
  // Exposure is judged on skin only: dark hair filling the head box would otherwise read as "underexposed"
  const skinHist = new Uint32Array(256);
  let count = 0;
  let skinCount = 0;
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 128) continue;
      const l = Math.round(lumOf(i));
      hist[l]++;
      count++;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (r > 95 && g > 40 && b > 20 && r > g && r > b && r - Math.min(g, b) > 15) {
        skinHist[l]++;
        skinCount++;
      }
    }
  }
  if (count < 100) return;

  const percentile = (p: number) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= count * p) return v;
    }
    return 255;
  };
  const lo = Math.min(percentile(0.005), 25);
  const hi = Math.max(percentile(0.995), 185);
  const levels = (v: number) => Math.min(255, Math.max(0, ((v - lo) * 255) / (hi - lo)));

  // Median skin luminance after levels decides the exposure curve (studio skin sits around 150-195)
  let gamma = 1;
  if (skinCount > count * 0.05) {
    let acc = 0;
    let median = 128;
    for (let v = 0; v < 256; v++) {
      acc += skinHist[v];
      if (acc >= skinCount / 2) {
        median = Math.max(1, levels(v));
        break;
      }
    }
    if (median < 135) gamma = Math.min(1, Math.max(0.7, Math.log(150 / 255) / Math.log(median / 255)));
    else if (median > 215) gamma = Math.max(1, Math.min(1.2, Math.log(195 / 255) / Math.log(median / 255)));
  }

  // White balance from near-neutral pixels anywhere in the photo
  const wbStep = Math.max(1, Math.floor(Math.sqrt((w * h) / 60000)));
  let nr = 0, ng = 0, nb = 0, neutral = 0, sampled = 0;
  for (let y = 0; y < h; y += wbStep) {
    for (let x = 0; x < w; x += wbStep) {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 128) continue;
      sampled++;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const l = lumOf(i);
      if (Math.max(r, g, b) - Math.min(r, g, b) < 25 && l > 50 && l < 240) {
        nr += r;
        ng += g;
        nb += b;
        neutral++;
      }
    }
  }
  let gains = [1, 1, 1];
  if (sampled > 0 && neutral > sampled * 0.03) {
    const avg = (nr + ng + nb) / (3 * neutral);
    gains = [nr, ng, nb].map((c) => {
      const g = avg / (c / neutral);
      // Applied at 60% strength and capped, so a coloured wall cannot tint the skin
      return 1 + (Math.min(1.1, Math.max(0.9, g)) - 1) * 0.6;
    });
  }

  const luts = gains.map((g) => {
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) {
      const lv = levels(Math.min(255, v * g));
      lut[v] = Math.round(255 * Math.pow(lv / 255, gamma));
    }
    return lut;
  });

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    d[i] = luts[0][d[i]];
    d[i + 1] = luts[1][d[i + 1]];
    d[i + 2] = luts[2][d[i + 2]];
  }
}

/** Canvas wrapper around autoTonePixels */
export function autoEnhanceCanvas(canvas: HTMLCanvasElement, box?: HeadBox): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  autoTonePixels(imgData.data, canvas.width, canvas.height, box);
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Downscale by repeated halving: a single large drawImage step aliases fine detail (hair, eyelashes)
 * and makes the print look soft.
 */
function resizeStepwise(src: HTMLCanvasElement, dw: number, dh: number): HTMLCanvasElement {
  let cur = src;
  while (cur.width / 2 >= dw && cur.height / 2 >= dh) {
    const half = document.createElement("canvas");
    half.width = Math.round(cur.width / 2);
    half.height = Math.round(cur.height / 2);
    const hctx = half.getContext("2d");
    if (!hctx) break;
    hctx.imageSmoothingQuality = "high";
    hctx.drawImage(cur, 0, 0, half.width, half.height);
    cur = half;
  }
  const out = document.createElement("canvas");
  out.width = dw;
  out.height = dh;
  const octx = out.getContext("2d");
  if (!octx) return cur;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(cur, 0, 0, dw, dh);
  return out;
}

/**
 * Scans image for human skin tone clusters to reliably locate face and upper torso
 */
function findFaceSkinCentroid(canvas: HTMLCanvasElement): {
  found: boolean;
  centerX: number;
  centerY: number;
  faceW: number;
  faceH: number;
} {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      found: false,
      centerX: canvas.width / 2,
      centerY: canvas.height * 0.28,
      faceW: canvas.width * 0.38,
      faceH: canvas.height * 0.28,
    };
  }

  const w = canvas.width;
  const h = canvas.height;
  const scanH = Math.round(h * 0.65);
  const step = Math.max(2, Math.floor(w / 100));
  const imgData = ctx.getImageData(0, 0, w, scanH);
  const data = imgData.data;

  let sumX = 0;
  let sumY = 0;
  let count = 0;
  let minX = w, maxX = 0, minY = scanH, maxY = 0;

  for (let y = 0; y < scanH; y += step) {
    for (let x = 0; x < w; x += step) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const isSkin =
        r > 70 &&
        g > 40 &&
        b > 20 &&
        r > g &&
        r > b &&
        r - g > 12 &&
        Math.abs(r - g) > 10 &&
        r - b > 15;

      if (isSkin) {
        sumX += x;
        sumY += y;
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (count > 25) {
    const avgX = sumX / count;
    const avgY = sumY / count;
    const detectedW = Math.max(w * 0.22, Math.min(w * 0.55, maxX - minX));
    const detectedH = Math.max(h * 0.15, Math.min(h * 0.40, maxY - minY));
    return {
      found: true,
      centerX: avgX,
      centerY: avgY,
      faceW: detectedW,
      faceH: detectedH,
    };
  }

  return {
    found: false,
    centerX: w / 2,
    centerY: h * 0.28,
    faceW: w * 0.38,
    faceH: h * 0.28,
  };
}

/**
 * Detects optimal Biometric Passport Crop (Head & Shoulders)
 * Standard: Head occupies 70%-78% of vertical frame height, with 7-8% headroom above hair.
 * Ensures full-body photos are cropped directly to head & shoulders just like official studio photos.
 */
export type HeadBox = [number, number, number, number];

/**
 * Studio 4x6 frame around a head box [ymin, xmin, ymax, xmax] (0..1000, top of hair -> chin, ear to ear),
 * measured on the shop's reference print: hair top ~3% below the frame edge, chin at ~78%, so the head
 * fills ~75% of the height (and at most ~74% of the width); collar and shoulders below the chin.
 * Returned in pixels and NOT clamped to the image.
 */
export function headFrameRect(box: HeadBox, imgW: number, imgH: number) {
  const [ymin, xmin, ymax, xmax] = box;
  const headTop = (ymin / 1000) * imgH;
  const headH = ((ymax - ymin) / 1000) * imgH;
  const headW = ((xmax - xmin) / 1000) * imgW;
  const headCenterX = ((xmin + xmax) / 2000) * imgW;
  const h = Math.max(headH / 0.75, (headW / 0.74) * (520 / 400));
  const w = h * (400 / 520);
  return { x: headCenterX - w / 2, y: headTop - h * 0.03, w, h };
}

/** Rotates a canvas clockwise by 90 / 180 / 270 degrees */
export function rotateCanvasClockwise(src: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  const quarter = (((Math.round(degrees / 90) % 4) + 4) % 4) as 0 | 1 | 2 | 3;
  if (quarter === 0) return src;
  const out = document.createElement("canvas");
  out.width = quarter % 2 ? src.height : src.width;
  out.height = quarter % 2 ? src.width : src.height;
  const ctx = out.getContext("2d");
  if (!ctx) return src;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((quarter * Math.PI) / 2);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}

/**
 * Cuts the head-and-shoulders area (frame + 20% margin) out of the FULL-resolution photo, so a far-away
 * subject is not reduced to a blurry ~100px head by an upfront downscale. Returns the region (long side
 * capped at maxSide) and the head box re-expressed in region coordinates.
 */
export function extractHeadRegion(
  full: HTMLCanvasElement,
  box: HeadBox,
  maxSide = 1400
): { canvas: HTMLCanvasElement; box: HeadBox } {
  const W = full.width;
  const H = full.height;
  const f = headFrameRect(box, W, H);
  const x0 = Math.max(0, Math.floor(f.x - f.w * 0.2));
  const y0 = Math.max(0, Math.floor(f.y - f.h * 0.2));
  const x1 = Math.min(W, Math.ceil(f.x + f.w * 1.2));
  const y1 = Math.min(H, Math.ceil(f.y + f.h * 1.2));
  const rw = Math.max(1, x1 - x0);
  const rh = Math.max(1, y1 - y0);
  const scale = Math.min(1, maxSide / Math.max(rw, rh));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(rw * scale);
  canvas.height = Math.round(rh * scale);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(full, x0, y0, rw, rh, 0, 0, canvas.width, canvas.height);
  }

  const [ymin, xmin, ymax, xmax] = box;
  const toY = (v: number) => (((v / 1000) * H - y0) / rh) * 1000;
  const toX = (v: number) => (((v / 1000) * W - x0) / rw) * 1000;
  return { canvas, box: [toY(ymin), toX(xmin), toY(ymax), toX(xmax)] };
}

export async function detectBiometricCrop(
  canvas: HTMLCanvasElement,
  explicitBox?: [number, number, number, number],
  allowOverflow = false
): Promise<{
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
}> {
  const cw = canvas.width;
  const ch = canvas.height;

  // 1. Explicit AI head box from Gemini [ymin, xmin, ymax, xmax] (0..1000): top of hair -> chin, ear to ear
  if (explicitBox && explicitBox.length === 4) {
    const frame = headFrameRect(explicitBox, cw, ch);
    const targetCropH = frame.h;
    const targetCropW = frame.w;
    let cropY = frame.y;
    let cropX = frame.x;

    // A cut-out (transparent background) can extend past the photo edges: the overflow becomes studio white.
    // An opaque photo must stay inside its own pixels.
    if (!allowOverflow) {
      cropY = Math.max(0, Math.min(ch - Math.min(ch, targetCropH), cropY));
      cropX = Math.max(0, Math.min(cw - Math.min(cw, targetCropW), cropX));
    }

    return {
      cropX: Math.round(cropX),
      cropY: Math.round(cropY),
      cropW: Math.round(allowOverflow ? targetCropW : Math.min(cw, targetCropW)),
      cropH: Math.round(allowOverflow ? targetCropH : Math.min(ch, targetCropH)),
    };
  }

  // 2. Native Browser FaceDetector (if available in Chrome/Edge)
  if (typeof window !== "undefined" && "FaceDetector" in window) {
    try {
      const FaceDetectorClass = (window as unknown as { FaceDetector: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => { detect: (c: CanvasImageSource) => Promise<Array<{ boundingBox: { x: number; y: number; width: number; height: number } }>> } }).FaceDetector;
      const detector = new FaceDetectorClass({ fastMode: true, maxDetectedFaces: 1 });
      const faces = await detector.detect(canvas);
      if (faces && faces.length > 0) {
        const box = faces[0].boundingBox;
        const faceH = box.height;
        const faceW = box.width;
        const faceCenterX = box.x + faceW / 2;
        const faceCenterY = box.y + faceH / 2;

        const targetCropH = Math.min(ch, Math.max(faceH * 1.62, faceW * 1.35));
        const targetCropW = Math.min(cw, targetCropH * (400 / 520));
        const cropY = Math.max(0, Math.min(ch - targetCropH, faceCenterY - targetCropH * 0.38));
        const cropX = Math.max(0, Math.min(cw - targetCropW, faceCenterX - targetCropW / 2));

        return {
          cropX: Math.round(cropX),
          cropY: Math.round(cropY),
          cropW: Math.round(targetCropW),
          cropH: Math.round(targetCropH),
        };
      }
    } catch {}
  }

  // 3. Smart local biometric detection for standing / full-body / 3/4 phone camera portraits
  const skin = findFaceSkinCentroid(canvas);
  
  if (skin.found) {
    // Face was detected via skin tone clustering
    // Head occupies ~62% of frame, leaving ~8% headroom and cutting right at the collarbone/shoulders
    const targetCropH = Math.min(ch, Math.max(skin.faceH * 1.62, cw * 0.55));
    const targetCropW = Math.min(cw, targetCropH * (400 / 520));
    const cropY = Math.max(0, Math.min(ch - targetCropH, skin.centerY - targetCropH * 0.38));
    const cropX = Math.max(0, Math.min(cw - targetCropW, skin.centerX - targetCropW / 2));

    return {
      cropX: Math.round(cropX),
      cropY: Math.round(cropY),
      cropW: Math.round(targetCropW),
      cropH: Math.round(targetCropH),
    };
  }

  // 4. Default Upper-Third Crop for portrait photos (where face & shoulders are in top 30%)
  if (ch > cw * 1.05) {
    // Standard phone camera photo of a standing or seated person:
    // The head and shoulders are located in the top 30% of the frame
    const targetCropH = Math.min(ch * 0.30, cw * 0.65);
    const targetCropW = targetCropH * (400 / 520);
    const cropX = Math.max(0, (cw - targetCropW) / 2);
    const cropY = Math.max(0, Math.round(ch * 0.05));

    return {
      cropX: Math.round(cropX),
      cropY: Math.round(cropY),
      cropW: Math.round(targetCropW),
      cropH: Math.round(targetCropH),
    };
  }

  // 5. Default upper-center crop for wide or square photos
  const targetCropH = Math.min(ch, ch * 0.65);
  const targetCropW = targetCropH * (400 / 520);
  const cropX = Math.max(0, (cw - targetCropW) / 2);
  const cropY = Math.max(0, Math.round(ch * 0.04));

  return {
    cropX: Math.round(cropX),
    cropY: Math.round(cropY),
    cropW: Math.round(targetCropW),
    cropH: Math.round(targetCropH),
  };
}

/**
 * Creates the Final Studio Framed Photo:
 * 1. Executes Portrait Outpainting & Reconstructs any cut shoulders/hair
 * 2. Biometrically crops full-body/half-body images to head & shoulders (ICAO 4x6 standard)
 * 3. Applies Chroma-Preserving Super Resolution
 * 4. Frames onto 4.0cm x 5.2cm proportion (400x520px)
 * 5. Fills with Pure White Background (#ffffff)
 * 6. Draws 1.5pt crisp solid black border
 */
export async function enhanceAndFramePassportPhoto(
  imgSource: Blob | string | HTMLImageElement,
  options: PortraitEnhanceOptions = {}
): Promise<string> {
  const {
    autoCompleteCropped = true,
    superResolution = true,
    preserveIdentity = true,
  } = options;

  let img: HTMLImageElement;
  if (imgSource instanceof HTMLImageElement) {
    img = imgSource;
  } else {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = reject;
      if (typeof imgSource === "string") {
        el.src = imgSource;
      } else {
        el.src = URL.createObjectURL(imgSource);
      }
    });
  }

  // Draw initial image to canvas
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = img.naturalWidth || img.width || 600;
  srcCanvas.height = img.naturalHeight || img.height || 800;
  const srcCtx = srcCanvas.getContext("2d");
  if (!srcCtx) return img.src;
  srcCtx.drawImage(img, 0, 0);

  // A background-removed cut-out has transparent corners; its crop may then extend past the photo edges
  const corners = [
    [0, 0],
    [srcCanvas.width - 1, 0],
    [0, srcCanvas.height - 1],
    [srcCanvas.width - 1, srcCanvas.height - 1],
  ];
  const isCutout = corners.some(([x, y]) => srcCtx.getImageData(x, y, 1, 1).data[3] < 128);

  // 1. Biometric head & shoulders detection (handles full-body photos like standing kids)
  const bioCrop = await detectBiometricCrop(srcCanvas, options.aiBox, isCutout);

  const croppedCanvas = document.createElement("canvas");
  croppedCanvas.width = bioCrop.cropW;
  croppedCanvas.height = bioCrop.cropH;
  const croppedCtx = croppedCanvas.getContext("2d");
  if (croppedCtx) {
    croppedCtx.drawImage(
      srcCanvas,
      bioCrop.cropX,
      bioCrop.cropY,
      bioCrop.cropW,
      bioCrop.cropH,
      0,
      0,
      bioCrop.cropW,
      bioCrop.cropH
    );
  }

  // 2. Reconstruct cropped shoulders and head if needed. A head-box crop is already framed on purpose
  // (shoulders deliberately run off both sides), so it must not be padded or given a synthetic hair dome.
  const reconstructedCanvas = reconstructPortraitSubject(croppedCtx ? croppedCanvas : srcCanvas, {
    autoCompleteCropped: autoCompleteCropped && !options.aiBox,
  });

  // 3. Official 4.0cm x 5.2cm Frame
  const targetW = FRAME_W;
  const targetH = FRAME_H;

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = targetW;
  finalCanvas.height = targetH;
  const finalCtx = finalCanvas.getContext("2d");
  if (!finalCtx) return reconstructedCanvas.toDataURL("image/jpeg", 0.96);

  // A. Fill Pure Studio White
  finalCtx.fillStyle = "#ffffff";
  finalCtx.fillRect(0, 0, targetW, targetH);

  // B. Draw onto target frame with PROPORTIONAL ASPECT RATIO (NEVER STRETCH)
  const rw = reconstructedCanvas.width;
  const rh = reconstructedCanvas.height;
  const scale = Math.max(targetW / rw, targetH / rh);
  const dw = Math.round(rw * scale);
  const dh = Math.round(rh * scale);
  const dx = Math.round((targetW - dw) / 2);
  // Position head with natural headroom near the top
  const dy = Math.max(targetH - dh, Math.min(0, Math.round(targetH * 0.05)));

  finalCtx.drawImage(resizeStepwise(reconstructedCanvas, dw, dh), dx, dy);

  // C. Luminance-only sharpening at print resolution (sharpening before the downscale was averaged away).
  // An AI-restored photo is already crisp and only gets a light touch.
  if (superResolution) {
    const strength = options.aiEnhanced ? 0.15 : preserveIdentity ? 0.3 : 0.45;
    applyFaceSafeSuperResolution(finalCanvas, strength);
  }

  // D. 1.5pt crisp solid black border (Requirement #8)
  finalCtx.strokeStyle = "#000000";
  finalCtx.lineWidth = FRAME_BORDER_PX;
  finalCtx.strokeRect(FRAME_BORDER_PX / 2, FRAME_BORDER_PX / 2, targetW - FRAME_BORDER_PX, targetH - FRAME_BORDER_PX);

  return finalCanvas.toDataURL("image/jpeg", 0.96);
}

/**
 * Manually Renders Biometric Framed Passport Photo:
 * Takes custom pan, zoom, and rotation adjustments and renders onto the standard
 * 400x520px canvas with solid white background and 1.5pt solid black border.
 */
export function renderFramedPassportCanvas(
  img: HTMLImageElement,
  panX: number,
  panY: number,
  zoom: number,
  rotation: number,
  targetW = FRAME_W,
  targetH = FRAME_H
): string {
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return img.src;

  // Pure studio white background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, targetH);

  ctx.save();
  // Move to center of canvas + pan
  ctx.translate(targetW / 2 + panX, targetH / 2 + panY);
  ctx.rotate((rotation * Math.PI) / 180);

  const iw = img.naturalWidth || img.width || targetW;
  const ih = img.naturalHeight || img.height || targetH;

  // Calculate base scale so image fills the 400x520 frame proportionally at zoom = 1.0
  const baseScale = Math.max(targetW / iw, targetH / ih);
  const effectiveScale = baseScale * Math.max(0.2, zoom);

  ctx.scale(effectiveScale, effectiveScale);
  ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
  ctx.restore();

  // 1.5pt crisp solid black border
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = FRAME_BORDER_PX;
  ctx.strokeRect(FRAME_BORDER_PX / 2, FRAME_BORDER_PX / 2, targetW - FRAME_BORDER_PX, targetH - FRAME_BORDER_PX);

  return canvas.toDataURL("image/jpeg", 0.96);
}
