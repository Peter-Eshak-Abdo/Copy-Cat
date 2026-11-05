import { NextRequest, NextResponse } from "next/server";
import { geminiVisionJson, getGeminiApiKey } from "@/lib/gemini";
import { turnQuad } from "@/lib/card-pairing";

type Pt = { x: number; y: number };

const CORNER_PROMPT =
  "Point to the 4 corners of the card in this image (a plastic ID card, or any other card: a membership / " +
  "syndicate card, a student or work card, a laminated paper card). Point to the card's OUTER edge, including " +
  "its whole border, never inside the printed area. If a finger covers a corner, point to where " +
  "the card corner actually is (extend the straight card edges). The answer should follow the json format: " +
  '[{"point": [y, x], "label": "top_left"}, ...] with labels top_left, top_right, bottom_right, bottom_left ' +
  "(as seen in the image) and points normalized to 0-1000.";

// When the corner points fail: a box is the most reliable thing the model returns
const BOX_PROMPT =
  "Detect the card in this image (an ID card, membership card, or any laminated card or small card-like " +
  'document). Return ONLY JSON [{"box_2d": [ymin, xmin, ymax, xmax], "label": "card"}] with the box around the ' +
  "card's whole outer edge, in 0-1000 coordinates.";

// Separate call: mixing this into the pointing prompt degrades the corner points
const ORIENT_PROMPT =
  "This photo shows an ID card that may be photographed sideways or upside down. Look at the printed text and " +
  "the portrait on the card. Which edge of the photo does the TOP of the card's text face? " +
  'Return ONLY JSON {"text_top": "top" | "right" | "bottom" | "left"} (top = upright card, left = the text\'s top ' +
  "points to the left edge of the photo, so the lines run from bottom to top).";

const SIDE_PROMPT =
  "This photo shows one side of an ID card (usually an Egyptian national ID card). Return ONLY JSON " +
  '{"upright": true | false, "side": "front" | "back" | "unknown", "national_id": "...", "id_tail": "...", "id_pattern": "..."}. ' +
  "upright = the card's text reads normally (not sideways, not upside down). " +
  "front = the side with the person's portrait photo, name and address. " +
  "back = the side without a portrait (profession, gender, religion, marital status, expiry date, barcode). " +
  "national_id = the 14-digit national number printed on this side, written with Western digits 0-9 " +
  "(convert Arabic-Indic digits), no spaces; an empty string if you cannot read all 14 digits for sure. " +
  "id_tail = the LAST digits of that national number that you can read for sure (at least the last 6, Western " +
  "digits), even when the start is unreadable; an empty string if not even 6 are readable. " +
  "id_pattern = the national number as exactly 14 characters, one per digit position from left to right: the " +
  "Western digit where you can read it for sure, ? where you cannot (example: 2980?01?2345?7); an empty string " +
  "if fewer than 5 digits are readable.";

// Customers sometimes send one picture with the front on top and the back below (or side by side)
const SPLIT_PROMPT =
  "Detect every separate side of a plastic ID card in this image. Usually there is exactly one card side, but " +
  "some pictures combine two sides into one image: the front placed above the back, or side by side. " +
  'Return ONLY a JSON array with one entry per card side: [{"box_2d": [ymin, xmin, ymax, xmax], "side": "front" | "back"}] ' +
  "with the box in 0-1000 coordinates of this image. front = the side with the portrait photo.";

type Box = [number, number, number, number];

/**
 * Where to cut a picture holding two card sides, or null for a normal single-side photo. The cut is the
 * middle of the gap between the two boxes, so each half keeps its whole card even if a box is a bit tight.
 */
