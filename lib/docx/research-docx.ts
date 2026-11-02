import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertMillimetersToTwip,
} from "docx";
import { saveAs } from "file-saver";
import { countWords, IMAGE_PAGE_SHARE, RESEARCH_FONT_SIZES, WORDS_PER_PAGE, type ResearchDoc } from "@/lib/research/types";

/**
 * Word file of one research paper (lib/research/types.ts): cover, index, introduction, body, conclusion on
 * its own page, references. All text is right-aligned (Arabic) and set in the version's own font. With
 * `colors` the main headings are navy and the rest follow one restrained blue palette; with images the
 * Wikimedia photos chosen by the server are downloaded here and placed between the paragraphs.
 */

export interface ResearchCoverInfo {
  studentName?: string;
  teacherName?: string;
  gradeOrClass?: string;
  schoolOrUniversity?: string;
  academicYear?: string;
}

export interface ResearchDocxOptions {
  doc: ResearchDoc;
  coverInfo?: ResearchCoverInfo;
  includeIndex?: boolean;
  colors?: boolean;
  fileName?: string;
}

// Body size depends on the font (RESEARCH_FONT_SIZES), 1.5 line spacing: the pace WORDS_PER_PAGE was measured on
const SIZE_CAPTION = 22;
const LINE = 360;

const PALETTE = {
  color: { h1: "1F3864", h2: "2E5C8A", accent: "1F3864", caption: "595959", rule: "8EAADB", headFill: "1F3864", headText: "FFFFFF", zebra: "EEF3FA" },
  plain: { h1: "000000", h2: "000000", accent: "000000", caption: "404040", rule: "000000", headFill: "D9D9D9", headText: "000000", zebra: "FFFFFF" },
};

async function loadImage(url: string): Promise<{ data: Uint8Array; w: number; h: number; type: "jpg" | "png" } | null> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob);
    const out = { data: new Uint8Array(await blob.arrayBuffer()), w: bitmap.width, h: bitmap.height, type: blob.type.includes("png") ? ("png" as const) : ("jpg" as const) };
    bitmap.close();
    return out;
  } catch {
    return null;
  }
}

