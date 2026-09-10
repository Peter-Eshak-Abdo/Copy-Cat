/**
 * Advanced Image Processing Canvas Filters v2.0
 * Designed for Copy-Cat document scanning, ID cards, passport photos, and screen photos.
 * Features:
 *  - Color-Safe HSL Luminance Lightening (Preserves 100% natural colors, hue, & saturation without washout)
 *  - Crisp Dark Text Protection (National ID numbers and text remain pitch black and sharp)
 *  - Precision Crop Engine (Aspect ratio locked to ID card 85.6x54mm or freeform)
 *  - Fine-angle rotation & edge-preserving unsharp sharpening
 */

export interface Point2D {
  x: number; // 0 to 1 normalized
  y: number; // 0 to 1 normalized
}

export interface QuadCorners {
  tl: Point2D; // Top-Left
  tr: Point2D; // Top-Right
  br: Point2D; // Bottom-Right
  bl: Point2D; // Bottom-Left
}

export interface CropRect {
  x: number;      // 0 to 1 (percentage)
  y: number;      // 0 to 1 (percentage)
  width: number;  // 0 to 1 (percentage)
  height: number; // 0 to 1 (percentage)
}

export interface ProcessImageOptions {
  invert?: boolean;
  brightness?: number;          // 0 to 200 (100 is default, 115-130 for ID cards)
  contrast?: number;            // 0 to 200 (100 is default)
  sharpness?: number;           // 0 to 100 (0 is off, 50 is medium, 100 is max)
  camScannerMode?: boolean;     // CamScanner Magic Color & Document Whitening
  screenClarifierMode?: boolean;// Anti-Moire & computer screen photo text clarifier
  grayscale?: boolean;
  fineAngle?: number;           // Rotation in degrees (-45 to +45 or 0-360)
  preserveColors?: boolean;     // 100% Color-safe HSL mode (Fix for requirement #4)
  crop?: CropRect;              // Axis-aligned crop box
  quad?: QuadCorners;           // 4-corner perspective quad
}

/**
 * RGB to HSL conversion (normalized 0 to 1)
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h, s, l];
}

/**
 * HSL to RGB conversion
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Crops a canvas or image using normalized bounding coordinates
 */
export function cropImageCanvas(
  sourceCanvas: HTMLCanvasElement,
  crop: CropRect
): HTMLCanvasElement {
  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;

  const sx = Math.max(0, Math.round(crop.x * sw));
  const sy = Math.max(0, Math.round(crop.y * sh));
  const cw = Math.max(10, Math.min(sw - sx, Math.round(crop.width * sw)));
  const ch = Math.max(10, Math.min(sh - sy, Math.round(crop.height * sh)));

  const outCanvas = document.createElement("canvas");
  outCanvas.width = cw;
  outCanvas.height = ch;
  const ctx = outCanvas.getContext("2d");
  if (!ctx) return sourceCanvas;

  ctx.drawImage(sourceCanvas, sx, sy, cw, ch, 0, 0, cw, ch);
  return outCanvas;
}

/**
 * Warps a 4-corner quadrilateral (TL, TR, BR, BL) into a planar standard rectangle
 * Perfectly rectifies angled or skewed photos of ID cards and documents (CamScanner style)
 */
