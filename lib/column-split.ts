/**
 * Finds the line between two side-by-side text columns on a page (exam sheets printed two to a page with a
 * divider line, or with a blank gutter). Used only as a second way to read a page after every model got
 * stuck repeating itself on it: the models try to interleave both columns with "||" and loop, while each
 * column on its own reads fine.
 *
 * Works on a grayscale image (one byte per pixel, row by row). Returns the cut as a 0..1 fraction of the
 * width, or null when the page is not clearly two columns.
 */
export function findColumnSplit(gray: Uint8Array, w: number, h: number): number | null {
  if (w < 50 || h < 50) return null;
  const y0 = Math.floor(h * 0.06);
  const y1 = Math.floor(h * 0.96);
  const rows = y1 - y0;

  // Dark threshold relative to the paper (photos are greyer than scans)
  let sum = 0;
  for (let i = 0; i < gray.length; i += 7) sum += gray[i];
  const paper = sum / Math.ceil(gray.length / 7);
  const dark = Math.min(140, paper * 0.62);

  const x0 = Math.floor(w * 0.28);
  const x1 = Math.ceil(w * 0.72);
  // Share of rows that have ink at this x (a 3 px window, so a slightly slanted divider still counts)
  const ink = new Float32Array(w);
  for (let x = x0; x < x1; x++) {
    let n = 0;
    for (let y = y0; y < y1; y++) {
      const row = y * w;
      if (gray[row + x - 1] < dark || gray[row + x] < dark || gray[row + x + 1] < dark) n++;
    }
    ink[x] = n / rows;
  }

  const candidates: number[] = [];

  // 1. A printed divider: a thin line with ink on most rows, far above the text around it
  for (let x = x0 + 20; x < x1 - 20; x++) {
    if (ink[x] < 0.6) continue;
    let around = 0;
    let k = 0;
    for (let d = 8; d <= 30; d++) {
      around += ink[x - d] + ink[x + d];
      k += 2;
    }
    if (ink[x] > (around / k) * 2) candidates.push(x);
  }

  // 2. A blank gutter: a band at least ~1.2% of the width with (almost) no ink at all
  const minRun = Math.max(4, Math.round(w * 0.012));
  let start = -1;
  for (let x = x0; x <= x1; x++) {
    const empty = x < x1 && ink[x] < 0.012;
    if (empty && start < 0) start = x;
    if (!empty && start >= 0) {
      if (x - start >= minRun) candidates.push(Math.round((start + x - 1) / 2));
      start = -1;
    }
  }

  if (candidates.length === 0) return null;
  // Closest to the middle of the page
  const best = candidates.reduce((a, b) => (Math.abs(b - w / 2) < Math.abs(a - w / 2) ? b : a));
  return best / w;
}
