import { NextRequest } from "next/server";
import { getGeminiApiKey, VISION_MODELS } from "@/lib/gemini";
import { composeVersion, fetchArticle, fetchImages, searchArticles, wikiLang, type WikiArticle, type WikiImage } from "@/lib/research/wikipedia";
import { countWords, RESEARCH_FONTS, WORDS_PER_PAGE, type ResearchDoc, type ResearchSection } from "@/lib/research/types";

export const maxDuration = 300;

/**
 * Research papers built from real Wikipedia articles (lib/research/wikipedia.ts), one different mix per
 * version. Only the short conclusion is written by a model (a plain student-style summary); a topic with
 * no usable Wikipedia text falls back to a model-written body. The answer is a stream of JSON lines so the
 * page shows what is actually happening: {type:"stage"}, then {type:"done", versions} or {type:"error"}.
 */

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_REQUESTS_PER_MINUTE = 10;

async function geminiText(prompt: string, maxOutputTokens: number, json = false): Promise<string | null> {
  const key = getGeminiApiKey();
  if (!key) return null;
  for (const model of VISION_MODELS) {
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens,
            thinkingConfig: { thinkingBudget: 0 },
            ...(json ? { responseMimeType: "application/json" } : {}),
          },
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!resp.ok) continue;
      const body = await resp.json();
      const text: string = (body.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || "").join("").trim();
      if (text) return text;
    } catch {}
  }
  return null;
}

