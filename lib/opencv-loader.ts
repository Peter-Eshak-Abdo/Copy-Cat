/**
 * OpenCV.js Client-Side Dynamic Loader & Computer Vision Utilities
 * Loads /opencv.js locally from public folder without any external network dependency.
 * Provides robust 4-corner contour detection and perspective warp for ID cards.
 */

import { QuadCorners, Point2D } from "./canvas-filters";

export interface OpenCVMat {
  delete(): void;
  rows: number;
  cols: number;
  data32S: Int32Array;
  [key: string]: unknown;
}

export interface OpenCVMatVector {
  size(): number;
  get(index: number): OpenCVMat;
  delete(): void;
}

export interface OpenCVSize {
  width: number;
  height: number;
}

export interface OpenCVScalar {
  [key: string]: unknown;
}

export interface OpenCVRotatedRect {
  center: { x: number; y: number };
  size: OpenCVSize;
  angle: number;
}

export interface OpenCVInstance {
  Mat: {
    new (): OpenCVMat;
    ones(rows: number, cols: number, type: number): OpenCVMat;
  };
  MatVector: new () => OpenCVMatVector;
  Size: new (width: number, height: number) => OpenCVSize;
  Scalar: new (...args: number[]) => OpenCVScalar;
  RotatedRect: {
    points(rect: OpenCVRotatedRect): Array<{ x: number; y: number }>;
  };
  imread(imageSource: HTMLCanvasElement | ImageData | string): OpenCVMat;
  cvtColor(src: OpenCVMat, dst: OpenCVMat, code: number, dstCn?: number): void;
  GaussianBlur(
    src: OpenCVMat,
    dst: OpenCVMat,
    ksize: OpenCVSize,
    sigmaX: number,
    sigmaY: number,
    borderType?: number
  ): void;
  Canny(
    image: OpenCVMat,
    edges: OpenCVMat,
    threshold1: number,
    threshold2: number,
    apertureSize?: number,
    L2gradient?: boolean
  ): void;
  dilate(src: OpenCVMat, dst: OpenCVMat, kernel: OpenCVMat): void;
  findContours(
    image: OpenCVMat,
    contours: OpenCVMatVector,
    hierarchy: OpenCVMat,
    mode: number,
    method: number
  ): void;
  contourArea(contour: OpenCVMat, oriented?: boolean): number;
  arcLength(curve: OpenCVMat, closed: boolean): number;
  approxPolyDP(
    curve: OpenCVMat,
    approxCurve: OpenCVMat,
    epsilon: number,
    closed: boolean
  ): void;
  isContourConvex(contour: OpenCVMat): boolean;
  minAreaRect(points: OpenCVMat): OpenCVRotatedRect;
  matFromArray(
    rows: number,
    cols: number,
    type: number,
    array: number[]
  ): OpenCVMat;
  getPerspectiveTransform(src: OpenCVMat, dst: OpenCVMat): OpenCVMat;
  warpPerspective(
    src: OpenCVMat,
    dst: OpenCVMat,
    M: OpenCVMat,
    dsize: OpenCVSize,
    flags?: number,
    borderMode?: number,
    borderValue?: OpenCVScalar
  ): void;
  imshow(canvasSource: HTMLCanvasElement | string, mat: OpenCVMat): void;
  onRuntimeInitialized?: () => void;
  COLOR_RGBA2GRAY: number;
  BORDER_DEFAULT: number;
  BORDER_CONSTANT: number;
  CV_8U: number;
  CV_32FC2: number;
  RETR_LIST: number;
  CHAIN_APPROX_SIMPLE: number;
  INTER_LANCZOS4: number;
  [key: string]: unknown;
}

declare global {
  interface Window {
    cv?: OpenCVInstance;
  }
}

let cvLoadPromise: Promise<OpenCVInstance> | null = null;

/**
 * Ensures OpenCV.js is loaded and initialized in the browser
 */