async function detectStackedSides(imageBase64: string) {
  const answer = await geminiVisionJson(SPLIT_PROMPT, imageBase64, 300);
  const boxes = (Array.isArray(answer) ? answer : [])
    .map((e: { box_2d?: unknown; side?: unknown }) =>
      Array.isArray(e?.box_2d) && e.box_2d.length === 4 && e.box_2d.every((v) => typeof v === "number")
        ? { box: (e.box_2d as number[]).map((v) => Math.max(0, Math.min(1000, v))) as Box, side: e.side === "back" ? "back" : e.side === "front" ? "front" : "unknown" }
        : null
    )
    .filter((b): b is { box: Box; side: "front" | "back" | "unknown" } => !!b)
    // a stray tiny box (a logo, a sticker) is not a card
    .filter((b) => (b.box[2] - b.box[0]) * (b.box[3] - b.box[1]) > 0.12 * 1_000_000);
  if (boxes.length !== 2) return null;

  const [a, b] = boxes;
  const overlapY = Math.min(a.box[2], b.box[2]) - Math.max(a.box[0], b.box[0]);
  const overlapX = Math.min(a.box[3], b.box[3]) - Math.max(a.box[1], b.box[1]);
  const minH = Math.min(a.box[2] - a.box[0], b.box[2] - b.box[0]);
  const minW = Math.min(a.box[3] - a.box[1], b.box[3] - b.box[1]);
  // Stacked: little vertical overlap. Side by side: little horizontal overlap.
  if (overlapY < minH * 0.15) {
    const [top, bottom] = a.box[0] <= b.box[0] ? [a, b] : [b, a];
    const cut = (Math.min(top.box[2], bottom.box[0]) + Math.max(top.box[2], bottom.box[0])) / 2 / 1000;
    if (cut < 0.2 || cut > 0.8) return null;
    return { direction: "vertical" as const, cut, sides: [top.side, bottom.side] };
  }
  if (overlapX < minW * 0.15) {
    const [left, right] = a.box[1] <= b.box[1] ? [a, b] : [b, a];
    const cut = (Math.min(left.box[3], right.box[1]) + Math.max(left.box[3], right.box[1])) / 2 / 1000;
    if (cut < 0.2 || cut > 0.8) return null;
    return { direction: "horizontal" as const, cut, sides: [left.side, right.side] };
  }
  return null;
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function westernDigits(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[٠-٩]/g, (c) => String(ARABIC_DIGITS.indexOf(c)))
    .replace(/[۰-۹]/g, (c) => String(EXTENDED_DIGITS.indexOf(c)))
    .replace(/\D/g, "");
}

function normalizeNationalId(raw: unknown): string | null {
  const digits = westernDigits(raw);
  return digits.length === 14 ? digits : null;
}

/** "2980?01?2345?7": 14 positions, digits where readable; kept only with at least 5 readable digits */
function normalizePattern(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const p = raw
    .replace(/[٠-٩]/g, (c) => String(ARABIC_DIGITS.indexOf(c)))
    .replace(/[۰-۹]/g, (c) => String(EXTENDED_DIGITS.indexOf(c)))
    .replace(/[^0-9?]/g, "");
  if (p.length !== 14) return null;
  return (p.match(/\d/g) || []).length >= 5 ? p : null;
}

/** Clockwise turn that makes the card upright, from the edge its text's top faces */
const ROTATION_FOR_TOP: Record<string, number> = { top: 0, right: 270, bottom: 180, left: 90 };

async function detectRotation(imageBase64: string): Promise<number | null> {
  const answer = (await geminiVisionJson(ORIENT_PROMPT, imageBase64, 60)) as { text_top?: unknown } | null;
  return ROTATION_FOR_TOP[String(answer?.text_top || "").toLowerCase()] ?? null;
}

/** Same photo turned upright: digits read sideways or upside down came back wrong or reversed in testing */
async function uprightImage(imageBase64: string, rotation: number): Promise<string> {
  if (!rotation) return imageBase64;
  try {
    const sharp = (await import("sharp")).default;
    const input = Buffer.from(imageBase64.replace(/^data:[^,]+,/, ""), "base64");
    const out = await sharp(input).rotate(rotation).jpeg({ quality: 90 }).toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return imageBase64;
  }
}

async function detectSide(imageBase64: string) {
  const answer = (await geminiVisionJson(SIDE_PROMPT, imageBase64, 250)) as
    | { upright?: unknown; side?: unknown; national_id?: unknown; id_tail?: unknown; id_pattern?: unknown }
    | null;
  const side = answer?.side === "front" || answer?.side === "back" ? answer.side : "unknown";
  const nationalId = normalizeNationalId(answer?.national_id);
  // A partly readable number still pairs sides by its last digits (see lib/card-pairing.ts)
  const tail = westernDigits(answer?.id_tail);
  const idTail = nationalId ? nationalId.slice(-6) : tail.length >= 6 ? tail.slice(-6) : null;
  return { side, nationalId, idTail, idPattern: nationalId ? null : normalizePattern(answer?.id_pattern), upright: answer?.upright !== false };
}

