/** One generated research paper (one "version"), shared by /api/research and the Word builder */

export interface ResearchImage {
  /** Wikimedia thumbnail (CORS-enabled), fetched by the browser when the Word file is built */
  url: string;
  caption: string;
  /** Licence / author line printed under the image */
  credit: string;
  /** The image follows this paragraph of its section */
  afterParagraph: number;
}

export interface ResearchSubsection {
  title: string;
  paragraphs: string[];
}

export interface ResearchSection {
  title: string;
  paragraphs: string[];
  subsections: ResearchSubsection[];
  images: ResearchImage[];
}

export interface ResearchReference {
  title: string;
  url: string;
  site: string;
}

export interface ResearchDoc {
  versionNumber: number;
  topic: string;
  intro: string[];
  sections: ResearchSection[];
  conclusion: string[];
  references: ResearchReference[];
  /** Word font of this version: every version gets a different one */
  font: string;
  /** Where the body text came from */
  source: "wikipedia" | "ai";
  bodyWords: number;
}

/** Body text per printed page at the Word layout in lib/docx/research-docx.ts (16pt, 1.5 lines, A4) */
export const WORDS_PER_PAGE = 190;
/** An image with its caption takes about this share of a page */
export const IMAGE_PAGE_SHARE = 0.4;

/**
 * Fonts that ship with Office and render Arabic well; version n uses FONTS[(n - 1) % length]. Each has the
 * body size (half-points) that gives about the same words per page, measured in Word: at one common size
 * Simplified Arabic filled 40% more pages than Traditional Arabic.
 */
export const RESEARCH_FONT_SIZES: Record<string, number> = {
  "Simplified Arabic": 28,
  Arial: 32,
  "Traditional Arabic": 34,
  "Times New Roman": 32,
  "Sakkal Majalla": 34,
  Tahoma: 28,
  Calibri: 32,
};
export const RESEARCH_FONTS = Object.keys(RESEARCH_FONT_SIZES);

/** Plain text of a paper (preview, copy to clipboard) */
export function researchToText(doc: ResearchDoc): string {
  const out: string[] = [`بحث عن: ${doc.topic}`, "", "المقدمة:", ...doc.intro, ""];
  for (const s of doc.sections) {
    out.push(`${s.title}:`, ...s.paragraphs);
    for (const sub of s.subsections) out.push(`${sub.title}:`, ...sub.paragraphs);
    out.push("");
  }
  out.push("الخاتمة:", ...doc.conclusion, "", "المراجع:");
  doc.references.forEach((r, i) => out.push(`${i + 1}. ${r.title} - ${r.site} - ${r.url}`));
  return out.join("\n");
}

export function countWords(texts: string[]): number {
  return texts.reduce((n, t) => n + t.split(/\s+/).filter(Boolean).length, 0);
}