/** Short conclusion in plain school Arabic, from the paper's own headings; a template when no model answers */
async function writeConclusion(doc: Omit<ResearchDoc, "conclusion">, details: string): Promise<string[]> {
  const heads = doc.sections.map((s) => s.title).join("، ");
  const isAr = /[؀-ۿ]/.test(doc.topic);
  const prompt = isAr
    ? `اكتب خاتمة قصيرة لبحث مدرسي عن «${doc.topic}» تناول النقاط التالية: ${heads}.
فقرتان فقط (حوالي 120 كلمة إجمالاً)، بلغة عربية فصحى بسيطة مثل كتابة طالب مجتهد، بدون مبالغة ولا عبارات رنانة ولا تعداد نقطي ولا عناوين.
${details ? `ملاحظات المدرس: ${details}\n` : ""}اكتب نص الخاتمة فقط.`
    : `Write a short conclusion (two paragraphs, about 120 words) for a school research paper on "${doc.topic}" that covered: ${heads}. Plain student style, no bullet points, no headings. Output the text only.`;
  const text = await geminiText(prompt, 600);
  const paras = (text || "")
    .split(/\n+/)
    .map((p) => p.replace(/^[#*\s]+/, "").trim())
    .filter((p) => p.length > 30);
  if (paras.length > 0) return paras.slice(0, 3);
  return isAr
    ? [
        `وفي ختام هذا البحث عن ${doc.topic}، تعرفنا على ${doc.sections.slice(0, 4).map((s) => s.title).join(" و")}، ورأينا أهمية هذا الموضوع في حياتنا.`,
        "ونرجو أن نكون قد وُفقنا في عرض أهم جوانب الموضوع بصورة واضحة ومفيدة، والله ولي التوفيق.",
      ]
    : [`In conclusion, this paper on ${doc.topic} covered ${doc.sections.slice(0, 4).map((s) => s.title).join(", ")}.`];
}

/** Topic with no usable Wikipedia text: the model writes the body (still one paper per version) */
async function aiVersion(topic: string, versionNumber: number, pages: number, details: string): Promise<Omit<ResearchDoc, "conclusion"> | null> {
  const words = pages * WORDS_PER_PAGE;
  const prompt = `اكتب محتوى بحث مدرسي عن «${topic}» باللغة العربية الفصحى البسيطة، بأسلوب الموسوعات (مثل ويكيبيديا): معلومات وحقائق مباشرة بدون مبالغة ولا عبارات إنشائية.
الطول: حوالي ${words} كلمة في متن البحث، موزعة على ${Math.max(4, Math.round(pages / 1.5))} عناوين.
هذه النسخة رقم ${versionNumber}: اختر نقاطاً وترتيباً مختلفاً عن أي نسخة أخرى.
${details ? `ملاحظات المدرس: ${details}\n` : ""}
أخرج JSON فقط بالشكل: {"intro": ["فقرة", "فقرة"], "sections": [{"title": "عنوان", "paragraphs": ["فقرة", "فقرة"]}]}`;
  const text = await geminiText(prompt, 16000, true);
  if (!text) return null;
  try {
    const data = JSON.parse(text.replace(/```json|```/g, "")) as { intro?: string[]; sections?: Array<{ title: string; paragraphs: string[] }> };
    const sections: ResearchSection[] = (data.sections || [])
      .filter((s) => s?.title && Array.isArray(s.paragraphs))
      .map((s) => ({ title: String(s.title), paragraphs: s.paragraphs.map(String), subsections: [], images: [] }));
    if (sections.length === 0) return null;
    return {
      versionNumber,
      topic,
      intro: (data.intro || []).map(String),
      sections,
      references: [],
      font: RESEARCH_FONTS[(versionNumber - 1) % RESEARCH_FONTS.length],
      source: "ai",
      bodyWords: sections.reduce((n, s) => n + countWords(s.paragraphs), 0),
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const now = Date.now();
  const limit = rateLimitMap.get(ip);
  if (limit && now < limit.resetTime) {
    if (limit.count >= MAX_REQUESTS_PER_MINUTE) {
      return Response.json({ error: "طلبات كتير ورا بعض. استنى دقيقة وجرب تاني." }, { status: 429 });
    }
    limit.count += 1;
  } else {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60_000 });
  }

  const body = await req.json().catch(() => ({}));
  const topic = String(body.topic || "").trim().slice(0, 200);
  if (!topic) return Response.json({ error: "اكتب عنوان البحث" }, { status: 400 });
  const pages = Math.max(1, Math.min(60, Number(body.targetPages) || 5));
  const count = Math.max(1, Math.min(15, Number(body.versionsCount) || 1));
  const withImages = !!body.withImages;
  const details = String(body.customDetails || "").trim().slice(0, 600);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      const stage = (text: string, progress: number) => send({ type: "stage", text, progress });
      try {
        const lang = wikiLang(topic);
        stage(lang === "ar" ? "بندوّر على الموضوع في ويكيبيديا العربية" : "بندوّر على الموضوع في ويكيبيديا", 5);
        let titles = await searchArticles(topic, lang, 10);
        // A long title rarely matches whole; its first words usually do
        if (titles.length === 0 && topic.split(/\s+/).length > 3) {
          titles = await searchArticles(topic.split(/\s+/).slice(0, 3).join(" "), lang, 10);
        }

        // Enough articles for the requested length: each one gives roughly 1-4 pages of usable text
        const needed = Math.min(8, Math.max(3, Math.ceil(pages / 3) + 1));
        const articles: WikiArticle[] = [];
        for (let i = 0; i < titles.length && articles.length < needed; i += 4) {
          const batch = await Promise.all(titles.slice(i, i + 4).map((t) => fetchArticle(t, lang)));
          for (const a of batch) if (a && articles.length < needed) articles.push(a);
          stage(`لقينا ${articles.length} مقالة عن الموضوع، بنقرا محتواها`, 15 + articles.length * 4);
        }
        const totalWords = articles.reduce((n, a) => n + a.words, 0);
        const enough = articles.length > 0 && totalWords >= pages * WORDS_PER_PAGE * 0.7;

        let images: WikiImage[] = [];
        if (enough && withImages) {
          stage("بنجيب صور حقيقية من المقالات (ويكيميديا كومنز)", 45);
          images = (await Promise.all(articles.map((a) => fetchImages(a.title, lang)))).flat();
        }

        const versions: ResearchDoc[] = [];
        for (let v = 1; v <= count; v++) {
          const base = 50 + Math.round(((v - 1) / count) * 45);
          let doc: Omit<ResearchDoc, "conclusion"> | null = null;
          if (enough) {
            stage(count > 1 ? `بنرتب النسخة ${v} من ${count} من المقالات` : "بنرتب البحث من المقالات", base);
            doc = composeVersion(topic, articles, images, v, pages, withImages);
          } else {
            stage(
              count > 1
                ? `ويكيبيديا مفيهاش كلام كفاية عن الموضوع، بنكتب النسخة ${v} من ${count} بالذكاء الاصطناعي`
                : "ويكيبيديا مفيهاش كلام كفاية عن الموضوع، بنكتبه بالذكاء الاصطناعي",
              base
            );
            doc = await aiVersion(topic, v, pages, details);
          }
          if (!doc) throw new Error("مقدرناش نلاقي ولا نكتب محتوى للموضوع ده. جرب عنوان أوضح أو أقصر.");
          stage(count > 1 ? `بنكتب خاتمة النسخة ${v}` : "بنكتب الخاتمة", base + Math.round(20 / count));
          versions.push({ ...doc, conclusion: await writeConclusion(doc, details) });
        }

        stage("خلصنا", 100);
        send({ type: "done", topic, targetPages: pages, versions });
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : "حصلت مشكلة وإحنا بنجهز البحث" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}
