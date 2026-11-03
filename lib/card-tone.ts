/**
 * Per-card tone for the ID-card tool. A fixed +18% brightness made dark photos printable but burned out
 * cards that were already bright (flash, white desk), so each card is measured and gets its own values:
 * dark photos are brightened and whitened, washed-out ones are darkened with a little more contrast.
 */

export interface LumaStats {
  /** Median luminance 0-255 */
  median: number;
  /** 5th / 95th percentile: how dark the text is and how bright the background is */
  p05: number;
  p95: number;
}

export interface CardTone {
  brightness: number;
  contrast: number;
  /** CamScanner-style background whitening (only helps dark, shadowed photos) */
  whiten: boolean;
}

// Median luminance of a well-printed Egyptian ID (light green/beige background with dark text)
const TARGET_MEDIAN = 168;

export function lumaStatsFromPixels(data: Uint8ClampedArray): LumaStats {
  const hist = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    hist[Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])]++;
    n++;
  }
  const at = (q: number) => {
    const target = q * n;
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= target) return v;
    }
    return 255;
  };
  return n ? { median: at(0.5), p05: at(0.05), p95: at(0.95) } : { median: TARGET_MEDIAN, p05: 20, p95: 230 };
}

export function chooseCardTone(s: LumaStats): CardTone {
  const clamp = (v: number, lo: number, hi: number) => Math.round(Math.min(hi, Math.max(lo, v)));
  const brightness = clamp((100 * TARGET_MEDIAN) / Math.max(30, s.median), 82, 140);
  // Low dynamic range (grey, foggy photo) needs contrast; a bright card that gets darkened needs a little
  // extra so the text stays black instead of turning grey
  const range = s.p95 - s.p05;
  let contrast = range < 120 ? 118 : range < 170 ? 110 : 104;
  if (brightness < 100) contrast = Math.max(contrast, 112);
  return { brightness, contrast, whiten: s.median < 150 };
}

/** Measures a card image (data URL) on a small canvas */
export async function measureCardTone(src: string): Promise<CardTone> {
  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = src;
  });
  if (!img) return { brightness: 110, contrast: 105, whiten: true };
  const w = 200;
  const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { brightness: 110, contrast: 105, whiten: true };
  ctx.drawImage(img, 0, 0, w, h);
  // Ignore a 6% border: leftover background around the card skews the numbers
  const mx = Math.round(w * 0.06);
  const my = Math.round(h * 0.06);
  const data = ctx.getImageData(mx, my, w - 2 * mx, h - 2 * my).data;
  return chooseCardTone(lumaStatsFromPixels(data));
}
