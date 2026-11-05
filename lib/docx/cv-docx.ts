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
import { CV_COLORS, type CvData, type CvLang } from "@/lib/cv";

/**
 * The shop's CV layout as a Word file (the two sample CVs: dark sidebar with personal data, skills and
 * languages; name and the main sections beside it). Arabic mirrors it: sidebar on the right. The page is
 * one full-height table row, so everything stays editable text in Word (the samples used floating text
 * boxes, which are awkward to edit). A long CV simply continues on a second page.
 */

const PAGE_W = 11906; // A4 in twips
const PAGE_H = 16838;
const SIDEBAR_W = 4000;
const MAIN_W = PAGE_W - SIDEBAR_W;

const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };
const NO_CELL_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE };

interface Style {
  lang: CvLang;
  rtl: boolean;
  font: string;
  /** Start edge (where lines begin) */
  start: (typeof AlignmentType)[keyof typeof AlignmentType];
}

function styleFor(lang: CvLang): Style {
  return lang === "ar"
    ? { lang, rtl: true, font: "Times New Roman", start: AlignmentType.RIGHT }
    : { lang, rtl: false, font: "Calibri", start: AlignmentType.LEFT };
}

function textRun(st: Style, text: string, rtl: boolean, opts: { size: number; color?: string; bold?: boolean }) {
  return new TextRun({
    text,
    font: st.font,
    size: opts.size * 2,
    sizeComplexScript: opts.size * 2,
    bold: opts.bold ?? true,
    boldComplexScript: opts.bold ?? true,
    color: opts.color,
    rightToLeft: rtl,
  });
}

/**
 * Text as runs. In an Arabic CV, Latin words and Western digits (phone, e-mail, "GIS") get their own
 * left-to-right runs: inside a right-to-left run Word draws 0-9 as Arabic-Indic digits, which turned a
 * phone number and an e-mail address into the wrong characters.
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
  } = {}
) {
  return new Paragraph({
    children,
    bidirectional: st.rtl,
    alignment: opts.align ?? st.start,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 0, line: opts.line ?? 276 },
    indent: opts.hanging ? { start: opts.hanging, hanging: opts.hanging } : undefined,
  });
}

/** Coloured bar with a heading (a one-cell table: real rounded shapes would not stay editable) */
function headingBar(st: Style, text: string, fill: string, width: number, align: "center" | "start", size: number) {
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
            margins: { top: 70, bottom: 70, left: 180, right: 180 },
            verticalAlign: VerticalAlign.CENTER,
            children: [para(st, run(st, text, { size, color: "FFFFFF" }), { align: align === "center" ? AlignmentType.CENTER : st.start })],
          }),
        ],
      }),
    ],
  });
}

const spacer = (st: Style, after: number) => para(st, [], { after, line: 200 });

function dataUrlBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.replace(/^data:[^,]+,/, "");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface CvPhoto {
  dataUrl: string;
  /** width / height */
  aspect: number;
}

