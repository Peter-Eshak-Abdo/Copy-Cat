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
أنت خبير فائق الاحترافية في تحويل وتنسيق مستندات الـ PDF والأوراق بجميع اللغات (عربية، إنجليزية، فرنسية، وغيرها) إلى مستندات Word منسقة بدقة واحترافية متناهية (Universal High-Fidelity Document to Word Specialist).

المهمة الأساسية:
حلل هذا المستند واقرأ كل النصوص والبيانات واستخرجها مع الحفاظ التام والدقيق على الهيكل والتنسيق الأصلي للمستند بنسبة 100%:

1. بيانات الوثيقة والخط واللغة (في أول سطرين تماماً):
- اكتشف لغة المستند الأساسية (مثل ar أو en أو fr).
- اكتشف نوع الخط الأكثر ملائمة لنص المستند (مثل: Arial, Calibri, Times New Roman, Traditional Arabic, Amiri, Tahoma).
واكتبهما في أول سطرين هكذا:
[FONT: اسم_الخط]
[LANG: ar أو en أو fr]

2. العناوين والتنسيق:
- حافظ على العناوين الرئيسية والفرعية (# للرئيسي، ## للفرعي، ### للأقسام).
- إذا كان هناك عنوان أو نص تحته خط في الأصل، ضعه بين وسمي <u>النص</u>.
- حافظ على تمييز الكلمات والعبارات العريضة باستخدام **الكلمة**.

3. أسئلة الامتحانات والخيارات المتعددة (Multiple Choice / QCM):
- في أسئلة الاختيار من متعدد والخيارات الأفقية (مثل: * Option 1     * Option 2     * Option 3)، اكتب الخيارات واضحة مع مسافات نظيفة، ولا تضع وسوم &nbsp; إطلاقاً، ولا تضع باك سلاش قبل النجمة (اكتب * وليس \\*).

4. الجداول والبيانات المنظمة:
- إذا كان المستند يحتوي على أي جدول أو أعمدة مجدولة، أخرجه كجدول Markdown حقيقي كامل ومنظم (| عمود 1 | عمود 2 |).

5. فواصل الصفحات:
- إذا كان المستند يحتوي على أكثر من صفحة، ضع علامة الفاصل:
---
بين كل صفحة وأخرى.

6. المحظورات والتنبيهات الحاسمة:
- ممنوع منعاً باتاً كتابة كيانات HTML مثل &nbsp; أو &amp; أو &lt;.
- ممنوع الهروب بعلامة الباك سلاش (لا تكتب \\* ولا \\_ ولا \\#، بل اكتب الرمز مباشرة).
- أخرج المحتوى الصافي مباشرة بعد سطري [FONT] و [LANG] بدون أي مقدمات أو تحيات أو شروحات.
`;

    let formattedText = "";
    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

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

    // Extract detected font & language
    let detectedFont = "Arial";
    let detectedLang = "auto";

    const fontMatch = formattedText.match(/\[FONT:\s*([^\]]+)\]/i);
    if (fontMatch) {
      detectedFont = fontMatch[1].trim();
      formattedText = formattedText.replace(/\[FONT:\s*[^\]]+\]/i, "").trim();
    }

    const langMatch = formattedText.match(/\[LANG:\s*([^\]]+)\]/i);
    if (langMatch) {
      detectedLang = langMatch[1].trim().toLowerCase();
      formattedText = formattedText.replace(/\[LANG:\s*[^\]]+\]/i, "").trim();
    }

    // Clean any remaining markdown escape artifacts or &nbsp;
    formattedText = formattedText
      .replace(/&nbsp;/gi, " ")
      .replace(/\\([*_#[\]()-])/g, "$1")
      .trim();

    return NextResponse.json({
      success: true,
      text: formattedText,
      formattedText,
      detectedFont,
      detectedLang,
      fileName,
    });
  } catch (err: unknown) {
    console.error("PDF to Word Route Error:", err);
    const message = err instanceof Error ? err.message : "حدث خطأ أثناء تحويل مستند PDF إلى وورد.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