/**
 * Side and number read on the upright photo. The direction answer is wrong now and then (mostly on the
 * sparse back side, or with the weaker fallback models), so a photo that still is not upright is tried
 * the opposite way round once.
 */
async function readCard(imageBase64: string, rotation: number | null) {
  const first = await detectSide(await uprightImage(imageBase64, rotation ?? 0));
  if (first.upright || !answerUsable(first)) return { ...first, rotation };
  const other = ((rotation ?? 0) + 180) % 360;
  const second = await detectSide(await uprightImage(imageBase64, other));
  return second.upright ? { ...second, rotation: other } : { ...first, rotation };
}

const answerUsable = (s: { side: string }) => s.side !== "unknown";

type QuadPts = Record<"tl" | "tr" | "br" | "bl", Pt>;

/**
 * The pointing answers sit a little inside the card edge (a back side lost its national number line to it),
 * so the quad grows around its centre: a sliver of background is harmless, a cut-off line is not.
 */
function growQuad(q: QuadPts, factor: number): QuadPts {
  const cx = (q.tl.x + q.tr.x + q.br.x + q.bl.x) / 4;
  const cy = (q.tl.y + q.tr.y + q.br.y + q.bl.y) / 4;
  const g = (p: Pt) => ({ x: cx + (p.x - cx) * factor, y: cy + (p.y - cy) * factor });
  return { tl: g(q.tl), tr: g(q.tr), br: g(q.br), bl: g(q.bl) };
}
const GROW = 1.05;

function quadArea(q: QuadPts): number {
  return (
    Math.abs(
      q.tl.x * q.tr.y - q.tr.x * q.tl.y +
        (q.tr.x * q.br.y - q.br.x * q.tr.y) +
        (q.br.x * q.bl.y - q.bl.x * q.br.y) +
        (q.bl.x * q.tl.y - q.tl.x * q.bl.y)
    ) / 2
  );
}

/** Card box from BOX_PROMPT as a quad, or null */
async function detectCardBox(imageBase64: string): Promise<QuadPts | null> {
  const answer = await geminiVisionJson(BOX_PROMPT, imageBase64, 200);
  const entries = (Array.isArray(answer) ? answer : [answer]) as Array<{ box_2d?: unknown } | null>;
  const first = entries.find(
    (e) => Array.isArray(e?.box_2d) && e.box_2d.length === 4 && e.box_2d.every((v) => typeof v === "number")
  );
  if (!first) return null;
  const [y0, x0, y1, x1] = (first.box_2d as number[]).map((v) => Math.max(0, Math.min(1, v / 1000)));
  if (y1 - y0 < 0.05 || x1 - x0 < 0.05) return null;
  return { tl: { x: x0, y: y0 }, tr: { x: x1, y: y0 }, br: { x: x1, y: y1 }, bl: { x: x0, y: y1 } };
}

/** Pixel size of the photo (the corner answers are 0-1 of each axis, so edge lengths need it) */
async function imageSize(imageBase64: string): Promise<{ w: number; h: number } | null> {
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(Buffer.from(imageBase64.replace(/^data:[^,]+,/, ""), "base64")).metadata();
    return meta.width && meta.height ? { w: meta.width, h: meta.height } : null;
  } catch {
    return null;
  }
}

/**
 * A card is always wider than tall, so when it lies landscape in the photo only 0 / 180 can be right, and
 * when it stands portrait only 90 / 270. A direction answer of the wrong kind (seen on a back side: the
 * straightened card came out turned a quarter and squashed) is moved a quarter; readCard then checks
 * upright and flips it 180 if needed.
 */
