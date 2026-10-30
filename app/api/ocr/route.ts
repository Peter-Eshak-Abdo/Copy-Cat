import { NextRequest, NextResponse } from "next/server";
import { transcribeImage } from "@/lib/vision-text";

export const maxDuration = 300;

/**
 * Markup the transcription uses; lib/docx/ocr-docx.ts turns it back into a Word layout. Shared by the
 * extract and verify prompts so both speak exactly the same format.
 */
const MARKUP_RULES = `
قواعد الصيغة (إلزامية):
- كل سطر مطبوع في الأصل = سطر مستقل بنفس الترتيب من أعلى الصفحة لأسفلها.
- <center> و </center> فقط للسطر الموسَّط فعلاً في منتصف الصفحة. السطر الملاصق لبداية السطر (يمين الصفحة في العربي) لا يوضع في center حتى لو كان قصيراً.
- العناوين حسب الشكل المطبوع فقط وليس حسب المعنى: # لأول سطر مميز أعلى الصفحة (مثل بسم الله الرحمن الرحيم)، ## للعنوان الرئيسي للمستند، ### لسطر عنوان قصير مستقل أكبر أو أعرض من النص (مثل: البند الأول). وفي آخر سطر العنوان اكتب نسبة ارتفاع حروفه إلى حروف النص العادي بين أقواس معقوفة، مثل: ## <u>عقد زواج عرفي</u> {1.9} أو ### <u>البند الأول</u> {1.3} (ضع <u> فقط إذا كان العنوان تحته خط في الأصل)
- سطر سؤال أو بند يكمل كلامه في نفس السطر (مثل: السؤال الأول: اختر الإجابة الصحيحة...) هو نص عادي وليس عنواناً؛ إذا كان عريضاً ضعه بين ** ** فقط.
- النص العريض بين ** ** ، والنص الذي تحته خط بين <u> </u>.
- عناصر موزعة على نفس السطر بمسافات (يمين ويسار الترويسة، اختيارات (أ) (ب) (ج) (د)، أعمدة نص، وصف في آخر السطر مثل (طرف أول زوج)): افصل بينها بالرمز " || " بترتيب القراءة. مثال:
  (أ) ١ || (ب) ٢ || (ج) ٣ || (د) صفر
- فراغات النقاط تُكتب نقاطاً بعدد يتناسب مع طول الفراغ (نصف سطر ≈ 30 نقطة، ربع سطر ≈ 15، فراغ قصير ≈ 8).
- الجداول بصيغة Markdown (| خلية | خلية |) مع سطر الفصل |---| بعد الصف الأول، وكل خلية فارغة تبقى فارغة، وعدد الأعمدة ثابت في كل الصفوف.
- الرياضيات: أي تعبير فيه كسر أو أس أو جذر أو رمز رياضي خاص يُكتب بصيغة LaTeX بين علامتي $ $، مع الإبقاء على الحروف والأرقام كما هي مطبوعة تماماً (أرقام عربية ٣ أو إنجليزية 3، وحروف مثل س ص). أمثلة:
  $\\frac{٣}{٤}$ ، العدد الكسري $٢\\frac{١}{٣}$ ، $س^{٢}$ ، $\\sqrt{٤٩}$ ، $\\sqrt[٣]{٨}$ ، $\\times$ $\\div$ $\\pm$ $\\le$ $\\ge$ $\\ne$ $\\perp$ $\\parallel$ $\\cong$ $\\angle$ $٦٠^{\\circ}$ $\\pi$
  أما الأرقام والعمليات البسيطة بدون كسر أو أس أو جذر فتُكتب نصاً عادياً بدون $.
- الأشكال الهندسية والرسوم البيانية والصور والشعارات والأختام والتوقيعات المرسومة: سطر مستقل في مكانها بالصيغة [FIGURE: ymin, xmin, ymax, xmax] حيث الإحداثيات من 0 إلى 1000 بالنسبة للصورة كاملة، والمربع يشمل الشكل كاملاً بكل الحروف والأرقام المكتوبة عليه. لا تكتب النصوص الموجودة داخل الشكل نفسه.
- مربعات الصور الشخصية أعلى العقود (صورة الزوج / صورة الزوجة) تُكتب كجدول ترويسة: | صورة الزوج | # بسم الله الرحمن الرحيم<br>## <u>عقد زواج عرفي</u> | صورة الزوجة |
- رقم الصفحة أسفل الورقة مثل (١) يُكتب في سطر مستقل في النهاية.
- ممنوع: كيانات HTML مثل &nbsp; ، الباك سلاش قبل * أو # ، علامات \`\`\` ، أي شرح أو تعليق أو مقدمة.
`;

