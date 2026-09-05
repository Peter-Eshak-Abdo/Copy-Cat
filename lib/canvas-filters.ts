/**
 * Image processing canvas filters for Invert & CamScanner
 */

export interface ProcessImageOptions {
  invert?: boolean;
  brightness?: number; // 0 to 200 (100 is default)
  contrast?: number;   // 0 to 200 (100 is default)
  camScannerMode?: boolean;
}

export function processImageOnCanvas(
  imgElement: HTMLImageElement,
  options: ProcessImageOptions
): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return imgElement.src;

  canvas.width = imgElement.naturalWidth || imgElement.width;
  canvas.height = imgElement.naturalHeight || imgElement.height;

  ctx.drawImage(imgElement, 0, 0);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;

  const {
    invert = false,
    brightness = 100,
    contrast = 100,
    camScannerMode = false,
  } = options;

  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const brightnessOffset = (brightness - 100) * 1.5;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];

    // 1. Invert colors (Black paper -> White paper for ink saving)
    if (invert) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }

    // 2. CamScanner algorithm: Whiten paper background & sharpen dark ink
    if (camScannerMode) {
      // Calculate Luminance
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // If background is light gray/dirty white, snap to pure white
      if (gray > 160) {
        const boost = (gray - 160) * 1.5;
        r = Math.min(255, r + boost);
        g = Math.min(255, g + boost);
        b = Math.min(255, b + boost);
      } else if (gray < 110) {
        // Darken text
        r = Math.max(0, r * 0.7);
        g = Math.max(0, g * 0.7);
        b = Math.max(0, b * 0.7);
      }
    }

    // 3. Brightness & Contrast adjustment
    if (contrast !== 100) {
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;
    }

    if (brightness !== 100) {
      r += brightnessOffset;
      g += brightnessOffset;
      b += brightnessOffset;
    }

    d[i] = Math.min(255, Math.max(0, r));
    d[i + 1] = Math.min(255, Math.max(0, g));
    d[i + 2] = Math.min(255, Math.max(0, b));
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.95);
}
