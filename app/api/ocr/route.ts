import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { VISION_MODELS } from "@/lib/gemini";

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
اقرأ هذه الوثيقة بعناية فائقة واستخرج كل النصوص والمحتويات مع الحفاظ التام والدقيق على الهيكل البصري الأصلي للورقة بنسبة 100% بحيث يمكن إعادة طباعتها في Word مطابقة للأصل:

1. بيانات الوثيقة (في أول أربعة أسطر تماماً):
[FONT: اسم_الخط]   ← الخط الأقرب للأصل (Traditional Arabic, Simplified Arabic, Arial, Times New Roman, Calibri, Amiri, Tahoma). العقود والمستندات العربية الرسمية غالباً Simplified Arabic أو Traditional Arabic.
[LANG: ar أو en أو fr]
[BORDER: none أو single أو double أو decorative]   ← decorative إذا كان للصفحة إطار مزخرف/نباتي/فني حول الورقة، single أو double لإطار خطي، none بدون إطار.
[WEIGHT: bold أو normal]   ← bold إذا كان نص الفقرات العادية نفسه مكتوباً بخط عريض (وليس العناوين فقط).

2. ترويسة الوثائق والعقود:
- السطر الأول المركزي (مثل بسم الله الرحمن الرحيم) اكتبه بعلامة # والعنوان الرئيسي (مثل عقد زواج عرفي) بعلامة ## ، وإذا كان العنوان تحته خط في الأصل ضعه داخل <u></u>.
- إذا كانت الوثيقة تحتوي على مربعات صور في الأعلى (مثل عقود الزواج: صورة الزوج على اليمين وصورة الزوجة على اليسار)، صغها كجدول ترويسة واحد بالترتيب من اليمين لليسار:
| صورة الزوج | # بسم الله الرحمن الرحيم<br>## <u>عقد زواج عرفي</u> | صورة الزوجة |

3. نصوص الوثيقة والفقرات:
- حافظ على النصوص كاملة دون أي حذف، وكل سطر في الأصل يكون سطراً مستقلاً بنفس الترتيب.
- عناوين البنود (مثل البند الأول) اكتبها بعلامة ### ، وإذا كان تحتها خط ضعها داخل <u></u>.
- إذا كان نص تحته خط في الأصل ضعه بين وسمي <u>النص</u>. ميز النصوص العريضة داخل السطر بـ **الكلمة**.
- نقاط الفراغات: اكتب عدداً من النقاط يتناسب مع طول الفراغ في الأصل (فراغ يمتد لنصف السطر تقريباً ≈ 30 نقطة، ربع سطر ≈ 15 نقطة، فراغ قصير ≈ 8 نقاط) لكي يملأ السطر كما في الأصل بدون أن ينكسر لسطرين.
- إذا كان في نهاية السطر وصف منفصل مدفوع لأقصى الطرف الآخر من السطر (مثل: (طرف أول زوج) أو (شاهد أول) أو (طرف ثاني زوجة))، افصله عن باقي السطر بالرمز " || " هكذا:
ويحمل بطاقة رقم قومي: ............................ || (طرف أول زوج)
- النقاط المرقمة مثل ١- أو 2- اكتبها كما هي بنفس الأرقام (عربية أو هندية) كما في الأصل.
- رقم الصفحة في أسفل الورقة مثل (١) اكتبه في سطر مستقل في النهاية.

4. الجداول والقوائم:
- الجداول وقوائم البيانات ومحاضر الجلسات صغها في جدول Markdown نظيف ومترابط (| عمود 1 | عمود 2 |).

5. القواعد الصارمة:
- ممنوع كتابة أي كيانات HTML مثل &nbsp; أو &amp;.
- ممنوع الهروب بالباك سلاش (لا تكتب \\* بل اكتب * مباشرة).
- أخرج المحتوى الصافي فوراً بعد أسطر [FONT] و [LANG] و [BORDER] و [WEIGHT] بدون أي مقدمات أو شروحات أو علامات \`\`\`.
`;

      let extractedText = "";
      const modelsToTry = VISION_MODELS;
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
      let detectedBorder = "none";
      let detectedWeight = "normal";

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

      const borderMatch = extractedText.match(/\[BORDER:\s*([^\]]+)\]/i);
      if (borderMatch) {
        detectedBorder = borderMatch[1].trim().toLowerCase();
        extractedText = extractedText.replace(/\[BORDER:\s*[^\]]+\]/i, "").trim();
      }

      const weightMatch = extractedText.match(/\[WEIGHT:\s*([^\]]+)\]/i);
      if (weightMatch) {
        detectedWeight = weightMatch[1].trim().toLowerCase();
        extractedText = extractedText.replace(/\[WEIGHT:\s*[^\]]+\]/i, "").trim();
      }

      // Clean HTML entities, backslashes or stray code fences
      extractedText = extractedText
        .replace(/^```[a-z]*\s*/i, "")
        .replace(/```\s*$/, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/\\([*_#[\]()-])/g, "$1")
        .trim();

      return NextResponse.json({
        success: true,
        extractedText,
        detectedFont,
        detectedLang,
        detectedBorder,
        detectedWeight,
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
   - الفاصل " || " الذي يفصل الوصف المدفوع لنهاية السطر (مثل || (طرف أول زوج)) بدون حذف أو نقل.
   - ترتيب الأسطر وتقسيمها كما هو تماماً (لا تدمج سطرين ولا تقسم سطراً).
3. لا تضع وسوم HTML غريبة مثل div أو span أو center.
4. لا تضع كيانات &nbsp; ولا باك سلاش قبل الرموز (اكتب * وليس \\*).
5. أرجع النص المصحح فقط بدون أي شروحات أو مقدمات.

النص:
"""
${textToRefine}
"""
`;

      let refinedText = textToRefine;
      for (const model of VISION_MODELS) {
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
