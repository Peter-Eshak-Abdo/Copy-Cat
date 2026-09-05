/**
 * Advanced Image Processing Canvas Filters v1.6
 * Designed for Copy-Cat document scanning, ID cards, passport photos, and screen photos.
 * Features:
 *  - Non-blurry intelligent document lightening (preserves crisp black text while lifting background)
 *  - Screen Clarifier & Anti-Moire filter (removes phone-to-screen pixel patterns & glare)
 *  - Fine-angle rotation & cropping
 */

export interface ProcessImageOptions {
  invert?: boolean;
  brightness?: number;          // 0 to 200 (100 is default)
  contrast?: number;            // 0 to 200 (100 is default)
  sharpness?: number;           // 0 to 100 (0 is off, 50 is medium, 100 is max)
  camScannerMode?: boolean;
  screenClarifierMode?: boolean;// Anti-Moire & computer screen photo text clarifier (Requirement #13)
  grayscale?: boolean;
  fineAngle?: number;           // Rotation in degrees (e.g. -45 to +45 or 0-360)
}

/**
 * Rotates an image by an exact angle in degrees (fine-angle rotation)
 */
export function rotateImageCanvas(
  imgElement: HTMLImageElement,
  angleDegrees: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const rad = (angleDegrees * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));

  const w = imgElement.naturalWidth || imgElement.width || 800;
  const h = imgElement.naturalHeight || imgElement.height || 600;

  // Compute bounding box after rotation
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

  const ctx = workingCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return imgElement.src;

  const w = workingCanvas.width;
  const h = workingCanvas.height;

  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  // Precompute contrast factor
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  // Non-linear brightness factor
  const bDelta = brightness - 100;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];

    // 1. Invert colors (Black screen / medical tests -> White background for >80% ink savings)
    if (invert) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }

    // 2. Grayscale or Screen Clarifier Desaturation
    if (grayscale || screenClarifierMode) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      if (grayscale) {
        r = gray;
        g = gray;
        b = gray;
      } else if (screenClarifierMode) {
        // Suppress blueish LCD backlight cast and chromatic moire fringe
        r = r * 0.4 + gray * 0.6;
        g = g * 0.4 + gray * 0.6;
        b = b * 0.3 + gray * 0.7;
      }
    }

    // 3. Screen Clarifier: High-frequency glare reduction & dynamic thresholding (Requirement #13)
    if (screenClarifierMode) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      // Darken text on computer screen
      if (lum < 130) {
        r = Math.max(0, r * 0.7);
        g = Math.max(0, g * 0.7);
        b = Math.max(0, b * 0.7);
      } else {
        // Boost screen background brightness cleanly to eliminate moire pattern
        const boost = (lum - 130) * 1.5;
        r = Math.min(255, r + boost);
        g = Math.min(255, g + boost);
        b = Math.min(255, b + boost);
      }
    }

    // 4. Smart Document Whitening (CamScanner Mode)
    if (camScannerMode) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > 140) {
        const boost = (lum - 140) * 1.7;
        r = Math.min(255, r + boost);
        g = Math.min(255, g + boost);
        b = Math.min(255, b + boost);
      } else if (lum < 110) {
        r = Math.max(0, r * 0.72);
        g = Math.max(0, g * 0.72);
        b = Math.max(0, b * 0.72);
      }
    }

    // 5. Intelligent Document Lightening (Prevents washed-out blur / "لغوشة" on ID cards & papers)
    if (bDelta !== 0) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (bDelta > 0) {
        // Brighten background without washing out dark text
        if (lum > 90) {
          const ratio = (lum - 90) / 165; // 0 to 1
          const lift = bDelta * 1.4 * ratio;
          r = Math.min(255, r + lift);
          g = Math.min(255, g + lift);
          b = Math.min(255, b + lift);
        } else {
          // Keep text pitch black and crisp!
          const textDeepen = 1 - (bDelta / 400);
          r = Math.max(0, r * textDeepen);
          g = Math.max(0, g * textDeepen);
          b = Math.max(0, b * textDeepen);
        }
      } else {
        // Darken
        const factor = 1 + (bDelta / 150);
        r = Math.max(0, r * factor);
        g = Math.max(0, g * factor);
        b = Math.max(0, b * factor);
      }
    }

    // 6. Contrast factor
    if (contrast !== 100) {
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;
    }

    d[i] = Math.min(255, Math.max(0, r));
    d[i + 1] = Math.min(255, Math.max(0, g));
    d[i + 2] = Math.min(255, Math.max(0, b));
  }

  // 7. Edge-Preserving Unsharp Sharpening
  const effectiveSharpness = screenClarifierMode ? Math.max(sharpness, 70) : sharpness;
  if (effectiveSharpness > 0 && w > 2 && h > 2) {
    const factor = effectiveSharpness / 100;
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