function fitRotationToCard(rotation: number | null, quad: QuadPts, size: { w: number; h: number } | null) {
  if (rotation === null || !size) return rotation;
  const len = (a: Pt, b: Pt) => Math.hypot((a.x - b.x) * size.w, (a.y - b.y) * size.h);
  const across = (len(quad.tl, quad.tr) + len(quad.bl, quad.br)) / 2;
  const down = (len(quad.tl, quad.bl) + len(quad.tr, quad.br)) / 2;
  const ratio = across / Math.max(1, down);
  // Too square to tell (strong perspective): trust the answer
  if (ratio < 1.2 && ratio > 1 / 1.2) return rotation;
  const cardIsLandscape = ratio >= 1.2;
  const rotationKeepsLandscape = rotation % 180 === 0;
  return cardIsLandscape === rotationKeepsLandscape ? rotation : (rotation + 90) % 360;
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, action } = await req.json();

    // A phone photo is a few MB of base64; anything far bigger is not a card photo
    if (typeof imageBase64 !== "string" || imageBase64.length > 15_000_000) {
      return NextResponse.json({ error: "الصورة كبيرة جداً أو مش صورة." }, { status: 413 });
    }
    if (!imageBase64) {
      return NextResponse.json({ error: "لم يتم تقديم بيانات الصورة." }, { status: 400 });
    }
    if (!getGeminiApiKey()) {
      return NextResponse.json({ success: false, error: "مفتاح GEMINI_API_KEY غير مهيأ في الخادم." });
    }

    if (action === "split") {
      const split = await detectStackedSides(imageBase64);
      return NextResponse.json({ success: true, split });
    }

    // Corners on the photo as taken, while the direction is checked; then side and number on the upright photo
    const [answer, detectedRotation, size] = await Promise.all([
      geminiVisionJson(CORNER_PROMPT, imageBase64),
      detectRotation(imageBase64),
      imageSize(imageBase64),
    ]);
    const list = Array.isArray(answer) ? answer : [];
    const byLabel: Record<string, Pt> = {};
    for (const e of list as Array<{ point?: unknown; label?: unknown }>) {
      if (
        Array.isArray(e?.point) &&
        e.point.length === 2 &&
        e.point.every((v) => typeof v === "number") &&
        typeof e.label === "string"
      ) {
        const [y, x] = e.point as number[];
        byLabel[e.label] = { x: Math.max(0, Math.min(1, x / 1000)), y: Math.max(0, Math.min(1, y / 1000)) };
      }
    }

    const { top_left: tl, top_right: tr, bottom_right: br, bottom_left: bl } = byLabel;
    // Perspective makes real cards trapezoids, so the points are used as given (no parallelogram "repair")
    let raw: QuadPts | null = tl && tr && br && bl ? { tl, tr, br, bl } : null;
    // A tiny or missing answer (seen on a paper membership card): ask for the card's box instead
    if (!raw || quadArea(raw) < 0.03) raw = await detectCardBox(imageBase64);

    const rotation = raw ? fitRotationToCard(detectedRotation, raw, size) : detectedRotation;
    const { upright: _upright, ...sideInfo } = await readCard(imageBase64, rotation); // eslint-disable-line @typescript-eslint/no-unused-vars
    if (!raw) {
      // No usable answer: the client falls back to OpenCV edge detection
      return NextResponse.json({ success: false, error: "تعذر تحديد أركان البطاقة.", ...sideInfo });
    }

    const corners = turnQuad(growQuad(raw, GROW), sideInfo.rotation ?? 0);
    const clamp = (p: Pt) => ({
      x: Math.round(Math.max(0, Math.min(1, p.x)) * 1000) / 1000,
      y: Math.round(Math.max(0, Math.min(1, p.y)) * 1000) / 1000,
    });

    // Reject degenerate answers (card smaller than 3% of the photo; a card shot from afar is still a card)
    if (quadArea(corners) < 0.03) {
      return NextResponse.json({ success: false, error: "تعذر تحديد أركان البطاقة.", ...sideInfo });
    }

    return NextResponse.json({
      success: true,
      ...sideInfo,
      corners: { tl: clamp(corners.tl), tr: clamp(corners.tr), br: clamp(corners.br), bl: clamp(corners.bl) },
    });
  } catch (error) {
    console.error("Error in card-align route:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء فحص أركان البطاقة بالذكاء الاصطناعي." },
      { status: 500 }
    );
  }
}