const EXTRACT_PROMPT = `
أنت متخصص في نسخ المستندات الضوئي بدقة حرفية كاملة (عربي / English / Français): عقود، أحكام، استمارات، أوراق امتحانات بها كسور ومعادلات وأشكال وجداول، ومستندات نصية طويلة.

المطلوب: انسخ كل محتوى الصفحة حرفاً بحرف بحيث يمكن إعادة طباعتها في Word مطابقة للأصل.

الدقة أولاً:
- انسخ كل كلمة ورقم وعلامة ترقيم كما هي تماماً. لا تصحح ولا تكمل ولا تختصر ولا تترجم ولا تعيد الصياغة، حتى لو كان في الأصل خطأ إملائي.
- لا تحذف أي سطر، ولا تضف أي نص غير موجود (لا عناوين ولا "نموذج إجابة" ولا حلول).
- حافظ على شكل الأرقام كما طُبعت (٠١٢٣ أو 0123) وعلى ترتيب الأسئلة والاختيارات.
- إذا كانت كلمة غير مقروءة فعلاً اكتب مكانها [؟].

أول أربعة أسطر من إجابتك بيانات الصفحة:
[FONT: اسم_الخط]   ← الأقرب للأصل: Simplified Arabic أو Traditional Arabic أو Arial أو Times New Roman أو Calibri أو Amiri أو Tahoma
[LANG: ar أو en أو fr]
[BORDER: none أو single أو double أو decorative]   ← decorative لإطار مزخرف/نباتي حول الورقة، single أو double لإطار خطي
[WEIGHT: bold أو normal]   ← bold فقط إذا كان نص الفقرات العادية نفسه عريضاً
${MARKUP_RULES}
بعد الأسطر الأربعة اكتب المحتوى مباشرة.
`;

const verifyPrompt = (draft: string) => `
أنت مراجع دقة لنسخة ضوئية. أمامك صورة الصفحة الأصلية، وتحتها نسخة نصية مستخرجة منها.

قارن النسخة بالصورة سطراً بسطر وحرفاً بحرف، وصحح كل ما يختلف عن الأصل:
- الكلمات أو الحروف أو الأرقام المقروءة خطأ، وعلامات الترقيم.
- أي سطر أو كلمة أو خلية جدول ناقصة، وأي نص مضاف غير موجود في الصورة (احذفه).
- ترتيب الأسطر والاختيارات وأعمدة الجداول.
- الكسور والأسس والجذور والرموز الرياضية (تأكد من البسط والمقام والأس).
- مربعات [FIGURE: ...] يجب أن تحيط بالأشكال بالكامل.
لا تغير أي شيء صحيح، ولا تصحح أخطاء موجودة فعلاً في الأصل المطبوع.
ممنوع منعاً باتاً حل الأسئلة أو ملء الفراغات أو خانات الجداول الفارغة أو إضافة أي إجابة: الفراغ المنقط يبقى نقاطاً كما هو.
${MARKUP_RULES}
أخرج النسخة الكاملة المصححة فقط بنفس الصيغة (بدون أسطر [FONT] و [LANG] و [BORDER] و [WEIGHT])، بدون أي تعليق. وإذا كانت النسخة مطابقة تماماً أخرجها كما هي.

النسخة المستخرجة:
"""
${draft}
"""
`;

function cleanTranscript(text: string): string {
  return text
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```\s*$/, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\\([*_#[\]-])/g, "$1")
    .trim();
}

function takeMeta(text: string, key: string): [string | null, string] {
  const re = new RegExp(`\\[${key}:\\s*([^\\]]+)\\]`, "i");
  const m = text.match(re);
  return m ? [m[1].trim(), text.replace(re, "").trim()] : [null, text];
}

export async function POST(req: NextRequest) {
  try {
    const { action, imageBase64, draft, provider } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ error: "لم يتم إرسال بيانات الصورة." }, { status: 400 });
    }

    if (action === "extract") {
      const result = await transcribeImage(EXTRACT_PROMPT, imageBase64);
      if (!result) {
        // Every server model failed: the page falls back to in-browser Tesseract
        return NextResponse.json({ error: "تعذر الوصول لأي موديل ذكاء اصطناعي.", allProvidersFailed: true }, { status: 503 });
      }

      const meta: Record<string, string | null> = {};
      let text = cleanTranscript(result.text);
      for (const key of ["FONT", "LANG", "BORDER", "WEIGHT"]) [meta[key], text] = takeMeta(text, key);
      const { FONT: font, LANG: lang, BORDER: border, WEIGHT: weight } = meta;

      return NextResponse.json({
        success: true,
        extractedText: text,
        detectedFont: font || "Arial",
        detectedLang: (lang || "ar").toLowerCase(),
        detectedBorder: (border || "none").toLowerCase(),
        detectedWeight: (weight || "normal").toLowerCase(),
        provider: result.provider,
        lowAccuracy: result.lowAccuracy,
      });
    }

    // Second pass: the draft is checked against the page image itself (a text-only proofread cannot see
    // what was actually printed and tends to "fix" correct text)
    if (action === "verify") {
      if (!draft || !String(draft).trim()) {
        return NextResponse.json({ error: "لا يوجد نص للمراجعة." }, { status: 400 });
      }
      // Only the model that made the draft may revise it (see transcribeImage); unavailable = keep the draft
      const result = typeof provider === "string" ? await transcribeImage(verifyPrompt(String(draft)), imageBase64, provider) : null;
      if (!result || result.lowAccuracy) {
        return NextResponse.json({ success: true, verifiedText: draft, verified: false });
      }
      let text = cleanTranscript(result.text);
      for (const key of ["FONT", "LANG", "BORDER", "WEIGHT"]) text = takeMeta(text, key)[1];
      // Guard against a truncated answer replacing a full page
      const verified = text.length > String(draft).length * 0.6;
      return NextResponse.json({ success: true, verifiedText: verified ? text : draft, verified, provider: result.provider });
    }

    return NextResponse.json({ error: "إجراء غير معروف." }, { status: 400 });
  } catch (err: unknown) {
    console.error("OCR Route Error:", err);
    const message = err instanceof Error ? err.message : "حدث خطأ غير متوقع أثناء معالجة المستند.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