export async function buildResearchDocx({ doc, coverInfo = {}, includeIndex = true, colors = false }: ResearchDocxOptions): Promise<Blob> {
  const isAr = /[؀-ۿ]/.test(doc.topic);
  const pal = colors ? PALETTE.color : PALETTE.plain;
  const font = doc.font || "Arial";
  const SIZE_BODY = RESEARCH_FONT_SIZES[font] || 30;
  const SIZE_H1 = SIZE_BODY + 8;
  const SIZE_H2 = SIZE_BODY + 2;
  const align = isAr ? AlignmentType.RIGHT : AlignmentType.LEFT;

  const run = (text: string, o: { size?: number; bold?: boolean; color?: string; italics?: boolean } = {}) =>
    new TextRun({ text, font, size: o.size ?? SIZE_BODY, bold: o.bold, italics: o.italics, color: o.color ?? "000000", rightToLeft: isAr });
  const para = (children: TextRun[], o: { alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number; keepNext?: boolean; border?: boolean; newPage?: boolean } = {}) =>
    new Paragraph({
      bidirectional: isAr,
      pageBreakBefore: o.newPage,
      alignment: o.alignment ?? align,
      keepNext: o.keepNext,
      spacing: { before: o.before ?? 0, after: o.after ?? 160, line: LINE },
      border: o.border ? { bottom: { style: BorderStyle.SINGLE, size: 8, color: pal.rule, space: 4 } } : undefined,
      children,
    });
  const body = (text: string) => para([run(text)], { after: 160 });
  // newPage: the heading itself starts the page (a separate break paragraph left blank pages behind)
  const h1 = (text: string, newPage = false) =>
    para([run(text, { size: SIZE_H1, bold: true, color: pal.h1 })], { before: newPage ? 0 : 240, after: 200, keepNext: true, border: colors, newPage });
  const h2 = (text: string) => para([run(text, { size: SIZE_H2, bold: true, color: pal.h2 })], { before: 160, after: 120, keepNext: true });

  // Images are fetched in parallel before the layout (a failed one is simply left out)
  const imageCache = new Map<string, Awaited<ReturnType<typeof loadImage>>>();
  await Promise.all(
    doc.sections.flatMap((s) => s.images).map(async (im) => imageCache.set(im.url, await loadImage(im.url)))
  );
  const imageBlock = (url: string, caption: string, credit: string): Paragraph[] => {
    const img = imageCache.get(url);
    if (!img) return [];
    // 13cm wide at most, 9cm tall at most (A4 text block is 16cm)
    const maxW = 13 / 2.54;
    const maxH = 9 / 2.54;
    const k = Math.min(maxW / img.w, maxH / img.h);
    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        keepNext: true,
        spacing: { before: 120, after: 60 },
        children: [new ImageRun({ type: img.type, data: img.data, transformation: { width: Math.round(img.w * k * 96), height: Math.round(img.h * k * 96) } })],
      }),
      para([run(caption, { size: SIZE_CAPTION, bold: true, color: pal.caption })], { alignment: AlignmentType.CENTER, after: 0 }),
      para([run(credit, { size: SIZE_CAPTION - 4, italics: true, color: pal.caption })], { alignment: AlignmentType.CENTER, after: 200 }),
    ];
  };

  const children: (Paragraph | Table)[] = [];

  // 1. Cover
  if (coverInfo.schoolOrUniversity) {
    children.push(para([run(coverInfo.schoolOrUniversity, { size: 32, bold: true, color: pal.accent })], { after: 120 }));
  }
  children.push(
    para([run(isAr ? "بحث بعنوان" : "Research paper", { size: 36, bold: true, color: pal.caption })], { alignment: AlignmentType.CENTER, before: 2400, after: 300 }),
    para([run(doc.topic, { size: 60, bold: true, color: pal.h1 })], { alignment: AlignmentType.CENTER, after: 1400, border: colors })
  );
  const meta: Array<[string, string | undefined]> = [
    [isAr ? "إعداد الطالب" : "Prepared by", coverInfo.studentName],
    [isAr ? "إشراف" : "Supervised by", coverInfo.teacherName],
    [isAr ? "الصف" : "Class", coverInfo.gradeOrClass],
    [isAr ? "العام الدراسي" : "Academic year", coverInfo.academicYear],
  ];
  for (const [label, value] of meta) {
    if (!value) continue;
    children.push(
      para([run(`${label}: `, { size: 34, bold: true, color: pal.h2 }), run(value, { size: 34, bold: true })], { alignment: AlignmentType.CENTER, after: 200 })
    );
  }

  // 2. Index with estimated page numbers (cover 1, index 2)
  const pagesOf = (words: number, images = 0) => words / WORDS_PER_PAGE + images * IMAGE_PAGE_SHARE;
  if (includeIndex) {
    const rows: Array<[string, number]> = [];
    let page = 3;
    rows.push([isAr ? "المقدمة" : "Introduction", page]);
    page += Math.max(1, Math.ceil(pagesOf(countWords(doc.intro)) + 0.15));
    let cursor = page;
    for (const s of doc.sections) {
      rows.push([s.title, Math.floor(cursor)]);
      cursor += pagesOf(countWords(s.paragraphs) + s.subsections.reduce((n, x) => n + countWords(x.paragraphs) + 4, 0), s.images.length) + 0.12;
    }
    page = Math.ceil(cursor);
    rows.push([isAr ? "الخاتمة" : "Conclusion", page]);
    rows.push([isAr ? "المراجع" : "References", page + 1]);

    const cellBorders = { top: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" }, bottom: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } };
    const cell = (text: string, o: { head?: boolean; zebra?: boolean; center?: boolean; width: number }) =>
      new TableCell({
        width: { size: o.width, type: WidthType.PERCENTAGE },
        borders: cellBorders,
        shading: o.head ? { type: ShadingType.CLEAR, fill: pal.headFill, color: "auto" } : o.zebra ? { type: ShadingType.CLEAR, fill: pal.zebra, color: "auto" } : undefined,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [para([run(text, { bold: o.head, color: o.head ? pal.headText : "000000", size: 30 })], { alignment: o.center ? AlignmentType.CENTER : align, after: 0 })],
      });
    children.push(h1(isAr ? "الفهرس" : "Contents", true));
    children.push(
      new Table({
        visuallyRightToLeft: isAr,
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ tableHeader: true, children: [cell(isAr ? "الموضوع" : "Topic", { head: true, width: 80 }), cell(isAr ? "الصفحة" : "Page", { head: true, center: true, width: 20 })] }),
          ...rows.map(([t, n], i) => new TableRow({ children: [cell(t, { zebra: i % 2 === 1, width: 80 }), cell(String(n), { zebra: i % 2 === 1, center: true, width: 20 })] })),
        ],
      })
    );
  }

  // 3. Introduction (its own page)
  children.push(h1(isAr ? "المقدمة" : "Introduction", true));
  doc.intro.forEach((t) => children.push(body(t)));

  // 4. Body: the page count the shop asked for
  doc.sections.forEach((s, si) => {
    children.push(h1(s.title, si === 0));
    s.paragraphs.forEach((t, k) => {
      children.push(body(t));
      for (const im of s.images.filter((x) => x.afterParagraph === k)) children.push(...imageBlock(im.url, im.caption, im.credit));
    });
    // Images placed after a paragraph that was not kept go at the end of their section
    for (const im of s.images.filter((x) => x.afterParagraph >= s.paragraphs.length)) children.push(...imageBlock(im.url, im.caption, im.credit));
    for (const sub of s.subsections) {
      children.push(h2(sub.title));
      sub.paragraphs.forEach((t) => children.push(body(t)));
    }
  });

  // 5. Conclusion alone on its page, 6. references
  children.push(h1(isAr ? "الخاتمة" : "Conclusion", true));
  doc.conclusion.forEach((t) => children.push(body(t)));
  if (doc.references.length > 0) {
    children.push(h1(isAr ? "المراجع" : "References", true));
    doc.references.forEach((r, i) =>
      children.push(
        para(
          [run(`${i + 1}. `, { bold: true, color: pal.h2 }), run(`${r.title}، ${r.site}.`, { bold: true }), run(isAr ? " متاح على: " : " Available at: "), run(r.url, { size: 24, color: colors ? "2E5C8A" : "000000" })],
          { after: 200 }
        )
      )
    );
  }

  const margin = convertMillimetersToTwip(25);
  const borderLine = { style: BorderStyle.SINGLE, size: 12, color: colors ? pal.h1 : "000000", space: 24 };
  const document = new Document({
    styles: { default: { document: { run: { font, size: SIZE_BODY, rightToLeft: isAr } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) },
            margin: { top: margin, bottom: margin, left: margin, right: margin },
            borders: { pageBorderTop: borderLine, pageBorderBottom: borderLine, pageBorderLeft: borderLine, pageBorderRight: borderLine },
          },
          titlePage: true,
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font, size: 24, color: pal.caption })] })],
          }),
          first: new Footer({ children: [new Paragraph({ children: [] })] }),
        },
        children,
      },
    ],
  });
  return Packer.toBlob(document);
}

export async function generateResearchDocx(options: ResearchDocxOptions): Promise<void> {
  const blob = await buildResearchDocx(options);
  const safe = options.doc.topic.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
  saveAs(blob, options.fileName || `بحث_${safe}_نسخة_${options.doc.versionNumber}.docx`);
}
