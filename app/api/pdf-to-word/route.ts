import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, mimeType = "image/jpeg", fileName = "Document" } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: "لم يتم إرسال بيانات الصفحة للتحويل." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "مفتاح الذكاء الاصطناعي غير متوفر." }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, "");

    const prompt = `
أنت خبير تحويل وتنسيق مستندات PDF العربية إلى ملفات Word منسقة بنفس الاستايل الأصلي تماماً (Arabic PDF to Formatted Word Converter).
المهمة:
حلل هذه الصفحة من ملف الـ PDF واستخرج كل محتوياتها مع الحفاظ على الهيكل الدقيق:
1. العناوين الرئيسية (ضع قبلها #)
2. العناوين الفرعية (ضع قبلها ##)
3. الفقرات العادية (نصوص عربية منسقة مع علامات الترقيم الصحيحة)
4. الجداول أو القوائم المنقطة إن وجدت
5. حافظ تماماً على المصطلحات واللغة العربية السليمة دون تشويه في ترتيب الحروف.
أخرج النص المنسق فقط بدون أي مقدمات أو شروحات إضافية.
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

    const formattedText = response.text ? response.text.trim() : "";
    if (!formattedText) {
      throw new Error("تعذر استخراج نصوص الصفحة.");
    }

    return NextResponse.json({
      success: true,
      formattedText,
      fileName,
    });
  } catch (err: unknown) {
    console.error("PDF to Word Route Error:", err);
    const message = err instanceof Error ? err.message : "حدث خطأ أثناء تحويل مستند PDF إلى وورد.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
