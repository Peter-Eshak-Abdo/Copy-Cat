import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  Header,
  HorizontalPositionRelativeFrom,
  ImageRun,
  LineRuleType,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  VerticalPositionRelativeFrom,
  WidthType,
  type ParagraphChild,
} from "docx";
import {
  CV_COLORS,
  PAGE_PT,
  SIDEBAR_PT,
  cvMetrics,
  fitScale,
  localizeDigits,
  type AtsMetrics,
  type ClassicMetrics,
  type CvData,
  type CvLang,
  type CvPair,
  type CvTemplate,
} from "@/lib/cv";

/**
 * CVs as Word files, always one A4 page (a long CV gets a smaller font and tighter spacing, see fitScale):
 * - classic: the shop's coloured layout (the two sample CVs: dark sidebar with personal data, skills and
 *   languages; name and the main sections beside it). Arabic mirrors it: sidebar on the right. The page is
 *   one full-height table row, so everything stays editable text (the samples used floating text boxes).
 * - ats: plain black, one column, no tables or pictures, so company CV-reading systems read it cleanly.
 * The Arabic CV is all Arabic digits, the English one all Western digits.
 */

const PAGE_W = 11906; // A4 in twips
const PAGE_H = 16838;
const SIDEBAR_W = SIDEBAR_PT * 20;
const MAIN_W = PAGE_W - SIDEBAR_W;
const tw = (pt: number) => Math.round(pt * 20);
const half = (pt: number) => Math.max(2, Math.round(pt * 2));
const multiple = (m: number) => Math.round(m * 240);

const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };
const NO_CELL_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE };

interface Style {
  rtl: boolean;
  font: string;
  /** Start edge (where lines begin) */
  start: (typeof AlignmentType)[keyof typeof AlignmentType];
}

function styleFor(lang: CvLang): Style {
  return lang === "ar"
    ? // "start", not "right": in a right-to-left paragraph Word reads jc="right" as the left edge
      { rtl: true, font: "Times New Roman", start: AlignmentType.START }
    : { rtl: false, font: "Calibri", start: AlignmentType.LEFT };
}

function textRun(st: Style, text: string, rtl: boolean, opts: { size: number; color?: string; bold?: boolean }) {
  return new TextRun({
    text,
    font: st.font,
    size: half(opts.size),
    sizeComplexScript: half(opts.size),
    bold: opts.bold ?? true,
    boldComplexScript: opts.bold ?? true,
    color: opts.color,
    rightToLeft: rtl,
  });
}

/**
 * Text as runs. In an Arabic CV, Latin words (an e-mail, "GIS") get their own left-to-right runs so they
 * keep their order and letters; the digits are already Arabic (localizeDigits).
 */
function run(st: Style, text: string, opts: { size: number; color?: string; bold?: boolean }): TextRun[] {
  if (!st.rtl) return [textRun(st, text, false, opts)];
  const out: TextRun[] = [];
  const re = /[A-Za-z0-9][A-Za-z0-9@._+\-/]*(?:\s+[A-Za-z0-9][A-Za-z0-9@._+\-/]*)*/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push(textRun(st, text.slice(last, i), true, opts));
    out.push(textRun(st, m[0], false, opts));
    last = i + m[0].length;
  }
  if (last < text.length) out.push(textRun(st, text.slice(last), true, opts));
  return out.length ? out : [textRun(st, text, true, opts)];
}

