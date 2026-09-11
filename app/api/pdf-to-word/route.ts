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
    const body = await req.json().catch(() => ({}));
    const rawData = body.pdfBase64 || body.imageBase64;
    const { fileName = "Document" } = body;

    if (!rawData) {
      return NextResponse.json(
        { error: "لم يتم إرسال بيانات الملف أو الصفحة للتحويل." },
        { status: 400 }
      );
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "مفتاح الذكاء الاصطناعي غير متوفر في الخادم." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Determine mimeType
    let mimeType = "image/jpeg";
    if (typeof rawData === "string" && rawData.startsWith("data:application/pdf")) {
      mimeType = "application/pdf";
    } else if (body.mimeType) {
      mimeType = body.mimeType;
    }

    const cleanBase64 = rawData.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, "");

    const prompt = `
أنت خبير فائق الاحترافية في تحويل وتنسيق مستندات الـ PDF والأوراق العربية إلى مستندات Word منسقة بدقة تامة (Arabic PDF/Document to Formatted Word Specialist).
المهمة:
حلل هذا المستند واقرأ كل النصوص والبيانات واستخرجها مع الحفاظ التام على الهيكل الأكاديمي والمهني:
1. العناوين الرئيسية (ضع في بداية السطر كلمة: # أو عنوان صريح)
2. العناوين الفرعية والمطالب والبنود (أولاً، ثانياً، البند الأول...)
3. الفقرات السردية متماسكة ومنظمة بدون تشويه في الحروف أو الأرقام العربية
4. الجداول أو القوائم المحتوية على بنود رتبها بوضوح
5. أخرج فقط النص الكامل الصافي والمنسق بدون أي مقدمات أو تحيات أو اعتذارات من عندك.
`;

    let formattedText = "";
    const models = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-2.5-flash"];

    for (const model of models) {
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

        if (response.text && response.text.trim()) {
          formattedText = response.text.trim();
          break;
        }
      } catch (e) {
        console.warn(`[PDF-to-Word] model ${model} failed, trying next:`, e);
      }
    }

    if (!formattedText) {
      throw new Error("تعذر استخراج وتنسيق نصوص المستند.");
    }

    return NextResponse.json({
      success: true,
      text: formattedText,
      formattedText,
      fileName,
    });
  } catch (err: unknown) {
    console.error("PDF to Word Route Error:", err);
    const message = err instanceof Error ? err.message : "حدث خطأ أثناء تحويل مستند PDF إلى وورد.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
