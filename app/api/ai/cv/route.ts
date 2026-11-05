import { NextRequest, NextResponse } from "next/server";
import { geminiJson } from "@/lib/gemini";
import { transcribeImage } from "@/lib/vision-text";
import { normalizeCv, type CvData, type CvLang } from "@/lib/cv";
import { bad, readJson, requireSession } from "@/lib/server/route-helpers";

export const maxDuration = 300;

/**
 * CV page (/admin/cv): the customer's details (typed text and/or photos, often handwritten Arabic) become a
 * CV in Arabic and English. The second language is written by meaning, the way an HR writer would phrase it,
 * not word for word (a literal Google Translate pass is exactly what the shop wanted to stop doing).
 *
 *   { action: "build", text?, images? }      -> { ar, en }
 *   { action: "translate", from, cv }        -> { cv }   (the staff edited one language; redo the other)
 *
 * Gemini first (it reads the photos itself); without it the photos are transcribed by the OCR chain and a
 * Groq text model writes the CV.
 */

const SCHEMA = `{
  "name": string,
  "jobTitle": string,
  "personal": [{"label": string, "value": string}],
  "objective": string,
  "education": [{"title": string, "details": [string]}],
  "experience": [string],
  "courses": [string],
  "skills": [string],
  "languages": [{"label": string, "value": string}],
  "extra": [{"heading": string, "items": [string]}]
}`;

const STYLE_RULES = `Writing rules:
- Translate by MEANING, the way a professional Egyptian HR writer would write that CV in that language, never
  word for word. Use standard CV phrasing, e.g. "العمل في انتيجو لمدة ٤ أشهر" = "Worked at Antigo for 4 months",
  "بكالوريوس تجارة" = "Bachelor of Commerce", "التقدير العام: جيد جدا" = "Overall Grade: Very Good",
  "إجادة العمل تحت ضغط" = "Ability to work under pressure", "Team player" = "القدرة على العمل ضمن فريق".
- People's names use the usual Egyptian English spelling (محمد = Mohamed, أحمد = Ahmed, عبد الرحمن = Abdelrahman,
  مصطفى = Mostafa) and the usual Arabic spelling the other way. Universities, faculties and government bodies
  use their official names (جامعة قناة السويس = Suez Canal University, كلية الآداب = Faculty of Arts). Company and
  brand names keep their brand spelling (Tuscanini, Jak Fashion).
- Keep every fact exactly as given; never invent jobs, dates, grades, courses or skills. Fix obvious spelling
  mistakes.
- objective: the usual simple sentence of Egyptian CVs, tied to the person's field: that they seek to work in it,
  gain experience and keep developing. One or two plain, natural, believable sentences; nothing grand, no
  exaggeration and no buzzwords (no "رائدة", "مرموقة", "شغوف", "passionate", "dynamic", "reputable", "leading").
  Good: "أسعى للعمل في مجال المحاسبة لاكتساب خبرة عملية وتطوير مهاراتي باستمرار." /
  "Seeking a position in accounting to gain practical experience and keep developing my skills."
  If the customer wrote an objective, keep its meaning in this same plain style; if not, write one like that.
- Arabic CV: everything in Arabic, including ALL digits in Arabic-Indic form (٠١٢٠٠٦٩٩٨٢٣، ٥ / ٣ / ٢٠٠٦، ٤ أشهر).
  Only e-mail addresses and Latin names of programs/certificates (ICDL, Excel, GIS) stay in Latin letters.
- English CV: everything in English with Western digits; capitalise like a CV.
- personal: label/value pairs, in this order when present: Date of Birth / تاريخ الميلاد, Place of Birth / محل الميلاد,
  Nationality / الجنسية, Religion / الديانة, Marital Status / الحالة الاجتماعية, Military Status / الموقف من التجنيد,
  Address / العنوان, Phone / التليفون, Email / البريد الإلكتروني. Use exactly those labels.
- education: one entry per degree or school; title = degree and institution ("Bachelor of Commerce, Suez Canal
  University"); details = department, graduation year, grade, project...
- experience: one short line per job (company, role if given, duration or years).
- courses: training courses and certificates. skills: short phrases (soft and computer skills).
- languages: label = the language, value = the level ("Arabic" / "Mother tongue", "العربية" / "اللغة الأم").
- extra: only what fits nowhere else (hobbies, references, volunteering...), each with a heading.
- jobTitle: only when the customer gave one or it is obvious from the job sought; otherwise "".
- Empty sections are [] or "".`;

