import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, imageBase64, mimeType = "image/jpeg", textToRefine } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير مهيأ في الخادم." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Action 1: Extract text from image (Vision OCR)
    if (action === "extract") {
      if (!imageBase64) {
        return NextResponse.json({ error: "لم يتم إرسال بيانات الصورة." }, { status: 400 });
      }

      // Clean base64 header if present
      const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, "");

      const prompt = `
أنت خبير محترف في استخراج النصوص والتعرف الضوئي على الحروف (Arabic OCR Expert).
المهمة:
اقرأ هذه الصورة بعناية فائقة واستخرج كل النصوص المكتوبة فيها بدقة تامة (سواء كانت مطبوعة أو مكتوبة بخط اليد).
الشروط:
1. استخرج النص كلمة بكلمة كما هو مكتوب باللغة العربية أو الإنجليزية.
2. حافظ على تسلسل السطور والفقرات كما هي في الورقة الأصلية.
3. لا تضف أي تعليقات أو مقدمات من عندك، أخرج فقط النص المستخرج الصافي.
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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

      const extractedText = response.text ? response.text.trim() : "";
      if (!extractedText) {
        throw new Error("لم يتمكن الذكاء الاصطناعي من قراءة أي نص في هذه الصورة.");
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

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: refinePrompt }] }],
      });

      const refinedText = response.text ? response.text.trim() : textToRefine;

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