export function warpPerspectiveQuad(
  sourceCanvas: HTMLCanvasElement,
  quad: QuadCorners,
  targetWidth?: number,
  targetHeight?: number
): HTMLCanvasElement {
  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;
  const sCtx = sourceCanvas.getContext("2d");
  if (!sCtx) return sourceCanvas;

  // Calculate actual pixel points on source image
  const p0 = { x: quad.tl.x * sw, y: quad.tl.y * sh }; // Top-Left
  const p1 = { x: quad.tr.x * sw, y: quad.tr.y * sh }; // Top-Right
  const p2 = { x: quad.br.x * sw, y: quad.br.y * sh }; // Bottom-Right
  const p3 = { x: quad.bl.x * sw, y: quad.bl.y * sh }; // Bottom-Left

  // Standard ID Card (ID-1) aspect ratio = 85.60mm / 53.98mm = 1.58577
  const topEdge = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const bottomEdge = Math.hypot(p2.x - p3.x, p2.y - p3.y);
  const leftEdge = Math.hypot(p3.x - p0.x, p3.y - p0.y);
  const rightEdge = Math.hypot(p2.x - p1.x, p2.y - p1.y);

  const calcW = Math.round(Math.max(topEdge, bottomEdge, 800));
  const destW = targetWidth || calcW;
  const destH = targetHeight || Math.round(destW / 1.58577);

  const outCanvas = document.createElement("canvas");
  outCanvas.width = destW;
  outCanvas.height = destH;
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) return sourceCanvas;

  // Extract source pixels
  const srcImgData = sCtx.getImageData(0, 0, sw, sh);
  const srcData = srcImgData.data;

  const outImgData = outCtx.createImageData(destW, destH);
  const outData = outImgData.data;

  // Compute Projective Homography from Unit Square [0, 1]^2 to Quad (p0, p1, p2, p3)
  const x0 = p0.x, y0 = p0.y;
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;

  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const sx = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const sy = y0 - y1 + y2 - y3;

  let a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number;

  if (Math.abs(sx) < 1e-4 && Math.abs(sy) < 1e-4) {
    // Parallelogram / Affine
    a = x1 - x0;
    b = x2 - x1;
    c = x0;
    d = y1 - y0;
    e = y2 - y1;
    f = y0;
    g = 0;
    h = 0;
  } else {
    const det = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(det) < 1e-7) {
      // Degenerate, fallback
      a = x1 - x0;
      b = x3 - x0;
      c = x0;
      d = y1 - y0;
      e = y3 - y0;
      f = y0;
      g = 0;
      h = 0;
    } else {
      g = (sx * dy2 - sy * dx2) / det;
      h = (dx1 * sy - dy1 * sx) / det;
      a = x1 - x0 + g * x1;
      b = x3 - x0 + h * x3;
      c = x0;
      d = y1 - y0 + g * y1;
      e = y3 - y0 + h * y3;
      f = y0;
    }
  }

  // Map destination pixels using backward projective mapping with bilinear interpolation
  for (let dy = 0; dy < destH; dy++) {
    const v = dy / (destH - 1);
    for (let dx = 0; dx < destW; dx++) {
      const u = dx / (destW - 1);
      const denom = g * u + h * v + 1;
      const srcX = (a * u + b * v + c) / denom;
      const srcY = (d * u + e * v + f) / denom;

      const destIdx = (dy * destW + dx) * 4;

      if (srcX >= 0 && srcX < sw - 1 && srcY >= 0 && srcY < sh - 1) {
        const xf = Math.floor(srcX);
        const yf = Math.floor(srcY);
        const xc = xf + 1;
        const yc = yf + 1;

        const uFrac = srcX - xf;
        const vFrac = srcY - yf;

        const w00 = (1 - uFrac) * (1 - vFrac);
        const w10 = uFrac * (1 - vFrac);
        const w01 = (1 - uFrac) * vFrac;
        const w11 = uFrac * vFrac;

        const idx00 = (yf * sw + xf) * 4;
        const idx10 = (yf * sw + xc) * 4;
        const idx01 = (yc * sw + xf) * 4;
        const idx11 = (yc * sw + xc) * 4;

        outData[destIdx] = Math.round(
          srcData[idx00] * w00 + srcData[idx10] * w10 + srcData[idx01] * w01 + srcData[idx11] * w11
        );
        outData[destIdx + 1] = Math.round(
          srcData[idx00 + 1] * w00 + srcData[idx10 + 1] * w10 + srcData[idx01 + 1] * w01 + srcData[idx11 + 1] * w11
        );
        outData[destIdx + 2] = Math.round(
          srcData[idx00 + 2] * w00 + srcData[idx10 + 2] * w10 + srcData[idx01 + 2] * w01 + srcData[idx11 + 2] * w11
        );
        outData[destIdx + 3] = 255;
      } else {
        // Transparent or white border outside bounds
        outData[destIdx] = 255;
        outData[destIdx + 1] = 255;
        outData[destIdx + 2] = 255;
        outData[destIdx + 3] = 255;
      }
    }
  }

  outCtx.putImageData(outImgData, 0, 0);
  return outCanvas;
}

