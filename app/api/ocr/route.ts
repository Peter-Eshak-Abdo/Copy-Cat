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
أنت خبير فائق الدقة في التعرف الضوئي واستخراج النصوص وتنسيق الوثائق الرسمية والأحكام القضائية والمستندات القانونية والأكاديمية بجميع اللغات (Arabic, English, French Document OCR Specialist).

المهمة:
اقرأ هذه الوثيقة بعناية فائقة واستخرج كل النصوص والمحتويات مع الحفاظ التام والدقيق على الهيكل البصري الأصلي للورقة بنسبة 100%:

1. بيانات الوثيقة والخط واللغة (في أول سطرين تماماً):
- اكتشف نوع الخط المستخدم في الوثيقة أو الأقرب إليه (مثل: Arial, Traditional Arabic, Times New Roman, Calibri, Amiri, Cairo, Tahoma) أو كـ fallback استخدم Arial.
- اكتشف لغة المستند الأساسية (ar أو en أو fr).
واكتبهما في أول سطرين هكذا:
[FONT: اسم_الخط]
[LANG: ar أو en أو fr]

2. ترويسة الوثائق والعقود والأحكام القضائية:
- الأحكام القضائية والمذكرات والشهادات: اكتب الترويسة والعنوان الرئيسي (# للرئيسي، ## للفرعي) في المنتصف أو مكانه الأصلي.
- إذا كانت وثيقة تحتوي على مربعات صور في الأعلى (مثل عقود الزواج: صورة الزوج على اليمين وصورة الزوجة على اليسار)، صغها كجدول ترويسة:
| صورة الزوج | # بسم الله الرحمن الرحيم<br>## عنوان العقد | صورة الزوجة |

3. نصوص الوثيقة والفقرات:
- حافظ على النصوص كاملة دون أي حذف.
- إذا كان هناك نص تحته خط في الأصل، ضعه بين وسمي <u>النص</u>.
- ميز النصوص العريضة بـ **الكلمة**.
- في نقاط الفراغات (مثل: السيد/ .......... المقيم: ..........)، اجعل عدد النقاط معتدلاً (حوالي 10 نقاط) حتى لا ينكسر السطر.

4. الجداول والقوائم:
- الجداول وقوائم البيانات ومحاضر الجلسات صغها في جدول Markdown نظيف ومترابط (| عمود 1 | عمود 2 |).

5. القواعد الصارمة:
- ممنوع كتابة أي كيانات HTML مثل &nbsp; أو &amp;.
- ممنوع الهروب بالباك سلاش (لا تكتب \\* بل اكتب * مباشرة).
- أخرج المحتوى الصافي فوراً بعد سطري [FONT] و [LANG] بدون أي مقدمات أو شروحات.
`;

      let extractedText = "";
      const modelsToTry = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
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
          await new Promise((r) => setTimeout(r, 800));
        }
      }

      if (!extractedText) {
        throw lastError || new Error("لم يتمكن الذكاء الاصطناعي من قراءة أي نص في هذه الصورة.");
      }

      // Extract detected font & language
      let detectedFont = "Arial";
      let detectedLang = "ar";

      const fontMatch = extractedText.match(/\[FONT:\s*([^\]]+)\]/i);
      if (fontMatch) {
        detectedFont = fontMatch[1].trim();
        extractedText = extractedText.replace(/\[FONT:\s*[^\]]+\]/i, "").trim();
      }

      const langMatch = extractedText.match(/\[LANG:\s*([^\]]+)\]/i);
      if (langMatch) {
        detectedLang = langMatch[1].trim().toLowerCase();
        extractedText = extractedText.replace(/\[LANG:\s*[^\]]+\]/i, "").trim();
      }

      // Clean HTML entities or backslashes
      extractedText = extractedText
        .replace(/&nbsp;/gi, " ")
        .replace(/\\([*_#[\]()-])/g, "$1")
        .trim();

      return NextResponse.json({
        success: true,
        extractedText,
        detectedFont,
        detectedLang,
        stage: "extracted",
      });
    }

    // Action 2: Contextual grammar & Arabic text refinement
    if (action === "refine") {
      if (!textToRefine || !textToRefine.trim()) {
        return NextResponse.json({ error: "لا يوجد نص للتدقيق." }, { status: 400 });
      }

      const refinePrompt = `
أنت مدقق لغوي وقانوني وأكاديمي محترف.
أمامك نص مستخرج من وثيقة أو حكم قضائي أو استمارة أو عقد بواسطة ماسح ضوئي (OCR).

المطلوب:
1. صحح أي أخطاء إملائية أو لغوية طفيفة ناتجة عن الماسح الضوئي.
2. حافظ تماماً وبشكل صارم على:
   - نقاط الفراغات (...........) بدون حذف.
   - الجداول والبنود وعناوينها (### البند الأول أو /1 أو /2).
   - وسوم التسطير <u> والنصوص العريضة **.
3. لا تضع وسوم HTML غريبة مثل div أو span أو center.
4. لا تضع كيانات &nbsp; ولا باك سلاش قبل الرموز (اكتب * وليس \\*).
5. أرجع النص المصحح فقط بدون أي شروحات أو مقدمات.

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

      refinedText = refinedText
        .replace(/&nbsp;/gi, " ")
        .replace(/\\([*_#[\]()-])/g, "$1")
        .trim();

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