function para(
  st: Style,
  children: ParagraphChild[],
  opts: {
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    before?: number;
    after?: number;
    line?: number;
    hanging?: number;
    border?: boolean;
  } = {}
) {
  return new Paragraph({
    children,
    bidirectional: st.rtl,
    alignment: opts.align ?? st.start,
    spacing: { before: tw(opts.before ?? 0), after: tw(opts.after ?? 0), line: multiple(opts.line ?? 1.15) },
    indent: opts.hanging ? { start: tw(opts.hanging), hanging: tw(opts.hanging) } : undefined,
    border: opts.border ? { bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000", space: 2 } } : undefined,
    keepNext: opts.border || undefined,
  });
}

const spacer = (st: Style, afterPt: number) =>
  new Paragraph({
    children: [],
    bidirectional: st.rtl,
    run: { size: 2 },
    spacing: { before: 0, after: tw(afterPt), line: 20, lineRule: LineRuleType.EXACT },
  });

function dataUrlBytes(dataUrl: string): Uint8Array {
  const bin = atob(dataUrl.replace(/^data:[^,]+,/, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface CvPhoto {
  dataUrl: string;
  /** width / height */
  aspect: number;
}

const pairText = (st: Style) => (p: CvPair) => (p.label ? `${p.label}${st.rtl ? " : " : ": "}${p.value}` : p.value);

/* ------------------------------------------------------------------ */
/* Classic (coloured) layout                                           */
/* ------------------------------------------------------------------ */

/** Coloured bar with a heading (a one-cell table: real rounded shapes would not stay editable) */
function headingBar(st: Style, text: string, fill: string, width: number, align: "center" | "start", size: number, pad: number) {
  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: [width],
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    visuallyRightToLeft: st.rtl,
    // Inside a right-to-left table Word mirrors the table alignment, so LEFT puts it on the start (right) side
    alignment: align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: width, type: WidthType.DXA },
            shading: { fill, type: ShadingType.CLEAR, color: "auto" },
            borders: NO_CELL_BORDERS,
            margins: { top: tw(pad), bottom: tw(pad), left: 180, right: 180 },
            verticalAlign: VerticalAlign.CENTER,
            children: [para(st, run(st, text, { size, color: "FFFFFF" }), { align: align === "center" ? AlignmentType.CENTER : st.start })],
          }),
        ],
      }),
    ],
  });
}

function sidebarChildren(cv: CvData, st: Style, m: ClassicMetrics, photo?: CvPhoto) {
  const white = "FFFFFF";
  const out: (Paragraph | Table)[] = [];
  const pillW = SIDEBAR_W - 700;
  const pair = pairText(st);

  if (photo) {
    const h = Math.round((m.photo / 72) * 96);
    out.push(
      para(st, [new ImageRun({ data: dataUrlBytes(photo.dataUrl), transformation: { width: Math.round(h * photo.aspect), height: h }, type: photo.dataUrl.includes("image/png") ? "png" : "jpg" })], {
        align: AlignmentType.CENTER,
        after: 12 * (m.photo / 112),
      })
    );
  }

  const block = (heading: string, lines: string[], bullet: string) => {
    if (lines.length === 0) return;
    out.push(headingBar(st, heading, CV_COLORS.pill, pillW, "center", m.pill, m.pillPad));
    out.push(spacer(st, m.pillAfter));
    for (const line of lines) {
      out.push(para(st, run(st, `${bullet}  ${line}`, { size: m.sideItem, color: white }), { after: m.sideAfter, line: m.sideLine, hanging: 15 }));
    }
    out.push(spacer(st, m.sideBlockAfter));
  };

  block(cv.headings.personal, cv.personal.map(pair), "✓");
  const skills = () => block(cv.headings.skills, cv.skills, "•");
  const languages = () => block(cv.headings.languages, cv.languages.map(pair), "▪");
  // Same order as the samples: English has skills before languages, Arabic the other way round
  if (st.rtl) {
    languages();
    skills();
  } else {
    skills();
    languages();
  }
  if (out.length === 0) out.push(para(st, []));
  return out;
}

function mainChildren(cv: CvData, st: Style, m: ClassicMetrics) {
  const out: (Paragraph | Table)[] = [];
  const dark = "111111";
  const barW = 4700;

  out.push(
    para(st, run(st, cv.name || " ", { size: m.name, color: st.rtl ? CV_COLORS.nameAr : CV_COLORS.nameEn }), {
      align: AlignmentType.CENTER,
      after: cv.jobTitle ? 2 : m.nameAfter,
    })
  );
  if (cv.jobTitle) out.push(para(st, run(st, cv.jobTitle, { size: m.job, color: "475569" }), { align: AlignmentType.CENTER, after: m.nameAfter }));

  const section = (heading: string, icon: string, body: (Paragraph | Table)[]) => {
    if (body.length === 0) return;
    out.push(headingBar(st, `${icon}  ${heading}`, CV_COLORS.heading, barW, "start", m.bar, m.barPad));
    out.push(spacer(st, m.barAfter));
    out.push(...body);
    out.push(spacer(st, m.sectionAfter));
  };

  const bulletLines = (items: string[], bullet: string, size: number) =>
    items.map((t) => para(st, run(st, `${bullet}  ${t}`, { size, color: dark }), { after: m.itemAfter, line: m.listLine, hanging: 18 }));

  section(
    cv.headings.objective,
    "🎯",
    cv.objective ? [para(st, run(st, cv.objective, { size: m.objective, color: dark }), { align: AlignmentType.JUSTIFIED, line: m.objectiveLine })] : []
  );
  section(
    cv.headings.education,
    "🎓",
    cv.education.flatMap((e) => [
      ...(e.title ? [para(st, run(st, `❖ ${e.title}`, { size: m.eduTitle, color: dark }), { after: m.itemAfter })] : []),
      ...e.details.map((d) => para(st, run(st, `•  ${d}`, { size: m.eduDetail, color: dark }), { after: m.itemAfter, line: m.listLine, hanging: 35 })),
    ])
  );
  section(cv.headings.experience, "💼", bulletLines(cv.experience, st.rtl ? "✓" : "•", m.experience));
  section(cv.headings.courses, "📜", bulletLines(cv.courses, "•", m.other));
  for (const s of cv.extra) section(s.heading, "⭐", bulletLines(s.items, "•", m.other));
  return out;
}

