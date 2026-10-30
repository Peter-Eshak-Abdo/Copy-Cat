import { NextRequest, NextResponse } from "next/server";
import { geminiVisionJson, getGeminiApiKey } from "@/lib/gemini";

type Pt = { x: number; y: number };

const CORNER_PROMPT =
  "Point to the 4 corners of the plastic ID card in this image. If a finger covers a corner, point to where " +
  "the card corner actually is (extend the straight card edges). The answer should follow the json format: " +
  '[{"point": [y, x], "label": "top_left"}, ...] with labels top_left, top_right, bottom_right, bottom_left ' +
  "(as seen in the image) and points normalized to 0-1000.";

// Separate call: mixing this into the pointing prompt degrades the corner points
const SIDE_PROMPT =
  "This photo shows one side of an ID card (usually an Egyptian national ID card). Return ONLY JSON " +
  '{"side": "front" | "back" | "unknown", "national_id": "..."}. ' +
  "front = the side with the person's portrait photo, name and address. " +
  "back = the side without a portrait (profession, gender, religion, marital status, expiry date, barcode). " +
  "national_id = the 14-digit national number printed on this side, written with Western digits 0-9 " +
  "(convert Arabic-Indic digits), no spaces; an empty string if it is not readable.";

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function normalizeNationalId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw
    .replace(/[٠-٩]/g, (c) => String(ARABIC_DIGITS.indexOf(c)))
    .replace(/[۰-۹]/g, (c) => String(EXTENDED_DIGITS.indexOf(c)))
    .replace(/\D/g, "");
  return digits.length === 14 ? digits : null;
}

async function detectSide(imageBase64: string) {
  const answer = (await geminiVisionJson(SIDE_PROMPT, imageBase64, 200)) as
    | { side?: unknown; national_id?: unknown }
    | null;
  const side = answer?.side === "front" || answer?.side === "back" ? answer.side : "unknown";
  return { side, nationalId: normalizeNationalId(answer?.national_id) };
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "لم يتم تقديم بيانات الصورة." }, { status: 400 });
    }
    if (!getGeminiApiKey()) {
      return NextResponse.json({ success: false, error: "مفتاح GEMINI_API_KEY غير مهيأ في الخادم." });
    }

    const [answer, sideInfo] = await Promise.all([geminiVisionJson(CORNER_PROMPT, imageBase64), detectSide(imageBase64)]);
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
    const corners = { tl, tr, br, bl };
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
