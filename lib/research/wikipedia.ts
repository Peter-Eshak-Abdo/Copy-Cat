/**
 * Research text taken from real Wikipedia articles instead of being written by a model: the shop's
 * customers used to copy from Wikipedia, and model-written text reads like ChatGPT. Uses the public
 * MediaWiki API (search, plain-text extracts, image info) with a descriptive User-Agent as Wikimedia asks.
 */
import {
  countWords,
  IMAGE_PAGE_SHARE,
  RESEARCH_FONTS,
  WORDS_PER_PAGE,
  type ResearchDoc,
  type ResearchImage,
  type ResearchSection,
} from "./types";

const UA = "CopyCat-Research/1.0 (https://copy-cat-kappa.vercel.app; school research tool)";

export interface WikiArticle {
  title: string;
  url: string;
  lead: string[];
  sections: Array<{ title: string; paragraphs: string[]; subsections: Array<{ title: string; paragraphs: string[] }> }>;
  words: number;
}

export interface WikiImage {
  url: string;
  caption: string;
  credit: string;
  article: string;
}

// Sections that are lists of links, notes or galleries, never body text
const SKIP_SECTIONS =
  /^(انظر أيضا|انظر أيضًا|المراجع|مراجع|مصادر|المصادر|وصلات خارجية|روابط خارجية|ملاحظات|هوامش|قراءات إضافية|قراءة إضافية|معرض صور|معرض|وصلات|See also|References|Notes|External links|Further reading|Bibliography|Sources|Gallery|Citations)$/i;

async function api(lang: string, params: Record<string, string>): Promise<Record<string, unknown> | null> {
  const qs = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  // Long articles (20,000+ words) can take a while on a slow line; one retry covers a dropped request
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(`https://${lang}.wikipedia.org/w/api.php?${qs}`, {
        headers: { "User-Agent": UA, "Api-User-Agent": UA },
        signal: AbortSignal.timeout(35_000),
      });
      if (resp.ok) return (await resp.json()) as Record<string, unknown>;
    } catch {}
  }
  return null;
}

export function wikiLang(topic: string): "ar" | "en" {
  return /[؀-ۿ]/.test(topic) ? "ar" : "en";
}

/** Article titles for a topic, most relevant first (disambiguation pages and stubs skipped later) */
export async function searchArticles(topic: string, lang: string, limit = 8): Promise<string[]> {
  const data = await api(lang, { action: "query", list: "search", srsearch: topic, srlimit: String(limit), srnamespace: "0" });
  const hits = ((data?.query as { search?: Array<{ title: string; wordcount: number }> })?.search || []).filter(
    (h) => h.wordcount > 250
  );
  return hits.map((h) => h.title);
}

function cleanParagraph(p: string): string {
  return p
    .replace(/\s*\[\d+\]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([،,.؛:!؟?])/g, "$1")
    .trim();
}

/** "== Title ==" plain-text extract -> lead + sections (level 2) with subsections (level 3+) */
function parseExtract(text: string): Pick<WikiArticle, "lead" | "sections"> {
  const lead: string[] = [];
  const sections: WikiArticle["sections"] = [];
  let skip = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const h = line.match(/^(={2,6})\s*(.+?)\s*\1$/);
    // A broken heading that swallowed its paragraph ("== Title text of the paragraph... ==") is prose
    if (h && h[2].length > 70) {
      const p = cleanParagraph(h[2]);
      const sec = sections[sections.length - 1];
      if (!skip && sec) (sec.subsections.length ? sec.subsections[sec.subsections.length - 1].paragraphs : sec.paragraphs).push(p);
      continue;
    }
    if (h) {
      const level = h[1].length;
      const title = h[2].trim();
      if (level === 2) {
        skip = SKIP_SECTIONS.test(title);
        if (!skip) sections.push({ title, paragraphs: [], subsections: [] });
      } else if (!skip && sections.length) {
        if (SKIP_SECTIONS.test(title)) continue;
        sections[sections.length - 1].subsections.push({ title, paragraphs: [] });
      }
      continue;
    }
    if (skip) continue;
    const p = cleanParagraph(line);
    // Short lines are list fragments, captions or table leftovers rather than prose
    if (p.length < 60 || !/[.。؟?!]$|[؀-ۿ]$/.test(p)) continue;
    const sec = sections[sections.length - 1];
    if (!sec) lead.push(p);
    else if (sec.subsections.length) sec.subsections[sec.subsections.length - 1].paragraphs.push(p);
    else sec.paragraphs.push(p);
  }
  for (const s of sections) s.subsections = s.subsections.filter((sub) => sub.paragraphs.length > 0);
  return { lead, sections: sections.filter((s) => s.paragraphs.length + s.subsections.length > 0) };
}

