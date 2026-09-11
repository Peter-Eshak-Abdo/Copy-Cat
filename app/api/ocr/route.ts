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
أنت خبير فائق الدقة في استخراج النصوص والتعرف الضوئي على خط اليد العربي (Arabic Handwritten & Printed OCR Specialist).
المهمة:
اقرأ هذه الوثيقة بعناية واستخرج كل النصوص المكتوبة فيها بدقة تامة وبنسبة 100%، سواء كانت:
- نصوصاً مطبوعة رسمية
- بيانات وملاحظات مكتوبة بخط اليد (مثل: عقود الإيجار، عقود الزواج، وصولات الأمانة، التواريخ، الأسماء، والأرقام)
- بنود تعاقدية وشروط وتوقيعات

القواعد الصارمة:
1. استخرج النص كلمة بكلمة كما هو مكتوب، مع التدقيق في قراءة خط اليد والحروف والنقاط.
2. إذا كان المستند عقداً به فراغات تم ملؤها بخط اليد، ادمج النصوص المطبوعة مع المكتوبة بخط اليد بسلاسة وفي أماكنها الصحيحة تماماً.
3. حافظ على ترتيب البنود (البند الأول، الثاني...)، والجداول، والأرقام بدقة.
4. لا تضف أي تعليقات أو مقدمات أو تنويهات من عندك، أخرج فقط النص المستخرج الصافي كاملاً.
`;

      let extractedText = "";
      const modelsToTry = [
        "gemini-3.5-flash",
        "gemini-3.6-flash",
        "gemini-2.5-flash",
        "gemini-flash-latest",
        "gemini-2.5-flash-lite",
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
          await new Promise((r) => setTimeout(r, 1200));
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
أنت مدقق لغوي عربي ومصحح صياغة أكاديمي محترف في مكتبة ومطبعة لطباعة الأوراق والأبحاث.
أمامك نص عربي تم استخراجه بواسطة ماسح ضوئي (OCR) من ورقة مكتوبة، وقد يحتوي على بعض الأخطاء الإملائية الناتجة عن تشابه الحروف (مثل: الراء والدال، الهاء والتاء المربوطة، النون والباء، أو الهمزات).

المطلوب:
1. راجع الكلمات التي تبدو مشوهة أو غير مفهومة وصححها وفقاً لسياق الجملة العربي الطبيعي.
2. نسق الفقرات وافصل العناوين بسطر مستقل.
3. اضبط علامات الترقيم (النقطة، الفاصلة، النقطتان) بطريقة تناسب مستند وورد A4 رسمي.
4. حافظ تماماً على روح ومعنى كلام الكاتب الأصلي دون حذف أي معلومة أو إضافة أفكار شخصية.
5. أرجع النص المصحح والمنسق فقط بدون أي مقدمات أو شروحات.

النص المراد تدقيقه:
"""
${textToRefine}
"""
`;

      let refinedText = textToRefine;
      for (const model of ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-2.5-flash"]) {
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