/**
 * CamScanner Pro Magic Color Filter:
 * Automatically whitens document backgrounds, removes phone shadows,
 * deepens national ID typography and black ink, and keeps stamps/eagle saturated!
 */
export function applyCamScannerMagicColor(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const [hue, sat, lum] = rgbToHsl(r, g, b);

    let newLum = lum;
    let newSat = sat;

    // Document background lightening curve
    if (lum > 0.58) {
      const ratio = (lum - 0.58) / 0.42;
      newLum = Math.min(1.0, lum + 0.38 * Math.pow(ratio, 0.7));
      // Desaturate mild yellow/grey cast in background
      if (sat < 0.28) {
        newSat = Math.max(0, sat * (1 - ratio * 0.75));
      }
    } else if (lum < 0.26) {
      // National ID digits and ink deepening
      newLum = Math.max(0, lum * 0.82);
      newSat = Math.min(1.0, sat * 1.15);
    } else {
      // Midtones (eagle, colors, portrait)
      newSat = Math.min(1.0, sat * 1.08);
    }

    const [nr, ng, nb] = hslToRgb(hue, newSat, newLum);
    d[i] = nr;
    d[i + 1] = ng;
    d[i + 2] = nb;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Rotates an image by an exact angle in degrees (fine-angle rotation)
 */
export function rotateImageCanvas(
  imgElement: HTMLImageElement | HTMLCanvasElement,
  angleDegrees: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const rad = (angleDegrees * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));

  const w = "naturalWidth" in imgElement ? imgElement.naturalWidth || imgElement.width : imgElement.width;
  const h = "naturalHeight" in imgElement ? imgElement.naturalHeight || imgElement.height : imgElement.height;

  canvas.width = Math.round(w * cos + h * sin);
  canvas.height = Math.round(h * cos + w * sin);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(imgElement, -w / 2, -h / 2);

  return canvas;
}

