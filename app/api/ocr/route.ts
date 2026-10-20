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
      if (match && match[1].trim()) {
        return match[1].trim();
      }
    }
  } catch {}
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, imageBase64, mimeType = "image/jpeg", textToRefine } = body;

    const apiKey = getApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير مهيأ في الخادم. يرجى التأكد من إضافته في ملف .env.local" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Action 1: Extract text from image (Vision OCR - Printed & Handwritten)
    if (action === "extract") {
      if (!imageBase64) {
        return NextResponse.json({ error: "لم يتم إرسال بيانات الصورة." }, { status: 400 });
      }

      // Clean base64 header if present
      const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, "");

      const prompt = `
أنت خبير فائق الدقة في التعرف الضوئي على المستندات والوثائق الرسمية المصرية والعربية (Arabic Document & Egyptian Administrative Form Specialist).

المهمة:
اقرأ هذه الوثيقة بعناية فائقة واستخرج كل النصوص والمحتويات مع الحفاظ التام والدقيق على الهيكل البصري الأصلي للورقة بنسبة 100%:

1. ترويسة العقود والوثائق ومربعات الصور (Photo Boxes):
- إذا كان في أعلى المستند مربعات صور (مثل: "صورة الزوج" على اليمين و "صورة الزوجة" على اليسار وبينهما عنوان العقد مثل "بسم الله الرحمن الرحيم" و "عقد زواج عرفي")، صغها بصيغة جدول ترويسة هكذا:
| صورة الزوج | # بسم الله الرحمن الرحيم<br>## عقد زواج عرفي | صورة الزوجة |
(لا تضع وسوم html أو أشكال غريبة، استخدم Markdown فقط).

2. العناوين الرئيسية والبسملة:
- البسملة والعنوان الرئيسي للمستند في سطر مستقل مع وسوم (# أو ##).

3. نقاط الفراغات وتعبئة البيانات (Dotted Lines):
- حافظ تماماً على نقاط الفراغات كما هي في الورقة الأصلية (مثال: "أولاً: السيد/ .......... المقيم: .......... ويحمل بطاقة رقم قومي: .......... (طرف أول زوج)").
- اجعل عدد النقاط معتدلاً (حوالي 10 إلى 15 نقطة لكل فراغ) لكي يبقى السطر وتوصيف الطرف (مثل: "(طرف أول زوج)" أو "(شاهد أول)") في نفس السطر ولا ينكسر إلى سطر جديد مشوه.

4. بنود وشروط العقد:
- ميز كل بند بسطر مستقل هكذا:
### البند الأول
(ثم نص البند في سطر جديد).

5. الجداول والقوائم:
- الجداول وقوائم الأسعار والمصروفات اجعلها في جدول Markdown نظيف ومترابط (| عمود 1 | عمود 2 |).

6. خط اليد والمطبوع:
- اقرأ أي نصوص مكتوبة بخط اليد وادمجها في مكانها الصحيح.

7. أخرج المحتوى الصافي فوراً بدون أي مقدمات أو اعتذارات أو شروحات.
`;

      let extractedText = "";
      const modelsToTry = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-2.5-pro",
        "gemini-1.5-flash",
      ];
      let lastError: unknown = null;

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
          extractedText = response.text ? response.text.trim() : "";
          if (extractedText) break;
        } catch (e) {
          lastError = e;
          // brief pause before fallback
          await new Promise((r) => setTimeout(r, 800));
        }
      }

      if (!extractedText) {
        throw lastError || new Error("لم يتمكن الذكاء الاصطناعي من قراءة أي نص في هذه الصورة.");
      }

      return NextResponse.json({
        success: true,
        extractedText,
        stage: "extracted",
      });
    }

    // Action 2: Contextual grammar & Arabic text refinement
    if (action === "refine") {
      if (!textToRefine || !textToRefine.trim()) {
        return NextResponse.json({ error: "لا يوجد نص للتدقيق." }, { status: 400 });
      }

      const refinePrompt = `
أنت مدقق لغوي وقانوني محترف للمستندات والعقود المصرية والعربية.
أمامك نص مستخرج من وثيقة أو عقد أو استمارة بواسطة ماسح ضوئي (OCR).

المطلوب:
1. صحح أي أخطاء إملائية طفيفة ناتجة عن الماسح الضوئي (مثل تشابه الحروف: الراء والدال، الهاء والتاء المربوطة).
2. حافظ تماماً وبشكل صارم على:
   - نقاط الفراغات (.................) بدون أي حذف أو تقصير.
   - ترويسة مربعات الصور (| صورة الزوجة | ... | صورة الزوج |).
   - الجداول والبنود وعناوينها (### البند الأول).
3. لا تقم بإضافة وسوم HTML مثل center أو font أو div إطلاقاً.
4. أرجع النص المصحح فقط بدون أي شروحات أو مقدمات.

النص:
"""
${textToRefine}
"""
`;

      let refinedText = textToRefine;
      for (const model of ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [{ role: "user", parts: [{ text: refinePrompt }] }],
          });
          if (response.text && response.text.trim()) {
            refinedText = response.text.trim();
            break;
          }
        } catch {}
      }

      return NextResponse.json({
        success: true,
        refinedText,
        stage: "refined",
      });
    }

    return NextResponse.json({ error: "إجراء غير معروف." }, { status: 400 });
  } catch (err: unknown) {
    console.error("OCR Route Error:", err);
    const message = err instanceof Error ? err.message : "حدث خطأ غير متوقع أثناء معالجة المستند.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