// 4x4 PNG in the sidebar colour (#0F2236), stretched over the full page height
const SIDEBAR_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAE0lEQVR4nGPkVzJjgAEmOAsvBwAU+wBvroxsbQAAAABJRU5ErkJggg==";
const TWIP_EMU = 635;
const twipPx = (t: number) => Math.round((t / 1440) * 96);

/**
 * The sidebar's dark background as a picture behind the text, anchored in the header so it covers the
 * whole page edge to edge (like the shape in the sample CVs). The table cell alone cannot: a table that
 * reaches the bottom edge pushes Word onto an extra blank page.
 */
function sidebarBackground(rtl: boolean) {
  return new Header({
    children: [
      new Paragraph({
        spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT },
        run: { size: 2 },
        children: [
          new ImageRun({
            type: "png",
            data: dataUrlBytes(`data:image/png;base64,${SIDEBAR_PNG}`),
            transformation: { width: twipPx(SIDEBAR_W), height: twipPx(PAGE_H) + 2 },
            floating: {
              horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: rtl ? (PAGE_W - SIDEBAR_W) * TWIP_EMU : 0 },
              verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
              behindDocument: true,
              allowOverlap: true,
            },
          }),
        ],
      }),
    ],
  });
}

function tinyParagraph(hidden = false) {
  return new Paragraph({
    children: [],
    run: { size: 2, vanish: hidden || undefined },
    spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT },
  });
}

function classicDocument(cv: CvData, st: Style, m: ClassicMetrics, photo?: CvPhoto) {
  const sidebar = new TableCell({
    width: { size: SIDEBAR_W, type: WidthType.DXA },
    shading: { fill: CV_COLORS.sidebar, type: ShadingType.CLEAR, color: "auto" },
    borders: NO_CELL_BORDERS,
    margins: { top: tw(m.sideTop), bottom: 200, left: 260, right: 260 },
    children: sidebarChildren(cv, st, m, photo),
  });
  const main = new TableCell({
    width: { size: MAIN_W, type: WidthType.DXA },
    borders: NO_CELL_BORDERS,
    margins: { top: tw(m.mainTop), bottom: 200, left: 380, right: 380 },
    children: mainChildren(cv, st, m),
  });
  const page = new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: [SIDEBAR_W, MAIN_W],
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    // In an RTL table the first cell sits on the right: the Arabic CV's sidebar
    visuallyRightToLeft: st.rtl,
    rows: [new TableRow({ height: { value: PAGE_H - 1100, rule: HeightRule.ATLEAST }, cantSplit: true, children: [sidebar, main] })],
  });
  return new Document({
    creator: "Copy Cat",
    title: cv.name || "CV",
    styles: { default: { document: { run: { font: st.font } } } },
    sections: [
      {
        headers: { default: sidebarBackground(st.rtl) },
        properties: {
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: { top: 0, bottom: 0, left: 0, right: 0, header: 0, footer: 0, gutter: 0 },
          },
        },
        // Word needs a paragraph after a table; a hidden 1 pt one takes no room
        children: [page, tinyParagraph(true)],
      },
    ],
  });
}

/* ------------------------------------------------------------------ */
/* ATS (plain black) layout                                            */
/* ------------------------------------------------------------------ */

const CONTACT_LABEL = /phone|mobile|tel|email|e-mail|address|linkedin|تليفون|التليفون|موبايل|هاتف|بريد|ايميل|إيميل|عنوان|العنوان/i;