export async function fetchArticle(title: string, lang: string): Promise<WikiArticle | null> {
  const data = await api(lang, {
    action: "query",
    prop: "extracts|pageprops",
    explaintext: "1",
    exsectionformat: "wiki",
    redirects: "1",
    titles: title,
  });
  const page = (data?.query as { pages?: Array<{ title: string; extract?: string; pageprops?: Record<string, string> }> })
    ?.pages?.[0];
  if (!page?.extract || page.pageprops?.disambiguation !== undefined) return null;
  const parsed = parseExtract(page.extract);
  const words =
    countWords(parsed.lead) +
    parsed.sections.reduce((n, s) => n + countWords(s.paragraphs) + s.subsections.reduce((m, x) => m + countWords(x.paragraphs), 0), 0);
  if (words < 200) return null;
  return {
    title: page.title,
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    ...parsed,
    words,
  };
}

/** Photos (JPEG/PNG, not icons, flags or logos) used in an article, with licence for the caption */
export async function fetchImages(title: string, lang: string): Promise<WikiImage[]> {
  const data = await api(lang, {
    action: "query",
    generator: "images",
    titles: title,
    gimlimit: "40",
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
    iiextmetadatafilter: "LicenseShortName|Artist|ObjectName",
    iiurlwidth: "960",
  });
  type Info = {
    mime?: string;
    width?: number;
    height?: number;
    thumburl?: string;
    extmetadata?: Record<string, { value?: string }>;
  };
  const pages = ((data?.query as { pages?: Array<{ title: string; imageinfo?: Info[] }> })?.pages || []).filter(Boolean);
  const out: WikiImage[] = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii?.thumburl || !/image\/(jpeg|png)/.test(ii.mime || "")) continue;
    if ((ii.width || 0) < 500 || (ii.height || 0) < 300) continue;
    if (/flag|logo|icon|symbol|map|coat.of.arms|signature|علم|شعار|رمز|خريطة|portal/i.test(p.title)) continue;
    const ratio = (ii.width || 1) / (ii.height || 1);
    if (ratio > 3 || ratio < 0.33) continue;
    const strip = (s?: string) => (s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const name = strip(ii.extmetadata?.ObjectName?.value) || p.title.replace(/^[^:]+:/, "").replace(/\.[a-z]+$/i, "").replace(/_/g, " ");
    const artist = strip(ii.extmetadata?.Artist?.value).slice(0, 60);
    const licence = strip(ii.extmetadata?.LicenseShortName?.value);
    out.push({
      url: ii.thumburl,
      caption: name.slice(0, 90),
      credit: ["ويكيميديا كومنز", artist, licence].filter(Boolean).join(" - "),
      article: title,
    });
  }
  return out;
}

const STOPWORDS = new Set(["في", "من", "على", "عن", "إلى", "الى", "و", "أو", "او", "مع", "بين", "ال", "the", "of", "and", "in", "on", "for", "to", "a", "an"]);

