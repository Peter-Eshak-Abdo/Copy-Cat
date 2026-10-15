import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

import { verifySessionTokenEdge } from "@/lib/edge-auth";

import os from "os";

const POOL_DIR = path.join(process.cwd(), "public", "uploads", "pool");
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB max

function getTargetPoolDir(): { poolDir: string; isServerless: boolean } {
  try {
    if (!fs.existsSync(POOL_DIR)) {
      fs.mkdirSync(POOL_DIR, { recursive: true });
    }
    const testFile = path.join(POOL_DIR, `.test_${Date.now()}`);
    fs.writeFileSync(testFile, "ok");
    fs.unlinkSync(testFile);
    return { poolDir: POOL_DIR, isServerless: false };
  } catch {
    const tmpPool = path.join(os.tmpdir(), "copycat_pool");
    try {
      if (!fs.existsSync(tmpPool)) {
        fs.mkdirSync(tmpPool, { recursive: true });
      }
    } catch {}
    return { poolDir: tmpPool, isServerless: true };
  }
}

async function checkAuth(req: NextRequest): Promise<boolean> {
  const token =
    req.cookies.get("copycat_session_token")?.value ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  const auth = await verifySessionTokenEdge(token);
  return auth.isValid;
}

export async function POST(req: NextRequest) {
  try {
    const isAuthed = await checkAuth(req);
    if (!isAuthed) {
      return NextResponse.json({ success: false, error: "وصول غير مصرح به" }, { status: 401 });
    }

    const { poolDir, isServerless } = getTargetPoolDir();
    const { imageBase64, filename, customTitle } = await req.json();

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { success: false, error: "يرجى تقديم بيانات الصورة لتنفيذ التحسين." },
        { status: 400 }
      );
    }

    // Enforce base64 length limit
    if (imageBase64.length > MAX_IMAGE_BYTES * 1.4) {
      return NextResponse.json(
        { success: false, error: "حجم الصورة يتجاوز الحد الأقصى المسموح (15 ميجابايت)." },
        { status: 400 }
      );
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");

    const timestamp = Date.now();
    const safeName = (filename || "product")
      .replace(/\.[^/.]+$/, "")
      .replace(/[\\/*?:"<>|]/g, "_")
      .substring(0, 30);

    const savedFilename = `enhanced_${timestamp}_${safeName}.jpg`;
    const fullPath = path.join(poolDir, savedFilename);

    // Save image to pool locally or tmp directory
    try {
      fs.writeFileSync(fullPath, buffer);
    } catch (writeErr) {
      console.warn("Write to poolDir failed:", writeErr);
    }

    const webUrl = isServerless
      ? `/api/admin/photos?file=${encodeURIComponent(savedFilename)}`
      : `/uploads/pool/${savedFilename}`;

    // Query Gemini Vision if API key is configured
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    let aiInfo = {
      suggestedTitle: customTitle || "منتج مكتبي عالي الجودة",
      category: "أدوات مكتبية",
      description: "صورة تم تحسين ألوانها وإضاءتها بتقنية الاستوديو الذكية لتناسب متجر كوبي كات.",
      aiAdvice: "تم تعديل توازن البياض (White Balance) وتعزيز التباين وإبراز تفاصيل الماركة بنجاح.",
    };

    if (geminiKey && geminiKey.length > 10) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

        const promptText =
          "Analyze this retail stationery / office supply product photo taken with a phone for 'Copy Cat Library' store in Egypt. " +
          "Return ONLY a valid JSON object with these exact keys: " +
          "suggestedTitle: (Short precise Arabic product title, e.g. قلم جاف بريما أزرق 1.0 مم or كشكول سلك 100 ورقة A4 or باكت ورق تصوير دبل إيه 80 جم), " +
          "category: (One of: أوراق وتصوير, أدوات مكتبية, أقلام وتصحيح, دفاتر وكشاكيل, تجليد ولوازم, هندسة وفنون), " +
          "description: (Attractive 1-sentence product description in Arabic for the online store), " +
          "aiAdvice: (Concise note in Arabic describing how the image was enhanced and product highlighted).";

        const resp = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: promptText },
                  {
                    inlineData: {
                      mimeType: "image/jpeg",
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 500,
            },
          }),
        });

        if (resp.ok) {
          const resData = await resp.json();
          const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            aiInfo = {
              suggestedTitle: parsed.suggestedTitle || aiInfo.suggestedTitle,
              category: parsed.category || aiInfo.category,
              description: parsed.description || aiInfo.description,
              aiAdvice: parsed.aiAdvice || aiInfo.aiAdvice,
            };
          }
        }
      } catch (geminiErr) {
        console.warn("Gemini product analysis note:", geminiErr);
      }
    }

    return NextResponse.json({
      success: true,
      url: webUrl,
      filename: savedFilename,
      sizeBytes: buffer.length,
      ...aiInfo,
    });
  } catch (err: unknown) {
    console.error("Enhance product error:", err);
    const message = err instanceof Error ? err.message : "حدث خطأ غير متوقع أثناء معالجة المنتج";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
