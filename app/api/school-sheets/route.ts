import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, mimeType = "image/jpeg" } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: "لم يتم إرسال بيانات الصورة." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير مهيأ." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, "");

    const prompt = `
أنت مساعد لمعلمي ومطابع الكتب المدرسية.
المهمة:
اقرأ صورة صفحة كتاب المدرسة أو جدول الكلمات واستخرج جميع الكلمات العربية والمفردات ومعانيها أو مضاداتها إن وجدت في الصفحة.

المطلوب إخراج النتيجة بتنسيق JSON حصراً بهذا الشكل الصارم:
{
  "items": [
    { "word": "الكلمة الأولى", "meaning": "معناها إن وجد أو فارغ" },
    { "word": "الكلمة الثانية", "meaning": "" }
  ]
}

الشروط:
1. استخرج الكلمات بصيغتها الدقيقة بدون تشكيل معقد إلا لو كان ضرورياً.
2. لا تكرر الكلمات المتشابهة.
3. أخرج كود JSON فقط بدون أي نص تعريفي أو وسوم Markdown زائدة.
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

    const rawOutput = response.text || "";
    // Clean potential markdown blocks
    const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("لم يتمكن النظام من استخراج الكلمات بصيغة منظمة من الصورة.");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const items = Array.isArray(parsed.items) ? parsed.items : [];

    return NextResponse.json({
      success: true,
      items,
      count: items.length,
    });
  } catch (err: unknown) {
    console.error("School Sheets Route Error:", err);
    const message = err instanceof Error ? err.message : "حدث خطأ أثناء استخراج كلمات الشيت.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
