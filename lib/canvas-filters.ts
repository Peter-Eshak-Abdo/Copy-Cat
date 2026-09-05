/**
 * Image processing canvas filters for Invert, CamScanner & High-definition Sharpening
 * Designed for Copy-Cat document scanning, medical test screens & ink saving.
 */

export interface ProcessImageOptions {
  invert?: boolean;
  brightness?: number; // 0 to 200 (100 is default)
  contrast?: number;   // 0 to 200 (100 is default)
  sharpness?: number;  // 0 to 100 (0 is off, 50 is medium, 100 is max)
  camScannerMode?: boolean;
  grayscale?: boolean;
}

export function processImageOnCanvas(
  imgElement: HTMLImageElement,
  options: ProcessImageOptions
): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return imgElement.src;

  const w = imgElement.naturalWidth || imgElement.width || 800;
  const h = imgElement.naturalHeight || imgElement.height || 600;

  canvas.width = w;
  canvas.height = h;

  ctx.drawImage(imgElement, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  const {
    invert = false,
    brightness = 100,
    contrast = 100,
    sharpness = 0,
    camScannerMode = false,
    grayscale = false,
  } = options;

  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const brightnessOffset = (brightness - 100) * 1.5;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];

    // 1. Invert colors (Black screen/test papers -> White background for >80% ink savings)
    if (invert) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }

    // 2. Grayscale if requested
    if (grayscale) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray;
      g = gray;
      b = gray;
    }

    // 3. Smart Document Whitening (CamScanner algorithm without text erasing)
    if (camScannerMode) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      // If background is grayish or off-white, bleach it cleanly to pure white
      if (lum > 145) {
        const boost = (lum - 145) * 1.6;
        r = Math.min(255, r + boost);
        g = Math.min(255, g + boost);
        b = Math.min(255, b + boost);
      } else if (lum < 115) {
        // Darken text letters to enhance contrast
        r = Math.max(0, r * 0.75);
        g = Math.max(0, g * 0.75);
        b = Math.max(0, b * 0.75);
      }
    }

    // 4. Contrast
    if (contrast !== 100) {
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;
    }

    // 5. Brightness
    if (brightness !== 100) {
      r += brightnessOffset;
      g += brightnessOffset;
      b += brightnessOffset;
    }

    d[i] = Math.min(255, Math.max(0, r));
    d[i + 1] = Math.min(255, Math.max(0, g));
    d[i + 2] = Math.min(255, Math.max(0, b));
  }

  // 6. Optional 3x3 Convolution Sharpening (Unsharp Mask for text edges)
  if (sharpness > 0 && w > 2 && h > 2) {
    const factor = sharpness / 100; // 0 to 1.0
    // Kernel center weight: 1 + 4*factor, neighbors: -factor
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
  return canvas.toDataURL("image/jpeg", 0.94);
}
