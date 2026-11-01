import { NextRequest, NextResponse } from "next/server";
import { geminiVisionJson, getGeminiApiKey } from "@/lib/gemini";
import { turnQuad } from "@/lib/card-pairing";

type Pt = { x: number; y: number };

const CORNER_PROMPT =
  "Point to the 4 corners of the plastic ID card in this image. If a finger covers a corner, point to where " +
  "the card corner actually is (extend the straight card edges). The answer should follow the json format: " +
  '[{"point": [y, x], "label": "top_left"}, ...] with labels top_left, top_right, bottom_right, bottom_left ' +
  "(as seen in the image) and points normalized to 0-1000.";

// Separate call: mixing this into the pointing prompt degrades the corner points
const ORIENT_PROMPT =
  "This photo shows an ID card that may be photographed sideways or upside down. Look at the printed text and " +
  "the portrait on the card. Which edge of the photo does the TOP of the card's text face? " +
  'Return ONLY JSON {"text_top": "top" | "right" | "bottom" | "left"} (top = upright card, left = the text\'s top ' +
  "points to the left edge of the photo, so the lines run from bottom to top).";

const SIDE_PROMPT =
  "This photo shows one side of an ID card (usually an Egyptian national ID card). Return ONLY JSON " +
  '{"upright": true | false, "side": "front" | "back" | "unknown", "national_id": "...", "id_tail": "..."}. ' +
  "upright = the card's text reads normally (not sideways, not upside down). " +
  "front = the side with the person's portrait photo, name and address. " +
  "back = the side without a portrait (profession, gender, religion, marital status, expiry date, barcode). " +
  "national_id = the 14-digit national number printed on this side, written with Western digits 0-9 " +
  "(convert Arabic-Indic digits), no spaces; an empty string if you cannot read all 14 digits for sure. " +
  "id_tail = the LAST digits of that national number that you can read for sure (at least the last 6, Western " +
  "digits), even when the start is unreadable; an empty string if not even 6 are readable.";

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
    | { upright?: unknown; side?: unknown; national_id?: unknown; id_tail?: unknown }
    | null;
  const side = answer?.side === "front" || answer?.side === "back" ? answer.side : "unknown";
  const nationalId = normalizeNationalId(answer?.national_id);
  // A partly readable number still pairs sides by its last digits (see lib/card-pairing.ts)
  const tail = westernDigits(answer?.id_tail);
  const idTail = nationalId ? nationalId.slice(-6) : tail.length >= 6 ? tail.slice(-6) : null;
  return { side, nationalId, idTail, upright: answer?.upright !== false };
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

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "لم يتم تقديم بيانات الصورة." }, { status: 400 });
    }
    if (!getGeminiApiKey()) {
      return NextResponse.json({ success: false, error: "مفتاح GEMINI_API_KEY غير مهيأ في الخادم." });
    }

    // Corners on the photo as taken, while the direction is checked; then side and number on the upright photo
    const [answer, rotation] = await Promise.all([geminiVisionJson(CORNER_PROMPT, imageBase64), detectRotation(imageBase64)]);
    const { upright: _upright, ...sideInfo } = await readCard(imageBase64, rotation); // eslint-disable-line @typescript-eslint/no-unused-vars
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
    if (!tl || !tr || !br || !bl) {
      // No usable answer: the client falls back to OpenCV edge detection
      return NextResponse.json({ success: false, error: "تعذر تحديد أركان البطاقة.", ...sideInfo });
    }

    // Perspective makes real cards trapezoids, so the points are used as given (no parallelogram "repair")
    const corners = turnQuad({ tl, tr, br, bl }, sideInfo.rotation ?? 0);
    const clamp = (p: Pt) => ({
      x: Math.round(Math.max(0, Math.min(1, p.x)) * 1000) / 1000,
      y: Math.round(Math.max(0, Math.min(1, p.y)) * 1000) / 1000,
    });

    // Reject degenerate answers (card smaller than 8% of the photo)
    const area =
      Math.abs(
        (corners.tl.x * corners.tr.y - corners.tr.x * corners.tl.y) +
          (corners.tr.x * corners.br.y - corners.br.x * corners.tr.y) +
          (corners.br.x * corners.bl.y - corners.bl.x * corners.br.y) +
          (corners.bl.x * corners.tl.y - corners.tl.x * corners.bl.y)
      ) / 2;
    if (area < 0.08) {
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
