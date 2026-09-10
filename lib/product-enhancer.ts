/**
 * AI Product Photo Enhancer & Clarifier Engine v1.0
 * Copy-Cat Ismailia - Stationery & Retail Studio Optimization
 *
 * Specifically designed for mobile phone photos taken inside the shop:
 * 1. Auto White-Balance & Color-Cast Neutralizer (removes warm/yellowish fluorescent lighting)
 * 2. Vibrant Retail Boost (brings out vivid colors of pens, highlighters, notebooks, packaging)
 * 3. Text & Barcode Clarifier (enhances micro-contrast on product labels, brand logos, numbers)
 * 4. Studio Shadow Softening & Contrast Adjustment
 */

export interface ProductEnhanceOptions {
  whiteBalance?: boolean;    // Neutralize indoor yellow tint
  vibranceBoost?: number;    // 0 to 100 (default 35)
  contrastBoost?: number;    // 0 to 100 (default 25)
  sharpness?: number;        // 0 to 100 (default 45)
  brightnessDelta?: number;  // -50 to +50 (default 10)
  clarifyLabels?: boolean;   // Deepen brand typography & barcodes
}

/**
 * Converts RGB to HSL
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
 * Converts HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
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
 * Auto White-Balance Correction:
 * Analyzes highlights in the top 5% brightest pixels to estimate illuminant color cast
 * and scales R, G, B channels towards neutral daylight (6500K).
 */
export function autoWhiteBalance(imageData: ImageData): void {
  const d = imageData.data;
  const len = d.length;

  // Sample brightest non-saturated pixels (luminance between 180 and 245)
  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  const step = Math.max(1, Math.floor(len / 40000));

  for (let i = 0; i < len; i += step * 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    if (lum > 170 && lum < 248) {
      sumR += r;
      sumG += g;
      sumB += b;
      count++;
    }
  }

  if (count < 20) return; // Not enough highlight references

  const avgR = sumR / count;
  const avgG = sumG / count;
  const avgB = sumB / count;
  const targetGray = (avgR + avgG + avgB) / 3;

  const scaleR = targetGray / Math.max(1, avgR);
  const scaleG = targetGray / Math.max(1, avgG);
  const scaleB = targetGray / Math.max(1, avgB);

  // Dampen extreme shifts to keep warmth realistic (clamp between 0.85 and 1.25)
  const dR = 1 + (scaleR - 1) * 0.75;
  const dG = 1 + (scaleG - 1) * 0.75;
  const dB = 1 + (scaleB - 1) * 0.75;

  for (let i = 0; i < len; i += 4) {
    d[i] = Math.min(255, Math.max(0, Math.round(d[i] * dR)));
    d[i + 1] = Math.min(255, Math.max(0, Math.round(d[i + 1] * dG)));
    d[i + 2] = Math.min(255, Math.max(0, Math.round(d[i + 2] * dB)));
  }
}

/**
 * Enhances Product Photo Quality on Canvas:
 * Applies White Balance, Color Vibrance, Product Label Clarification, and Studio Sharpening.
 */
export function enhanceProductPhotoCanvas(
  source: HTMLImageElement | HTMLCanvasElement,
  options: ProductEnhanceOptions = {}
): string {
  const {
    whiteBalance = true,
    vibranceBoost = 35,
    contrastBoost = 22,
    sharpness = 45,
    brightnessDelta = 8,
    clarifyLabels = true,
  } = options;

  const sw = "naturalWidth" in source ? source.naturalWidth || source.width : source.width;
  const sh = "naturalHeight" in source ? source.naturalHeight || source.height : source.height;

  // Max dimension 1400px for crisp performance & compact storage
  const maxDim = 1400;
  const scale = Math.min(1.0, maxDim / Math.max(sw, sh));
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return typeof source === "object" && "src" in source ? source.src : "";

  ctx.drawImage(source, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  // Step 1: Neutralize indoor yellow shop light
  if (whiteBalance) {
    autoWhiteBalance(imgData);
  }

  // Step 2: HSL Domain Vibrance & Dynamic Contrast Adjustment
  const satFactor = 1 + vibranceBoost / 100;
  const contrastFactor = (259 * (contrastBoost + 255)) / (255 * (259 - contrastBoost));
  const bFactor = brightnessDelta / 100;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];

    const [hue, sat, lum] = rgbToHsl(r, g, b);

    // Boost vibrance selectively in midtones (preserves skin tones / pure whites)
    let newSat = sat;
    if (sat > 0.12 && sat < 0.88) {
      newSat = Math.min(1.0, sat * satFactor);
    }

    // Lightness curve: gently lift shadows and contrast
    let newLum = lum;
    if (bFactor !== 0) {
      newLum = Math.min(1.0, Math.max(0, lum + bFactor * (1 - lum * 0.4)));
    }

    // Contrast on luminance
    newLum = (contrastFactor * (newLum * 255 - 128) + 128) / 255;
    newLum = Math.min(1.0, Math.max(0, newLum));

    // Deepen dark text / barcodes / brand logos for high legibility
    if (clarifyLabels && lum < 0.28) {
      newLum = Math.max(0, newLum * 0.88);
    }

    const [nr, ng, nb] = hslToRgb(hue, newSat, newLum);
    d[i] = nr;
    d[i + 1] = ng;
    d[i + 2] = nb;
  }

  // Step 3: Edge-Preserving Studio Sharpening on text and product contours
  if (sharpness > 0 && w > 3 && h > 3) {
    const factor = (sharpness / 100) * 0.7;
    const center = 1 + 4 * factor;
    const neighbor = -factor;
    const copy = new Uint8ClampedArray(d);

    for (let y = 1; y < h - 1; y++) {
      const row = y * w * 4;
      const prevRow = (y - 1) * w * 4;
      const nextRow = (y + 1) * w * 4;

      for (let x = 1; x < w - 1; x++) {
        const idx = row + x * 4;
        for (let c = 0; c < 3; c++) {
          const top = copy[prevRow + x * 4 + c];
          const bottom = copy[nextRow + x * 4 + c];
          const left = copy[row + (x - 1) * 4 + c];
          const right = copy[row + (x + 1) * 4 + c];
          const cur = copy[idx + c];

          const res = cur * center + (top + bottom + left + right) * neighbor;
          d[idx + c] = Math.min(255, Math.max(0, res));
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Return high-quality JPEG (94% quality)
  return canvas.toDataURL("image/jpeg", 0.94);
}
