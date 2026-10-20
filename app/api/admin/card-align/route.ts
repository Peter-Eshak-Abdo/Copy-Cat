import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

function getApiKey(): string | undefined {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (process.env.GOOGLE_API_KEY) return process.env.GOOGLE_API_KEY;
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/GEMINI_API_KEY=([^\r\n]+)/);
      if (match && match[1].trim()) return match[1].trim();
    }
  } catch {}
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "لم يتم تقديم بيانات الصورة." }, { status: 400 });
    }

    const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, "");

    const apiKey = getApiKey();
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: "مفتاح GEMINI_API_KEY غير مهيأ في الخادم.",
        corners: {
          tl: { x: 0.04, y: 0.06 },
          tr: { x: 0.96, y: 0.06 },
          br: { x: 0.96, y: 0.94 },
          bl: { x: 0.04, y: 0.94 },
        },
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
You are a computer vision specialist in document alignment and identity card detection.
Detect the 4 physical corners of the rectangular ID card (such as Egyptian National ID, Driver's License, Residence Card) in this image.

CRITICAL INSTRUCTIONS:
1. Locate the true 4 corners of the rectangular plastic card:
   - "tl": Top-Left corner { "x": float_0_to_1, "y": float_0_to_1 }
   - "tr": Top-Right corner { "x": float_0_to_1, "y": float_0_to_1 }
   - "br": Bottom-Right corner { "x": float_0_to_1, "y": float_0_to_1 }
   - "bl": Bottom-Left corner { "x": float_0_to_1, "y": float_0_to_1 }
2. FINGERS & HANDS OCCLUSION HANDLING:
   If human fingers, thumbs, or hands are holding the card edge, DO NOT include the fingers! Predict and extrapolate where the true straight physical border of the card passes beneath or around the fingers.
3. Coordinates must be normalized floats between 0.0 and 1.0 (relative to image width and height).
4. Return ONLY a valid JSON object without any markdown tags or backticks:
{
  "corners": {
    "tl": { "x": 0.05, "y": 0.08 },
    "tr": { "x": 0.95, "y": 0.08 },
    "br": { "x": 0.95, "y": 0.92 },
    "bl": { "x": 0.05, "y": 0.92 }
  },
  "card_type": "egyptian_id_front" | "egyptian_id_back" | "id_card",
  "confidence": 0.95
}
`;

    const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    let rawText = "";

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: cleanBase64,
                  },
                },
                { text: prompt },
              ],
            },
          ],
        });
        rawText = response.text ? response.text.trim() : "";
        if (rawText) break;
      } catch (err) {
        console.warn(`Card align attempt failed on ${model}:`, err);
      }
    }

    if (rawText) {
      const cleanJson = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      try {
        const parsed = JSON.parse(cleanJson);
        if (parsed.corners && parsed.corners.tl && parsed.corners.tr && parsed.corners.br && parsed.corners.bl) {
          // Clamp points between 0 and 1
          const clampPt = (pt: { x: number; y: number }) => ({
            x: Math.max(0, Math.min(1, Math.round(pt.x * 1000) / 1000)),
            y: Math.max(0, Math.min(1, Math.round(pt.y * 1000) / 1000)),
          });

          return NextResponse.json({
            success: true,
            corners: {
              tl: clampPt(parsed.corners.tl),
              tr: clampPt(parsed.corners.tr),
              br: clampPt(parsed.corners.br),
              bl: clampPt(parsed.corners.bl),
            },
            card_type: parsed.card_type || "id_card",
            confidence: parsed.confidence || 0.95,
          });
        }
      } catch (parseErr) {
        console.warn("Failed to parse Gemini card alignment JSON:", parseErr, rawText);
      }
    }

    // Fallback default quad
    return NextResponse.json({
      success: true,
      corners: {
        tl: { x: 0.04, y: 0.06 },
        tr: { x: 0.96, y: 0.06 },
        br: { x: 0.96, y: 0.94 },
        bl: { x: 0.04, y: 0.94 },
      },
      fallback: true,
    });
  } catch (error) {
    console.error("Error in card-align route:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء فحص أركان البطاقة بالذكاء الاصطناعي." },
      { status: 500 }
    );
  }
}