function sidebarChildren(cv: CvData, st: Style, photo?: CvPhoto) {
  const white = "FFFFFF";
  const out: (Paragraph | Table)[] = [];
  const pillW = SIDEBAR_W - 700;

  if (photo) {
    const h = 150;
    const w = Math.round(h * photo.aspect);
    out.push(
      para(st, [new ImageRun({ data: dataUrlBytes(photo.dataUrl), transformation: { width: w, height: h }, type: photo.dataUrl.includes("image/png") ? "png" : "jpg" })], {
        align: AlignmentType.CENTER,
        after: 240,
      })
    );
  }

  const block = (heading: string, lines: string[], bullet: string) => {
    if (lines.length === 0) return;
    out.push(headingBar(st, heading, CV_COLORS.pill, pillW, "center", 13));
    out.push(spacer(st, 120));
    for (const line of lines) {
      out.push(para(st, run(st, `${bullet}  ${line}`, { size: 11.5, color: white }), { after: 140, line: 330, hanging: 300 }));
    }
    out.push(spacer(st, 360));
  };

  const sep = st.rtl ? " : " : ": ";
  block(cv.headings.personal, cv.personal.map((p) => (p.label ? `${p.label}${sep}${p.value}` : p.value)), "✓");
  const skills = () => block(cv.headings.skills, cv.skills, "•");
  const languages = () => block(cv.headings.languages, cv.languages.map((p) => (p.label ? `${p.label}${sep}${p.value}` : p.value)), "▪");
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

function mainChildren(cv: CvData, st: Style) {
  const out: (Paragraph | Table)[] = [];
  const dark = "111111";
  const barW = 4700;

  out.push(
    para(st, run(st, cv.name || " ", { size: st.rtl ? 30 : 24, color: st.rtl ? CV_COLORS.nameAr : CV_COLORS.nameEn }), {
      align: AlignmentType.CENTER,
      after: cv.jobTitle ? 40 : 300,
    })
  );
  if (cv.jobTitle) out.push(para(st, run(st, cv.jobTitle, { size: 13, color: "475569" }), { align: AlignmentType.CENTER, after: 300 }));

  const section = (heading: string, icon: string, body: (Paragraph | Table)[]) => {
    if (body.length === 0) return;
    out.push(headingBar(st, `${icon}  ${heading}`, CV_COLORS.heading, barW, "start", 12));
    out.push(spacer(st, 140));
    out.push(...body);
    out.push(spacer(st, 320));
  };

  const bulletLines = (items: string[], bullet: string, size: number) =>
    items.map((t) => para(st, run(st, `${bullet}  ${t}`, { size, color: dark }), { after: 160, line: 320, hanging: 360 }));

  section(
    cv.headings.objective,
    "🎯",
    cv.objective ? [para(st, run(st, cv.objective, { size: 12, color: dark }), { align: AlignmentType.JUSTIFIED, line: 380 })] : []
  );

  section(
    cv.headings.education,
    "🎓",
    cv.education.flatMap((e) => [
      ...(e.title ? [para(st, run(st, `❖ ${e.title}`, { size: 14, color: dark }), { after: 140 })] : []),
      ...e.details.map((d) =>
        para(st, run(st, `•  ${d}`, { size: 13, color: dark }), { after: 140, line: 320, hanging: 700 })
      ),
    ])
  );

  section(cv.headings.experience, "💼", bulletLines(cv.experience, st.rtl ? "✓" : "•", 13.5));
  section(cv.headings.courses, "📜", bulletLines(cv.courses, "•", 12.5));
  for (const s of cv.extra) section(s.heading, "⭐", bulletLines(s.items, "•", 12.5));
  return out;
}

// 4x4 PNG in the sidebar colour (#0F2236), stretched over the full page height
const SIDEBAR_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAE0lEQVR4nGPkVzJjgAEmOAsvBwAU+wBvroxsbQAAAABJRU5ErkJggg==";
const TWIP_EMU = 635;
const twipPx = (t: number) => Math.round((t / 1440) * 96);

/**
 * The sidebar's dark background as a picture behind the text, anchored in the header so it covers the
 * whole page edge to edge on every page (like the shape in the sample CVs). The table cell alone cannot:
 * a table that reaches the bottom edge pushes Word onto an extra blank page.
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

export function buildCvDocument(cv: CvData, lang: CvLang, photo?: CvPhoto): Document {
  const st = styleFor(lang);
  const sidebar = new TableCell({
    width: { size: SIDEBAR_W, type: WidthType.DXA },
    shading: { fill: CV_COLORS.sidebar, type: ShadingType.CLEAR, color: "auto" },
    borders: NO_CELL_BORDERS,
    margins: { top: 700, bottom: 300, left: 260, right: 260 },
    children: sidebarChildren(cv, st, photo),
  });
  const main = new TableCell({
    width: { size: MAIN_W, type: WidthType.DXA },
    borders: NO_CELL_BORDERS,
    margins: { top: 450, bottom: 300, left: 380, right: 380 },
    children: mainChildren(cv, st),
  });

  const page = new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: [SIDEBAR_W, MAIN_W],
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    // In an RTL table the first cell sits on the right: the Arabic CV's sidebar
    visuallyRightToLeft: st.rtl,
    rows: [
      new TableRow({
        // Fills the page; the row grows onto a second page when there is more to say
        height: { value: PAGE_H - 1100, rule: HeightRule.ATLEAST },
        children: [sidebar, main],
      }),
    ],
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
        children: [
          page,
          // Word needs a paragraph after a table; a hidden 1 pt one takes no room
          tinyParagraph(true),
        ],
      },
    ],
  });
}

export async function cvDocxBlob(cv: CvData, lang: CvLang, photo?: CvPhoto): Promise<Blob> {
  return Packer.toBlob(buildCvDocument(cv, lang, photo));
}

/** File name like "CV - مؤمن محمد احمد غنيم.docx" */
export function cvFileName(cv: CvData, lang: CvLang): string {
  const name = (cv.name || "CV").replace(/[\\/:*?"<>|]+/g, " ").trim();
  return lang === "ar" ? `سيرة ذاتية - ${name}.docx` : `CV - ${name}.docx`;
}