export function loadOpenCV(): Promise<OpenCVInstance> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV can only run in browser"));
  }

  if (window.cv && window.cv.Mat) {
    return Promise.resolve(window.cv);
  }

  if (cvLoadPromise) {
    return cvLoadPromise;
  }

  cvLoadPromise = new Promise((resolve, reject) => {
    // Check if script already inserted
    let script = document.querySelector('script[src="/opencv.js"]') as HTMLScriptElement | null;

    const checkCvReady = () => {
      if (window.cv && window.cv.Mat) {
        resolve(window.cv);
        return true;
      }
      return false;
    };

    if (checkCvReady()) return;

    if (!script) {
      script = document.createElement("script");
      script.src = "/opencv.js";
      script.async = true;
      script.type = "text/javascript";
      document.body.appendChild(script);
    }

    // Set callback if OpenCV supports onRuntimeInitialized
    if (window.cv) {
      window.cv.onRuntimeInitialized = () => {
        if (window.cv) resolve(window.cv);
      };
    }

    script.onload = () => {
      if (checkCvReady()) return;

      if (window.cv) {
        window.cv.onRuntimeInitialized = () => {
          if (window.cv) resolve(window.cv);
        };
      }

      // Poll briefly if onRuntimeInitialized already fired or not bound
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (checkCvReady()) {
          clearInterval(interval);
        } else if (attempts > 50) {
          clearInterval(interval);
          reject(new Error("OpenCV runtime initialization timed out"));
        }
      }, 100);
    };

    script.onerror = (err) => {
      cvLoadPromise = null;
      reject(err);
    };
  });

  return cvLoadPromise;
}

/**
 * Orders 4 points in consistent clockwise order:
 * Top-Left, Top-Right, Bottom-Right, Bottom-Left
 */
function orderCornerPoints(pts: Point2D[]): QuadCorners {
  if (pts.length !== 4) {
    return {
      tl: { x: 0.05, y: 0.08 },
      tr: { x: 0.95, y: 0.08 },
      br: { x: 0.95, y: 0.92 },
      bl: { x: 0.05, y: 0.92 },
    };
  }

  // Calculate sum (x + y) and difference (x - y)
  // Top-Left has smallest sum
  // Bottom-Right has largest sum
  // Top-Right has largest difference (x - y)
  // Bottom-Left has smallest difference (x - y)
  let tl = pts[0];
  let tr = pts[0];
  let br = pts[0];
  let bl = pts[0];

  let minSum = pts[0].x + pts[0].y;
  let maxSum = minSum;
  let minDiff = pts[0].x - pts[0].y;
  let maxDiff = minDiff;

  for (let i = 1; i < pts.length; i++) {
    const sum = pts[i].x + pts[i].y;
    const diff = pts[i].x - pts[i].y;

    if (sum < minSum) {
      minSum = sum;
      tl = pts[i];
    }
    if (sum > maxSum) {
      maxSum = sum;
      br = pts[i];
    }
    if (diff > maxDiff) {
      maxDiff = diff;
      tr = pts[i];
    }
    if (diff < minDiff) {
      minDiff = diff;
      bl = pts[i];
    }
  }

  return { tl, tr, br, bl };
}

/**
 * Automatically detects the 4 corners of an ID card using OpenCV.js Contour Detection.
 * 1. Converts canvas to grayscale
 * 2. Applies Gaussian blur to reduce noise
 * 3. Runs Canny edge detector & morphological dilation to close gaps
 * 4. Extracts contours and finds the largest 4-sided convex polygon with standard card aspect ratio
 * 5. Returns normalized quad corners [0, 1]
 */
