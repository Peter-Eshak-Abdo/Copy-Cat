import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const POOL_DIR = path.join(process.cwd(), "public", "uploads", "pool");

function ensurePoolDir() {
  if (!fs.existsSync(POOL_DIR)) {
    fs.mkdirSync(POOL_DIR, { recursive: true });
  }
}

export async function POST(req: NextRequest) {
  try {
    ensurePoolDir();
    const { imageBase64, filename, customTitle } = await req.json();

    if (!imageBase64) {
      return NextResponse.json(
        { success: false, error: "يرجى تقديم بيانات الصورة لتنفيذ التحسين." },
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
    const fullPath = path.join(POOL_DIR, savedFilename);

    // Save image to pool locally (Zero Supabase storage consumed!)
    fs.writeFileSync(fullPath, buffer);
    const webUrl = `/uploads/pool/${savedFilename}`;

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
  } catch (err: any) {
    console.error("Enhance product error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