/**
 * Word stems of the topic for a relevance check: "الطاقة الشمسية" -> ["طاق", "شمس"] (article "ال" and the
 * last letters dropped so "شمسية" also matches "الشمس" and "شمسي")
 */
function topicStems(topic: string): string[] {
  return topic
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w.toLowerCase()))
    .map((w) => w.replace(/^(وال|بال|كال|فال|لل|ال)/, ""))
    .map((w) => (/[؀-ۿ]/.test(w) ? w.slice(0, Math.max(3, Math.min(4, w.length - 1))) : w.toLowerCase().slice(0, 5)))
    .filter((w) => w.length >= 3);
}

/** Deterministic shuffle: the same topic and version always give the same paper */
function seededShuffle<T>(items: T[], seed: number): T[] {
  const a = items.slice();
  let s = seed >>> 0 || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * One version of the paper. Each version leads with a different article (its introduction) and takes the
 * sections of the articles in a different mix and order, so two students handing in the same topic get
 * different points in different words. The body is filled to `pages` printed pages; introduction,
 * conclusion, index and references are extra.
 */
export function composeVersion(
  topic: string,
  articles: WikiArticle[],
  images: WikiImage[],
  versionNumber: number,
  pages: number,
  withImages: boolean
): Omit<ResearchDoc, "conclusion"> {
  const v = versionNumber - 1;
  const seed = hash(topic) + v * 7919;
  // The most relevant article leads every version (its sections keep their own names); versions differ in
  // which points they take and in what order
  const leadArticle = articles[0];
  const others = seededShuffle(articles.slice(1), seed);
  const stems = topicStems(topic);
  // The words the most relevant article's title shares with the topic must all appear ("طاقة شمسية":
  // "طاق" and "شمس"), so a broad article's off-topic sections ("energy from waste") stay out
  const required = stems.filter((st) => leadArticle.title.includes(st));
  const onTopic = (a: WikiArticle) => required.length > 0 && required.every((st) => a.title.includes(st));

  const imageCount = withImages ? Math.max(1, Math.round(pages / 2.5)) : 0;
  const targetWords = Math.round(Math.max(1, pages - imageCount * IMAGE_PAGE_SHARE) * WORDS_PER_PAGE);

  // Introduction (not counted in the page target): the definition, then a different follow-up per version:
  // the lead's next paragraphs, or the opening of another article on the same topic
  const intro: string[] = leadArticle.lead.slice(0, 1);
  const sameTopic = others.filter(onTopic);
  const followUp =
    v % 2 === 1 && sameTopic.length > 0
      ? sameTopic[Math.floor(v / 2) % sameTopic.length].lead
      : leadArticle.lead.slice(1 + (Math.floor(v / 2) % 2));
  for (const p of followUp) {
    if (countWords(intro) > 230) break;
    intro.push(p);
  }

  // Section pool: every section of every article is one heading (at most ~4 paragraphs), so a paper covers
  // many points instead of one long article. The lead article's sections keep their own names; another
  // article's sections are titled "<article>: <section>", and its opening paragraphs "<article>".
  type Unit = { title: string; paragraphs: string[]; subsections: Array<{ title: string; paragraphs: string[] }>; from: WikiArticle };
  const cap = (paras: string[], maxWords: number) => {
    const out: string[] = [];
    let n = 0;
    for (const p of paras) {
      if (out.length >= 4 || (n > 0 && n + countWords([p]) > maxWords)) break;
      out.push(p);
      n += countWords([p]);
    }
    return out;
  };
  const mentionsTopic = (text: string) =>
    required.length > 0 ? required.every((st) => text.includes(st)) : stems.length === 0 || stems.some((st) => text.includes(st));
  const unitsOf = (a: WikiArticle, isLead: boolean): Unit[] => {
    const list: Unit[] = [];
    if (!isLead && a.lead.length && mentionsTopic(a.lead.join(" "))) list.push({ title: a.title, paragraphs: cap(a.lead, 320), subsections: [], from: a });
    for (const sec of a.sections) {
      // The paper has its own introduction and conclusion
      if (/^(مقدمة|المقدمة|تمهيد|خاتمة|الخاتمة|خلاصة|الخلاصة|Introduction|Overview|Conclusion|Summary)$/i.test(sec.title.trim())) continue;
      // A broad related article ("energy" for "solar energy") only gives the sections about the topic
      if (!isLead && !mentionsTopic([sec.title, ...sec.paragraphs, ...sec.subsections.flatMap((x) => x.paragraphs)].join(" "))) continue;
      const title = isLead ? sec.title : `${a.title}: ${sec.title}`;
      const paragraphs = cap(sec.paragraphs, 320);
      const subsections = sec.subsections.slice(0, 3).map((x) => ({ title: x.title, paragraphs: cap(x.paragraphs, 220) }));
      list.push({ title, paragraphs, subsections, from: a });
    }
    return list;
  };
  const leadUnits = seededShuffle(unitsOf(leadArticle, true), seed + 1);
  // Articles whose title carries the whole topic ("تلوث المياه" for pollution) come before neighbouring
  // topics ("World War I" for "World War II"), which are only reached when the paper still needs text
  const otherUnits = [
    ...seededShuffle(others.filter(onTopic).flatMap((a) => unitsOf(a, false)), seed + 2),
    ...seededShuffle(others.filter((a) => !onTopic(a)).flatMap((a) => unitsOf(a, false)), seed + 4),
  ];
  // Alternate: two of the lead article's points, then one from a related article
  const mixed: Unit[] = [];
  while (leadUnits.length || otherUnits.length) {
    for (let k = 0; k < 2 && leadUnits.length; k++) mixed.push(leadUnits.shift()!);
    if (otherUnits.length) mixed.push(otherUnits.shift()!);
  }

  const sections: ResearchSection[] = [];
  const used = new Set<WikiArticle>([leadArticle]);
  let words = 0;
  const take = (paras: string[]) => {
    const out: string[] = [];
    for (const p of paras) {
      if (words >= targetWords) break;
      out.push(p);
      words += countWords([p]);
    }
    return out;
  };
  for (const u of mixed) {
    if (words >= targetWords) break;
    const paragraphs = take(u.paragraphs);
    const subsections = u.subsections
      .map((s) => ({ title: s.title, paragraphs: take(s.paragraphs) }))
      .filter((s) => s.paragraphs.length > 0);
    if (paragraphs.length + subsections.length === 0) continue;
    // A heading over a single short paragraph looks odd; it still counts toward the target
    sections.push({ title: u.title, paragraphs, subsections, images: [] });
    used.add(u.from);
  }

  // Images: from the articles actually used, a different selection per version, spread evenly
  if (imageCount > 0 && sections.length > 0) {
    const pool = seededShuffle(
      images.filter((im) => [...used].some((a) => a.title === im.article)),
      seed + 3
    ).slice(0, imageCount);
    pool.forEach((im, k) => {
      const sec = sections[Math.min(sections.length - 1, Math.floor(((k + 0.5) * sections.length) / pool.length))];
      const img: ResearchImage = {
        url: im.url,
        caption: im.caption,
        credit: im.credit,
        afterParagraph: Math.max(0, Math.floor((sec.paragraphs.length - 1) / 2)),
      };
      sec.images.push(img);
    });
  }

  const lang = leadArticle.url.includes("://ar.") ? "ar" : "en";
  const references = [...used].slice(0, 5).map((a) => ({
    title: a.title,
    url: a.url,
    site: lang === "ar" ? "ويكيبيديا، الموسوعة الحرة" : "Wikipedia, The Free Encyclopedia",
  }));

  return {
    versionNumber,
    topic,
    intro,
    sections,
    references,
    font: RESEARCH_FONTS[v % RESEARCH_FONTS.length],
    source: "wikipedia",
    bodyWords: words,
  };
}