function atsDocument(cv: CvData, st: Style, m: AtsMetrics) {
  const black = "000000";
  const out: Paragraph[] = [];
  const pair = pairText(st);
  const up = (s: string) => (st.rtl ? s : s.toUpperCase());
  const body = (text: string, extra: { hanging?: number; size?: number; after?: number } = {}) =>
    para(st, run(st, text, { size: extra.size ?? m.body, color: black, bold: false }), {
      after: extra.after ?? m.itemAfter,
      line: m.bodyLine,
      hanging: extra.hanging,
      align: st.start,
    });
  const heading = (text: string) =>
    out.push(para(st, run(st, up(text), { size: m.heading, color: black }), { before: m.headingBefore, after: m.headingAfter, border: true }));
  const bullets = (items: string[]) => items.forEach((t) => out.push(body(`•  ${t}`, { hanging: 14 })));

  out.push(para(st, run(st, cv.name || " ", { size: m.name, color: black }), { align: AlignmentType.CENTER, after: m.nameAfter }));
  if (cv.jobTitle) out.push(para(st, run(st, cv.jobTitle, { size: m.job, color: black, bold: false }), { align: AlignmentType.CENTER, after: m.nameAfter }));
  const contact = cv.personal.filter((p) => CONTACT_LABEL.test(p.label));
  const other = cv.personal.filter((p) => !CONTACT_LABEL.test(p.label));
  if (contact.length) {
    out.push(
      para(st, run(st, contact.map((p) => p.value).join("  |  "), { size: m.contact, color: black, bold: false }), {
        align: AlignmentType.CENTER,
        after: m.contactAfter,
      })
    );
  }

  if (cv.objective) {
    heading(cv.headings.objective);
    out.push(body(cv.objective, { after: m.itemAfter }));
  }
  if (cv.education.length) {
    heading(cv.headings.education);
    for (const e of cv.education) {
      if (e.title) out.push(para(st, run(st, e.title, { size: m.eduTitle, color: black }), { after: m.itemAfter, line: m.bodyLine }));
      bullets(e.details);
    }
  }
  if (cv.experience.length) {
    heading(cv.headings.experience);
    bullets(cv.experience);
  }
  if (cv.courses.length) {
    heading(cv.headings.courses);
    bullets(cv.courses);
  }
  if (cv.skills.length) {
    heading(cv.headings.skills);
    bullets(cv.skills);
  }
  if (cv.languages.length) {
    heading(cv.headings.languages);
    bullets(cv.languages.map(pair));
  }
  for (const x of cv.extra) {
    heading(x.heading);
    bullets(x.items);
  }
  if (other.length) {
    heading(cv.headings.personal);
    bullets(other.map(pair));
  }

  const margin = tw(m.margin);
  return new Document({
    creator: "Copy Cat",
    title: cv.name || "CV",
    styles: { default: { document: { run: { font: st.font } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: { top: margin, bottom: margin, left: margin, right: margin, header: 300, footer: 300, gutter: 0 },
          },
        },
        children: out,
      },
    ],
  });
}

/* ------------------------------------------------------------------ */

export function buildCvDocument(raw: CvData, lang: CvLang, photo?: CvPhoto, template: CvTemplate = "classic"): Document {
  const cv = localizeDigits(raw, lang);
  const st = styleFor(lang);
  const usePhoto = template === "classic" ? photo : undefined;
  const scale = fitScale(cv, lang, template, Boolean(usePhoto));
  return template === "ats"
    ? atsDocument(cv, st, cvMetrics("ats", lang, scale) as AtsMetrics)
    : classicDocument(cv, st, cvMetrics("classic", lang, scale) as ClassicMetrics, usePhoto);
}

export async function cvDocxBlob(cv: CvData, lang: CvLang, photo?: CvPhoto, template: CvTemplate = "classic"): Promise<Blob> {
  return Packer.toBlob(buildCvDocument(cv, lang, photo, template));
}

/** File name like "CV - مؤمن محمد احمد غنيم.docx" */
export function cvFileName(cv: CvData, lang: CvLang, ext: "docx" | "pdf" = "docx"): string {
  const name = (cv.name || "CV").replace(/[\\/:*?"<>|]+/g, " ").trim();
  return lang === "ar" ? `سيرة ذاتية - ${name}.${ext}` : `CV - ${name}.${ext}`;
}

export { PAGE_PT };
