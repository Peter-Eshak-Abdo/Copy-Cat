"use client";

import type { FaceDetector } from "@mediapipe/tasks-vision";
import { rotateCanvasClockwise, type HeadBox } from "@/lib/portrait-enhancer";

/**
 * In-browser fallback for head detection + orientation when every Gemini model failed (quota, outage,
 * missing key). Runs Google's BlazeFace through MediaPipe: free, no key, ~1MB model fetched once.
 * Its wasm runtime must match the installed @mediapipe/tasks-vision version.
 */
const MEDIAPIPE_VERSION = "1.1.1";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

let detectorPromise: Promise<FaceDetector> | null = null;

function getDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      return FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.5,
      });
    })();
    // A failed load (offline, blocked CDN) is retried on the next photo
    detectorPromise.catch(() => {
      detectorPromise = null;
    });
  }
  return detectorPromise;
}

/** Eye midpoint -> mouth vector, in pixels: points toward the chin whatever the photo's orientation */
type Face = { x: number; y: number; w: number; h: number; score: number; down?: { x: number; y: number } };

function scaledCopy(src: HTMLCanvasElement, sx: number, sy: number, sw: number, sh: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(sw * scale));
  c.height = Math.max(1, Math.round(sh * scale));
  c.getContext("2d")?.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return { canvas: c, scale };
}

/** Best face in `src`, in src pixel coordinates. Tiles the upper image when the face is too small for BlazeFace. */
function findFace(detector: FaceDetector, src: HTMLCanvasElement): Face | null {
  const W = src.width;
  const H = src.height;
  // Whole photo first, then overlapping tiles over the upper 70% for far-away (full-body) subjects
  const regions: Array<[number, number, number, number]> = [[0, 0, W, H]];
  const tw = W * 0.6;
  const th = H * 0.4;
  for (const fy of [0, 0.15, 0.3]) {
    for (const fx of [0, 0.2, 0.4]) regions.push([W * fx, H * fy, tw, th]);
  }

  let best: Face | null = null;
  for (let r = 0; r < regions.length; r++) {
    const [sx, sy, sw, sh] = regions[r];
    const { canvas, scale } = scaledCopy(src, sx, sy, sw, sh, 1024);
    for (const det of detector.detect(canvas).detections) {
      const bb = det.boundingBox;
      const score = det.categories?.[0]?.score ?? 0;
      if (!bb) continue;
      const face: Face = { x: sx + bb.originX / scale, y: sy + bb.originY / scale, w: bb.width / scale, h: bb.height / scale, score };
      // BlazeFace keypoints: 0 right eye, 1 left eye, 2 nose tip, 3 mouth, 4/5 ears (normalized to the tile)
      const kp = det.keypoints;
      if (kp && kp.length >= 4) {
        face.down = {
          x: (kp[3].x - (kp[0].x + kp[1].x) / 2) * canvas.width,
          y: (kp[3].y - (kp[0].y + kp[1].y) / 2) * canvas.height,
        };
      }
      // Larger faces win ties: the main subject, not someone in the background
      if (!best || face.score * Math.sqrt(face.w) > best.score * Math.sqrt(best.w)) best = face;
    }
    // A confident face on the whole photo needs no tiling
    if (r === 0 && best && best.score > 0.8) break;
  }
  return best;
}

/**
 * Returns the rotation (clockwise degrees) that stands the photo upright and the head box
 * ([ymin, xmin, ymax, xmax], 0..1000) in the ROTATED photo, or null when no face was found.
 */
export async function detectHeadLocally(full: HTMLCanvasElement): Promise<{ box: HeadBox; rotation: number } | null> {
  let detector: FaceDetector;
  try {
    detector = await getDetector();
  } catch (err) {
    console.warn("MediaPipe face detector could not load:", err);
    return null;
  }

  const preview = scaledCopy(full, 0, 0, full.width, full.height, 1600).canvas;
  const detectAt = (rotation: number) => {
    const rotated = rotateCanvasClockwise(preview, rotation);
    const face = findFace(detector, rotated);
    return face ? { face, rotation, w: rotated.width, h: rotated.height } : null;
  };

  // BlazeFace also finds sideways faces, so a hit alone does not prove the photo is upright
  let best = null;
  for (const rotation of [0, 90, 270, 180]) {
    best = detectAt(rotation);
    if (best) break;
  }
  if (!best) return null;

  // The eyes -> mouth direction says where the chin points; turn the photo so it points down
  const down = best.face.down;
  if (down && Math.hypot(down.x, down.y) > 0) {
    const extra =
      Math.abs(down.y) >= Math.abs(down.x) ? (down.y > 0 ? 0 : 180) : down.x > 0 ? 90 : 270;
    if (extra !== 0) {
      const upright = detectAt((best.rotation + extra) % 360);
      if (upright) best = upright;
    }
  }

  // BlazeFace boxes run from the brows to the chin; the head box used for framing spans the hair top
  // to the chin and ear to ear, so it is grown upward and sideways.
  const { face, w, h } = best;
  const ymin = face.y - face.h * 0.65;
  const ymax = face.y + face.h * 1.05;
  const xmin = face.x - face.w * 0.15;
  const xmax = face.x + face.w * 1.15;
  const box: HeadBox = [
    Math.max(0, (ymin / h) * 1000),
    Math.max(0, (xmin / w) * 1000),
    Math.min(1000, (ymax / h) * 1000),
    Math.min(1000, (xmax / w) * 1000),
  ];
  return { box, rotation: best.rotation };
}