const BUILD_PROMPT = `You prepare CVs at a print shop in Egypt. Below are a customer's details: typed notes and/or photos
of a paper (often handwritten Arabic, sometimes an old CV). Read everything, then write the CV in BOTH Arabic and
English. Both versions hold the same facts in the same order.

Return ONLY JSON: {"ar": CV, "en": CV} where CV is
${SCHEMA}

${STYLE_RULES}`;

const translatePrompt = (from: CvLang, cv: CvData) => {
  const to = from === "ar" ? "English" : "Arabic";
  const { headings: _h, ...content } = cv; // eslint-disable-line @typescript-eslint/no-unused-vars
  return `You prepare CVs at a print shop in Egypt. Here is a finished CV in ${from === "ar" ? "Arabic" : "English"} (JSON).
Write the same CV in ${to}: same facts, same order, same structure (one ${to} item for every item).

Return ONLY JSON: {"cv": CV} where CV is
${SCHEMA}

${STYLE_RULES}

The CV:
${JSON.stringify(content, null, 1)}`;
};

const TRANSCRIBE_PROMPT =
  "Transcribe all the text in this photo exactly as written (it is a customer's details for a CV, often " +
  "handwritten Arabic). Keep line breaks. Plain text only, no comments.";

/** OpenAI-style chat completion with a JSON answer (Groq), used when Gemini is not available */
async function groqJson(prompt: string): Promise<unknown> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  for (const model of ["openai/gpt-oss-120b", "llama-3.3-70b-versatile"]) {
    try {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          max_tokens: 8000,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!resp.ok) {
        console.warn(`CV ${model} failed with ${resp.status}`);
        continue;
      }
      const body = await resp.json();
      return JSON.parse(String(body.choices?.[0]?.message?.content ?? ""));
    } catch (err) {
      console.warn(`CV ${model} error:`, err);
    }
  }
  return null;
}

async function askModel(prompt: string, images: string[], imageText: () => Promise<string>) {
  const answer = await geminiJson(prompt, images, { thinkingBudget: 2048, maxOutputTokens: 12000 });
  if (answer) return answer;
  // No Gemini: read the photos with the OCR chain, then a text model writes the CV
  const extra = images.length ? `\n\nText read from the customer's photos:\n${await imageText()}` : "";
  return groqJson(prompt + extra);
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof NextResponse) return session;

  const body = await readJson<{
    action?: string;
    text?: unknown;
    images?: unknown;
    from?: unknown;
    cv?: unknown;
  }>(req, 25 * 1024 * 1024);
  if (!body) return bad("الطلب كبير أوي أو مش مفهوم.", 413);

  try {
    if (body.action === "translate") {
      const from: CvLang = body.from === "en" ? "en" : "ar";
      const to: CvLang = from === "ar" ? "en" : "ar";
      const cv = normalizeCv(body.cv, from);
      const answer = (await askModel(translatePrompt(from, cv), [], async () => "")) as { cv?: unknown } | null;
      if (!answer?.cv) return NextResponse.json({ success: false, error: "الترجمة مطلعتش، جرب تاني." });
      return NextResponse.json({ success: true, cv: normalizeCv(answer.cv, to) });
    }

    const text = typeof body.text === "string" ? body.text.slice(0, 20_000).trim() : "";
    const images = (Array.isArray(body.images) ? body.images : [])
      .filter((i): i is string => typeof i === "string" && i.startsWith("data:image/"))
      .slice(0, 6);
    if (!text && images.length === 0) return bad("اكتب البيانات أو ارفع صورتها.");

    const prompt = `${BUILD_PROMPT}\n\n${text ? `Typed notes from the customer:\n${text}` : "(No typed notes: everything is in the photos.)"}`;
    const imageText = async () => {
      const parts = await Promise.all(images.map((img) => transcribeImage(TRANSCRIBE_PROMPT, img).catch(() => null)));
      return parts.map((p) => p?.text ?? "").join("\n\n");
    };
    const answer = (await askModel(prompt, images, imageText)) as { ar?: unknown; en?: unknown } | null;
    if (!answer || (!answer.ar && !answer.en)) {
      return NextResponse.json({ success: false, error: "مقدرناش نقرا البيانات، جرب تاني أو اكتبها." });
    }
    return NextResponse.json({ success: true, ar: normalizeCv(answer.ar, "ar"), en: normalizeCv(answer.en, "en") });
  } catch (err) {
    console.error("CV route error:", err);
    return NextResponse.json({ success: false, error: "حصلت مشكلة، جرب تاني." }, { status: 500 });
  }
}