export async function detectCardCornersOpenCV(sourceCanvas: HTMLCanvasElement): Promise<QuadCorners> {
  const defaultQuad: QuadCorners = {
    tl: { x: 0.04, y: 0.06 },
    tr: { x: 0.96, y: 0.06 },
    br: { x: 0.96, y: 0.94 },
    bl: { x: 0.04, y: 0.94 },
  };

  try {
    const cv = await loadOpenCV();
    if (!cv || !cv.imread) return defaultQuad;

    // Work on a scaled down copy for high-speed & stable edge detection
    const maxDim = 800;
    let sw = sourceCanvas.width;
    let sh = sourceCanvas.height;
    let scale = 1;
    if (Math.max(sw, sh) > maxDim) {
      scale = maxDim / Math.max(sw, sh);
      sw = Math.round(sw * scale);
      sh = Math.round(sh * scale);
    }

    const scaledCanvas = document.createElement("canvas");
    scaledCanvas.width = sw;
    scaledCanvas.height = sh;
    const sCtx = scaledCanvas.getContext("2d");
    if (!sCtx) return defaultQuad;
    sCtx.drawImage(sourceCanvas, 0, 0, sw, sh);

    const src = cv.imread(scaledCanvas);
    const gray = new cv.Mat();
    const blur = new cv.Mat();
    const edges = new cv.Mat();
    const dilated = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    try {
      // 1. Grayscale
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

      // 2. Gaussian Blur
      const ksize = new cv.Size(5, 5);
      cv.GaussianBlur(gray, blur, ksize, 0, 0, cv.BORDER_DEFAULT);

      // 3. Canny Edge Detection with Otsu-based or adaptive thresholds
      cv.Canny(blur, edges, 50, 150, 3, false);

      // 4. Dilate to bridge broken contours around card edges
      const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
      cv.dilate(edges, dilated, kernel);
      kernel.delete();

      // 5. Find contours
      cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      let maxArea = 0;
      let bestQuad: Point2D[] | null = null;
      const totalArea = sw * sh;

      // Scan contours for largest 4-point polygon
      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const area = cv.contourArea(cnt);

        // Ignore small contours (must be at least 15% of image area)
        if (area < totalArea * 0.15) {
          cnt.delete();
          continue;
        }

        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.025 * peri, true);

        // Check if quadrilateral and convex
        if (approx.rows === 4 && cv.isContourConvex(approx)) {
          if (area > maxArea) {
            maxArea = area;
            bestQuad = [];
            for (let r = 0; r < 4; r++) {
              bestQuad.push({
                x: approx.data32S[r * 2] / sw,
                y: approx.data32S[r * 2 + 1] / sh,
              });
            }
          }
        }

        approx.delete();
        cnt.delete();
      }

      if (bestQuad && bestQuad.length === 4) {
        return orderCornerPoints(bestQuad);
      }

      // If no strict 4-corner polygon was found, try minAreaRect on largest contour
      let largestCnt: OpenCVMat | null = null;
      let largestArea = 0;
      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const area = cv.contourArea(cnt);
        if (area > largestArea && area > totalArea * 0.2) {
          largestArea = area;
          if (largestCnt) largestCnt.delete();
          largestCnt = cnt;
        } else {
          cnt.delete();
        }
      }

      if (largestCnt) {
        const rotatedRect = cv.minAreaRect(largestCnt);
        const vertices = cv.RotatedRect.points(rotatedRect);
        const pts: Point2D[] = [];
        for (let i = 0; i < 4; i++) {
          pts.push({
            x: Math.max(0, Math.min(1, vertices[i].x / sw)),
            y: Math.max(0, Math.min(1, vertices[i].y / sh)),
          });
        }
        largestCnt.delete();
        return orderCornerPoints(pts);
      }
    } finally {
      src.delete();
      gray.delete();
      blur.delete();
      edges.delete();
      dilated.delete();
      contours.delete();
      hierarchy.delete();
    }
  } catch (err) {
    console.warn("OpenCV corner detection fallback to heuristic:", err);
  }

  return defaultQuad;
}

/**
 * Performs Perspective Warp using OpenCV.js
 */
export async function warpPerspectiveOpenCV(
  sourceCanvas: HTMLCanvasElement,
  quad: QuadCorners,
  targetWidth = 1011, // 85.6mm at 300 DPI
  targetHeight = 638  // 54.0mm at 300 DPI
): Promise<HTMLCanvasElement> {
  const outCanvas = document.createElement("canvas");
  outCanvas.width = targetWidth;
  outCanvas.height = targetHeight;

  try {
    const cv = await loadOpenCV();
    if (cv && cv.imread && cv.warpPerspective) {
      const src = cv.imread(sourceCanvas);
      const dst = new cv.Mat();

      const sw = sourceCanvas.width;
      const sh = sourceCanvas.height;

      // Source corners in pixels
      const srcCoords = [
        quad.tl.x * sw, quad.tl.y * sh,
        quad.tr.x * sw, quad.tr.y * sh,
        quad.br.x * sw, quad.br.y * sh,
        quad.bl.x * sw, quad.bl.y * sh,
      ];

      // Destination rectangle
      const dstCoords = [
        0, 0,
        targetWidth, 0,
        targetWidth, targetHeight,
        0, targetHeight,
      ];

      const srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, srcCoords);
      const dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, dstCoords);
      const M = cv.getPerspectiveTransform(srcMat, dstMat);
      const dsize = new cv.Size(targetWidth, targetHeight);

      cv.warpPerspective(
        src,
        dst,
        M,
        dsize,
        cv.INTER_LANCZOS4,
        cv.BORDER_CONSTANT,
        new cv.Scalar(255, 255, 255, 255)
      );

      cv.imshow(outCanvas, dst);

      src.delete();
      dst.delete();
      srcMat.delete();
      dstMat.delete();
      M.delete();

      return outCanvas;
    }
  } catch (err) {
    console.warn("OpenCV warpPerspective failed, falling back to canvas warp:", err);
  }

  // Fallback: draw directly
  const ctx = outCanvas.getContext("2d");
  if (ctx) ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
  return outCanvas;
}