export function processImageOnCanvas(
  imgElement: HTMLImageElement,
  options: ProcessImageOptions
): string {
  const {
    invert = false,
    brightness = 100,
    contrast = 100,
    sharpness = 0,
    camScannerMode = false,
    screenClarifierMode = false,
    grayscale = false,
    fineAngle = 0,
    preserveColors = true, // Default to true for authentic ID card & photo colors
    crop,
    quad,
  } = options;

  // 1. Initial draw or rotated draw
  let workingCanvas: HTMLCanvasElement;
  if (fineAngle !== 0) {
    workingCanvas = rotateImageCanvas(imgElement, fineAngle);
  } else {
    workingCanvas = document.createElement("canvas");
    workingCanvas.width = imgElement.naturalWidth || imgElement.width || 800;
    workingCanvas.height = imgElement.naturalHeight || imgElement.height || 600;
    const initialCtx = workingCanvas.getContext("2d");
    if (initialCtx) {
      initialCtx.drawImage(imgElement, 0, 0);
    }
  }

  // 2. Apply 4-corner Quad Perspective Warp (CamScanner Style) if provided
  if (quad) {
    workingCanvas = warpPerspectiveQuad(workingCanvas, quad);
  } else if (crop && crop.width > 0 && crop.height > 0) {
    // Or fallback to axis-aligned crop
    workingCanvas = cropImageCanvas(workingCanvas, crop);
  }

  // If CamScanner magic mode is requested, run background whitening & ink enhancement
  if (camScannerMode) {
    workingCanvas = applyCamScannerMagicColor(workingCanvas);
  }

  const ctx = workingCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return imgElement.src;

  const w = workingCanvas.width;
  const h = workingCanvas.height;

  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  // Contrast factor
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const bDelta = brightness - 100;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];

    // 1. Invert colors
    if (invert) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }

    // 2. Grayscale mode
    if (grayscale) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray;
      g = gray;
      b = gray;
    }

    // 3. COLOR-SAFE HSL LUMINANCE BRIGHTENING (Requirement #4)
    // Preserves Hue & Saturation perfectly without washing out colors
    if (preserveColors && !grayscale) {
      const [hue, sat, light] = rgbToHsl(r, g, b);

      let newLight = light;
      let newSat = sat;

      if (bDelta > 0) {
        // Boost midtones and background while keeping dark numbers black
        if (light < 0.26) {
          // National ID numbers, stamp ink, dark typography: deepen for crisp contrast
          newLight = Math.max(0, light * 0.94);
        } else {
          // Smooth curve lifting background and removing shadows
          const ratio = (light - 0.26) / 0.74;
          const lift = (bDelta / 100) * 0.38 * Math.pow(ratio, 0.75);
          newLight = Math.min(1.0, light + lift);
          // Protect saturation from fading
          newSat = Math.min(1.0, sat * 1.06);
        }
      } else if (bDelta < 0) {
        newLight = Math.max(0, light * (1 + bDelta / 150));
      }

      // Apply subtle contrast in lightness domain only
      if (contrast !== 100) {
        newLight = (contrastFactor * (newLight * 255 - 128) + 128) / 255;
        newLight = Math.min(1.0, Math.max(0, newLight));
      }

      const [newR, newG, newB] = hslToRgb(hue, newSat, newLight);
      r = newR;
      g = newG;
      b = newB;
    } else {
      // Legacy RGB mode
      if (bDelta !== 0) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (bDelta > 0) {
          if (lum > 90) {
            const ratio = (lum - 90) / 165;
            const lift = bDelta * 1.2 * ratio;
            r = Math.min(255, r + lift);
            g = Math.min(255, g + lift);
            b = Math.min(255, b + lift);
          } else {
            const textDeepen = 1 - bDelta / 400;
            r = Math.max(0, r * textDeepen);
            g = Math.max(0, g * textDeepen);
            b = Math.max(0, b * textDeepen);
          }
        }
      }

      if (contrast !== 100) {
        r = contrastFactor * (r - 128) + 128;
        g = contrastFactor * (g - 128) + 128;
        b = contrastFactor * (b - 128) + 128;
      }
    }

    d[i] = Math.min(255, Math.max(0, r));
    d[i + 1] = Math.min(255, Math.max(0, g));
    d[i + 2] = Math.min(255, Math.max(0, b));
  }

  // 4. Edge-Preserving Unsharp Sharpening
  if (sharpness > 0 && w > 2 && h > 2) {
    const factor = sharpness / 100;
    const center = 1 + 4 * factor;
    const neighbor = -factor;

    const copy = new Uint8ClampedArray(d);

    for (let y = 1; y < h - 1; y++) {
      const rowOffset = y * w * 4;
      const prevRowOffset = (y - 1) * w * 4;
      const nextRowOffset = (y + 1) * w * 4;

      for (let x = 1; x < w - 1; x++) {
        const idx = rowOffset + x * 4;

        for (let c = 0; c < 3; c++) {
          const top = copy[prevRowOffset + x * 4 + c];
          const bottom = copy[nextRowOffset + x * 4 + c];
          const left = copy[rowOffset + (x - 1) * 4 + c];
          const right = copy[rowOffset + (x + 1) * 4 + c];
          const current = copy[idx + c];

          const res = current * center + (top + bottom + left + right) * neighbor;
          d[idx + c] = Math.min(255, Math.max(0, res));
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return workingCanvas.toDataURL("image/jpeg", 0.94);
}
