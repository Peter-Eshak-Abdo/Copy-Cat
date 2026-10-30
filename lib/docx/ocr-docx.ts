import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  convertMillimetersToTwip,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  VerticalAlign,
  UnderlineType,
  Tab,
  TabStopType,
  TableLayoutType,
  HeightRule,
  PageBorderOffsetFrom,
  LineRuleType,
  LeaderType,
} from "docx";
import { saveAs } from "file-saver";

export type PageBorderKind = "none" | "single" | "double" | "decorative";

export interface OcrDocxOptions {
  title?: string;
  rawText?: string;
  content?: string;
  fileName?: string;
  font?: string;
  hasPageBorder?: boolean;
  /** Page frame detected on the scanned original. "decorative" renders a Word art (vine) border. */
  borderStyle?: PageBorderKind;
  /** The original body text is printed bold (common in Egyptian contracts) */
  boldBody?: boolean;
  language?: "ar" | "en" | "fr" | "auto";
}

export const FALLBACK_FONT = "Arial";

// Type scale (half-points) tuned so a one-page A4 contract fills the page like the printed original
const SIZE_BODY = 28; // 14pt
const SIZE_BASMALA = 40; // 20pt
const SIZE_TITLE = 52; // 26pt
const SIZE_CLAUSE = 36; // 18pt
const SIZE_PHOTO_LABEL = 26; // 13pt
// Exact 19.5pt pitch: matches printed contracts (~30 lines + photo header on one A4 page)
const LINE_BODY = 390;
const LINE_RULE = LineRuleType.EXACT;

const PAGE_W_MM = 210;
const PAGE_H_MM = 297;

/** Marker the OCR prompt uses to push a trailing label (e.g. "(طرف أول زوج)") to the far end of the line */
const TRAILING_SPLIT = /\s*\|\|\s*/;

/**
 * Checks whether text contains Arabic characters
 */
export function isArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * Cleans HTML entities, markdown escapes, and technical artifacts from text
 */
function sanitizeText(raw: string): { text: string; isCentered: boolean } {
  const isCentered = /<center>/i.test(raw) || /<\/center>/i.test(raw);
  const cleaned = raw
    .replace(/<\/?center>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\\([*_#[\]()-])/g, "$1") // Unescape markdown backslashes like \* or \_
    .replace(/<\/?(span|div|p)[^>]*>/gi, "")
    .replace(/###\s*/g, "")
    .replace(/##\s*/g, "")
    .replace(/#\s*/g, "")
    .trim();

  return { text: cleaned, isCentered };
}

interface InlineToken {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

/**
 * Tokenizes text containing markdown (**bold**, *italic*) and HTML (<u>underline</u>, <b>bold</b>, <i>italic</i>)
 */
function tokenizeFormattedText(text: string, isParentBold: boolean = false): InlineToken[] {
  const tokens: InlineToken[] = [];

  // Match tags and markdown delimiters: <u>...</u>, <b>...</b>, <strong>...</strong>, <i>...</i>, <em>...</em>, **...**, __...__
  const pattern = /(<u>.*?<\/u>|<b>.*?<\/b>|<strong>.*?<\/strong>|<i>.*?<\/i>|<em>.*?<\/em>|\*\*.*?\*\*|__.*?__)/gi;
  const parts = text.split(pattern);

  for (const part of parts) {
    if (!part) continue;

    const lower = part.toLowerCase();
    if (lower.startsWith("<u>") && lower.endsWith("</u>")) {
      const inner = part.slice(3, -4);
      tokens.push({
        text: inner.replace(/<[^>]+>/g, ""),
        bold: isParentBold,
        italic: false,
        underline: true,
      });
    } else if (
      (lower.startsWith("<b>") && lower.endsWith("</b>")) ||
      (lower.startsWith("<strong>") && lower.endsWith("</strong>"))
    ) {
      const inner = lower.startsWith("<b>") ? part.slice(3, -4) : part.slice(8, -9);
      tokens.push({
        text: inner.replace(/<[^>]+>/g, ""),
        bold: true,
        italic: false,
        underline: false,
      });
    } else if (
      (lower.startsWith("<i>") && lower.endsWith("</i>")) ||
      (lower.startsWith("<em>") && lower.endsWith("</em>"))
    ) {
      const inner = lower.startsWith("<i>") ? part.slice(3, -4) : part.slice(4, -5);
      tokens.push({
        text: inner.replace(/<[^>]+>/g, ""),
        bold: isParentBold,
        italic: true,
        underline: false,
      });
    } else if (
      (part.startsWith("**") && part.endsWith("**")) ||
      (part.startsWith("__") && part.endsWith("__"))
    ) {
      const inner = part.slice(2, -2);
      tokens.push({
        text: inner.replace(/<[^>]+>/g, ""),
        bold: true,
        italic: false,
        underline: false,
      });
    } else {
      // Plain text chunk
      tokens.push({
        text: part.replace(/<[^>]+>/g, ""),
        bold: isParentBold,
        italic: false,
        underline: false,
      });
    }
  }

  return tokens.filter((t) => t.text.length > 0);
}

/**
 * Parses inline formatting like **bold text** and <u>underlined</u> into docx TextRuns
 * Adheres to Requirement #4: Uses detected font or falls back to "Arial"
 */
function parseInlineRuns(
  text: string,
  baseSize: number,
  baseColor: string,
  isParentBold: boolean = false,
  fontName: string = FALLBACK_FONT
): TextRun[] {
  const tokens = tokenizeFormattedText(text, isParentBold);
  const runs: TextRun[] = [];

  for (const token of tokens) {
    const chunkIsAr = isArabic(token.text);
    runs.push(
      new TextRun({
        text: token.text,
        bold: token.bold,
        italics: token.italic,
        underline: token.underline ? { type: UnderlineType.SINGLE } : undefined,
        size: baseSize,
        font: fontName,
        rightToLeft: chunkIsAr,
        color: baseColor,
      })
    );
  }

  if (runs.length === 0) {
    const isAr = isArabic(text);
    runs.push(
      new TextRun({
        text,
        bold: isParentBold,
        size: baseSize,
        font: fontName,
        rightToLeft: isAr,
        color: baseColor,
      })
    );
  }

  return runs;
}

const MM_PER_PX = 25.4 / 96;
let measureCtx: CanvasRenderingContext2D | null | undefined;

/**
 * Width of a text run in mm. Uses canvas text shaping (the shop PCs have the Office Arabic fonts
 * installed), falling back to average glyph widths when no canvas is available.
 */
function measureTextMm(text: string, sizeHalfPts: number, bold: boolean, fontName: string): number {
  const sizePx = (sizeHalfPts / 2) * (96 / 72);
  if (measureCtx === undefined) {
    measureCtx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  }
  if (measureCtx) {
    measureCtx.font = `${bold ? "bold " : ""}${sizePx}px "${fontName}", "Arial"`;
    return measureCtx.measureText(text).width * MM_PER_PX;
  }
  let em = 0;
  for (const ch of text) em += ch === "." || ch === " " ? 0.32 : isArabic(ch) ? 0.42 : 0.5;
  return em * sizePx * MM_PER_PX;
}

const DOT_RUN = /\.{4,}|…+/g;

/**
 * Resizes the dotted blanks of a form line ("السيد/ ...... المقيم: ......") so the line fills the
 * text width exactly once, as on the printed form, instead of wrapping or stopping short.
 * Dots are shared between the runs in proportion to their length in the OCR output.
 */
function fitDotLeaders(text: string, widthMm: number, sizeHalfPts: number, bold: boolean, fontName: string): string {
  const runs = text.match(DOT_RUN);
  if (!runs) return text;
  const plain = text.replace(/<[^>]+>|\*\*/g, "");
  const textOnly = plain.replace(DOT_RUN, "");
  const dotMm = measureTextMm("..........", sizeHalfPts, bold, fontName) / 10;
  // 4% slack absorbs justification and shaping differences between canvas and Word
  const freeMm = widthMm * 0.96 - measureTextMm(textOnly, sizeHalfPts, bold, fontName);
  const totalDots = Math.max(runs.length * 4, Math.floor(freeMm / dotMm));
  const origTotal = runs.reduce((n, r) => n + r.length, 0);
  let k = 0;
  return text.replace(DOT_RUN, (r) => {
    k++;
    const share = k === runs.length ? totalDots : Math.max(4, Math.round((r.length / origTotal) * totalDots));
    return ".".repeat(Math.max(4, share));
  });
}

/** Line starts that always open a new paragraph on legal forms (ordinals, numbered parties, ID lines) */
const NEW_ITEM_START = /^(أولاً|ثانياً|ثالثاً|رابعاً|خامساً|ويحمل|وتحمل|[0-9٠-٩]+\s*[-.)/]|[-*•]\s)/;

/**
 * Re-joins visual lines that the OCR emitted one per printed line back into paragraphs, so Word can
 * justify them across the full width like the original instead of leaving ragged single-line paragraphs.
 */
function mergeWrappedLines(lines: string[]): string[] {
  const out: string[] = [];
  // Dotted form lines stay on their own line: their blanks are sized to exactly one line width
  const isStructural = (l: string) =>
    !l ||
    l.startsWith("#") ||
    isTableRow(l) ||
    l.includes("||") ||
    /\.{4,}|…/.test(l) ||
    /^\(?\s*[\d٠-٩]+\s*\)?$/.test(l) ||
    /^(<u>)?\s*(البند|المادة)\s/.test(l);
  for (const raw of lines) {
    const line = raw.trim();
    const prev = out.length > 0 ? out[out.length - 1] : "";
    const prevOpen = prev.length > 50 && !isStructural(prev) && !/[.:)\]]\s*$/.test(prev.replace(/<[^>]+>|\*\*/g, ""));
    if (prevOpen && !isStructural(line) && !NEW_ITEM_START.test(line)) {
      out[out.length - 1] = `${prev} ${line}`;
    } else {
      out.push(raw);
    }
  }
  return out;
}

/** Splits "lead || trailing label" into its two parts; trail is "" when there is no marker */
function splitTrailing(text: string): [string, string] {
  const parts = text.split(TRAILING_SPLIT).filter((p) => p.trim().length > 0);
  if (parts.length < 2) return [text, ""];
  return [parts.slice(0, -1).join(" "), parts[parts.length - 1]];
}

/**
 * Checks if a line is a markdown table row (contains | and isn't just an empty boundary)
 */
function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 2;
}

/**
 * Checks if a line is a markdown table separator row like | --- | :---: |
 */
function isTableSeparator(line: string): boolean {
  const clean = line.replace(/\|/g, "").replace(/[-:\s]/g, "");
  return clean.length === 0;
}

/**
 * Checks if table is a contract photo header (e.g. contains "صورة الزوج", "صورة الزوجة", etc.)
 */
function isPhotoHeaderTable(tableLines: string[]): boolean {
  const combined = tableLines.join(" ");
  return (
    combined.includes("صورة الزوج") ||
    combined.includes("صورة الزوجة") ||
    (combined.includes("صورة") && combined.includes("الطرف")) ||
    (combined.includes("صورة") && (combined.includes("الرحمن") || combined.includes("عقد")))
  );
}

/**
 * Builds a dedicated contract header table with photo boxes on the sides and centered title in the middle
 */
function buildContractPhotoHeader(
  tableLines: string[],
  fontName: string = FALLBACK_FONT,
  textWidthMm: number = 180
): Table {
  const allRowsCells: string[][] = [];
  for (const line of tableLines) {
    if (isTableSeparator(line)) continue;
    const cells = line
      .split("|")
      .map((c) => sanitizeText(c).text)
      .slice(1, -1);
    if (cells.length > 0) allRowsCells.push(cells);
  }

  let rightBox = "صورة الزوج";
  let middleTitle = "عقد زواج عرفي";
  let leftBox = "صورة الزوجة";

  const rawFirstRow = allRowsCells[0] || ["صورة الزوج", "عقد", "صورة الزوجة"];

  if (rawFirstRow.length >= 3) {
    for (const c of rawFirstRow) {
      if (c.includes("الزوجة") || c.includes("ثاني")) {
        leftBox = c;
      } else if (c.includes("الزوج") || c.includes("أول")) {
        rightBox = c;
      } else {
        middleTitle = c;
      }
    }
  } else if (rawFirstRow.length === 2) {
    rightBox = rawFirstRow[0];
    leftBox = rawFirstRow[1];
  }

  const firstRow = rawFirstRow.length >= 3 ? [rightBox, middleTitle, leftBox] : rawFirstRow;
  const cellCount = firstRow.length;

  const noBorder = {
    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  };

  const photoBorder = {
    top: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
    bottom: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
    left: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
    right: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
  };

  // Portrait photo boxes at a fixed physical size (35mm x 45mm); the title takes the remaining width
  const photoWmm = 35;
  const photoHmm = 45;
  const colWidthsMm =
    cellCount === 3
      ? [photoWmm, Math.max(40, textWidthMm - photoWmm * 2), photoWmm]
      : firstRow.map(() => textWidthMm / cellCount);

  const cells: TableCell[] = firstRow.map((content, idx) => {
    const isSideBox = idx === 0 || idx === cellCount - 1;
    const isPhotoCell = isSideBox && (content.includes("صورة") || content.length < 25);
    const cellWidth = { size: convertMillimetersToTwip(colWidthsMm[idx]), type: WidthType.DXA };

    if (isPhotoCell) {
      return new TableCell({
        width: cellWidth,
        borders: photoBorder,
        verticalAlign: VerticalAlign.CENTER,
        margins: {
          left: convertMillimetersToTwip(2),
          right: convertMillimetersToTwip(2),
        },
        children: [
          new Paragraph({
            bidirectional: true,
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: content.replace(/\[|\]/g, "").trim(),
                bold: true,
                size: SIZE_PHOTO_LABEL,
                font: fontName,
                rightToLeft: true,
                color: "000000",
              }),
            ],
          }),
        ],
      });
    }

    // sanitizeText already turned <br> into newlines and stripped "#" markers; <u> survives for the title
    const titleLines = content.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const titleParagraphs = titleLines.map((tLine, pIdx) => {
      const isBasmala = tLine.includes("الرحمن") || (pIdx === 0 && titleLines.length > 1);
      return new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.CENTER,
        spacing: { before: isBasmala ? 0 : 200, after: 0, line: 240 },
        children: parseInlineRuns(tLine, isBasmala ? SIZE_BASMALA : SIZE_TITLE, "000000", true, fontName),
      });
    });

    return new TableCell({
      width: cellWidth,
      borders: noBorder,
      verticalAlign: VerticalAlign.CENTER,
      children: titleParagraphs.length > 0 ? titleParagraphs : [new Paragraph({ children: [] })],
    });
  });

  return new Table({
    visuallyRightToLeft: true,
    layout: TableLayoutType.FIXED,
    width: { size: convertMillimetersToTwip(textWidthMm), type: WidthType.DXA },
    columnWidths: colWidthsMm.map((mm) => convertMillimetersToTwip(mm)),
    borders: noBorder,
    rows: [
      new TableRow({
        height: { value: convertMillimetersToTwip(photoHmm), rule: HeightRule.EXACT },
        children: cells,
      }),
    ],
  });
}

/**
 * Converts a standard block of markdown table lines into a clean DOCX Table
 * Sets RTL for Arabic tables and LTR for Latin (French/English) tables
 */
function buildDocxTable(
  tableLines: string[],
  fontName: string = FALLBACK_FONT,
  textWidthMm: number = 180
): Table | null {
  if (isPhotoHeaderTable(tableLines)) {
    return buildContractPhotoHeader(tableLines, fontName, textWidthMm);
  }

  const combinedTableText = tableLines.join(" ");
  const tableIsAr = isArabic(combinedTableText);

  const rows: TableRow[] = [];
  let isFirstRow = true;

  for (const line of tableLines) {
    if (isTableSeparator(line)) continue;

    const rawCells = line
      .split("|")
      .map((c) => sanitizeText(c).text)
      .slice(1, -1);

    if (rawCells.length === 0) continue;

    const cellWidthPercent = Math.max(10, Math.floor(100 / rawCells.length));

    const cells: TableCell[] = rawCells.map((cellContent) => {
      const isHeader = isFirstRow;
      const cellIsAr = isArabic(cellContent);

      return new TableCell({
        width: {
          size: cellWidthPercent,
          type: WidthType.PERCENTAGE,
        },
        shading: isHeader
          ? {
              fill: "F8FAFC",
              type: ShadingType.CLEAR,
            }
          : undefined,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
        },
        margins: {
          top: convertMillimetersToTwip(2),
          bottom: convertMillimetersToTwip(2),
          left: convertMillimetersToTwip(2.5),
          right: convertMillimetersToTwip(2.5),
        },
        children: [
          new Paragraph({
            bidirectional: cellIsAr,
            alignment: isHeader
              ? AlignmentType.CENTER
              : cellIsAr
              ? AlignmentType.RIGHT
              : AlignmentType.LEFT,
            spacing: { before: 40, after: 40, line: 240 },
            children: parseInlineRuns(
              cellContent,
              isHeader ? 24 : 22,
              isHeader ? "0F172A" : "334155",
              isHeader,
              fontName
            ),
          }),
        ],
      });
    });

    rows.push(
      new TableRow({
        tableHeader: isFirstRow,
        children: cells,
      })
    );

    if (isFirstRow) {
      isFirstRow = false;
    }
  }

  if (rows.length === 0) return null;

  return new Table({
    visuallyRightToLeft: tableIsAr,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    rows,
  });
}

/**
 * Resolves the page frame. "decorative" maps to Word's built-in "vine" art border, the closest match to
 * the green leaf frames printed on Egyptian contract paper.
 */
function buildPageBorders(kind: PageBorderKind) {
  if (kind === "none") return undefined;
  if (kind === "decorative") {
    // Art borders take their width in points (1-31), not eighths of a point
    const art = { style: "vine" as unknown as typeof BorderStyle.SINGLE, size: 18, color: "auto", space: 12 };
    return {
      pageBorders: {
        display: "allPages" as const,
        offsetFrom: PageBorderOffsetFrom.PAGE,
        zOrder: "front" as const,
      },
      pageBorderTop: art,
      pageBorderBottom: art,
      pageBorderLeft: art,
      pageBorderRight: art,
    };
  }
  const line = {
    style: kind === "double" ? BorderStyle.DOUBLE : BorderStyle.SINGLE,
    size: 12,
    color: "000000",
    space: 14,
  };
  return {
    pageBorders: { display: "allPages" as const, zOrder: "front" as const },
    pageBorderTop: line,
    pageBorderBottom: line,
    pageBorderLeft: line,
    pageBorderRight: line,
  };
}

/**
 * Builds the high-fidelity DOCX document preserving layout, tables, type hierarchy and page frame.
 * - Detected font, or "Arial" as fallback.
 * - Arabic: RTL + right/justified alignment. French / English: LTR + left alignment.
 * - " || " splits a trailing label that is pushed to the far margin (e.g. "(طرف أول زوج)").
 */
export function buildOcrDocument({
  title,
  rawText,
  content,
  font,
  hasPageBorder = false,
  borderStyle,
  boldBody = false,
  language = "auto",
}: OcrDocxOptions): Document {
  const fullText = rawText || content || "";
  const lines = mergeWrappedLines(fullText.split(/\r?\n/).map((l) => l.trimEnd()));
  const docIsArabic = language === "ar" ? true : language === "en" || language === "fr" ? false : isArabic(fullText);

  const activeFont = font && font.trim() && font.trim().toLowerCase() !== "auto" ? font.trim() : FALLBACK_FONT;

  const frame: PageBorderKind = borderStyle && borderStyle !== "none" ? borderStyle : hasPageBorder ? "double" : "none";
  // Leave room for the art border band so text never collides with it
  const marginMm = frame === "decorative" ? 16 : frame === "none" ? 15 : 18;
  const textWidthMm = PAGE_W_MM - marginMm * 2;
  const textWidthTwip = convertMillimetersToTwip(textWidthMm);

  const docChildren: (Paragraph | Table)[] = [];

  // Filter out auto-generated technical filenames
  const isAutoFilename =
    !title ||
    title.startsWith("مستند_مستخرج") ||
    title.endsWith(".docx") ||
    /^[a-f0-9_-]{8,}/i.test(title);

  if (title && title.trim() && !isAutoFilename) {
    const isTitleAr = isArabic(title);
    docChildren.push(
      new Paragraph({
        bidirectional: isTitleAr,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200, before: 60 },
        children: [
          new TextRun({
            text: title.trim(),
            bold: true,
            size: SIZE_CLAUSE,
            font: activeFont,
            color: "000000",
            rightToLeft: isTitleAr,
          }),
        ],
      })
    );
  }

  // Paragraph with an optional trailing label pushed to the far margin
  const bodyParagraph = (
    text: string,
    opts: { bold: boolean; isAr: boolean; centered?: boolean; before?: number; after?: number }
  ) => {
    const [rawLead, trail] = splitTrailing(text);
    // A blank that closes the line (or runs up to the trailing label) becomes a tab with a dot leader:
    // Word then draws the dots exactly up to the far margin / label whatever the font metrics are.
    const closingBlank = /\s*(\.{4,}|…+)\s*$/;
    const leader = closingBlank.test(rawLead);
    let lead = leader ? rawLead.replace(closingBlank, "") : rawLead;
    const hasDots = leader || /\.{4,}|…/.test(lead);
    if (/\.{4,}|…/.test(lead)) {
      // Remaining mid-line blanks are sized by measurement, keeping room for the label and a closing leader
      const trailMm = trail ? measureTextMm(trail, SIZE_BODY, opts.bold, activeFont) + 4 : 0;
      lead = fitDotLeaders(lead, textWidthMm - trailMm - (leader ? 30 : 0), SIZE_BODY, opts.bold, activeFont);
    }
    const hasTab = leader || trail.length > 0;
    const runs = parseInlineRuns(lead, SIZE_BODY, "000000", opts.bold, activeFont);
    if (hasTab) {
      runs.push(new TextRun({ children: [new Tab()], size: SIZE_BODY, font: activeFont, bold: opts.bold }));
      if (trail) runs.push(...parseInlineRuns(` ${trail}`, SIZE_BODY, "000000", opts.bold, activeFont));
    }
    const plain = `${lead} ${trail}`.replace(/<[^>]+>|\*\*/g, "");
    const widthMm = measureTextMm(plain, SIZE_BODY, opts.bold, activeFont);
    // Arabic prose is justified edge to edge in the original (Word stretches it with kashida).
    // A paragraph that fits on one line is "distributed" when it is nearly full, so it also spans the width.
    const alignment = opts.centered
      ? AlignmentType.CENTER
      : !opts.isAr
      ? AlignmentType.LEFT
      : hasTab || hasDots
      ? AlignmentType.RIGHT
      : widthMm > textWidthMm
      ? AlignmentType.JUSTIFIED
      : widthMm > textWidthMm * 0.8
      ? AlignmentType.DISTRIBUTE
      : AlignmentType.RIGHT;
    return new Paragraph({
      bidirectional: opts.isAr,
      alignment,
      tabStops: hasTab
        ? [{ type: TabStopType.END, position: textWidthTwip, leader: leader ? LeaderType.DOT : undefined }]
        : undefined,
      spacing: { before: opts.before ?? 0, after: opts.after ?? 0, line: LINE_BODY, lineRule: LINE_RULE },
      children: runs,
    });
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Explicit Page Break marker from OCR / PDF split
    if (
      trimmed === "---" ||
      trimmed === "\\pagebreak" ||
      trimmed.startsWith("═══════") ||
      trimmed.includes("الصفحة رقم (") ||
      trimmed.startsWith("--- Page")
    ) {
      if (docChildren.length > 0) {
        docChildren.push(new Paragraph({ pageBreakBefore: true, children: [] }));
      }
      i++;
      continue;
    }

    // 1. Table block
    if (isTableRow(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        tableLines.push(lines[i].trim());
        i++;
      }

      const tableComponent = buildDocxTable(tableLines, activeFont, textWidthMm);
      if (tableComponent) {
        docChildren.push(tableComponent);
        docChildren.push(new Paragraph({ spacing: { after: 0, line: 160, lineRule: LINE_RULE }, children: [] }));
      }
      continue;
    }

    const { text: cleanLine, isCentered: tagCentered } = sanitizeText(trimmed);
    if (!cleanLine) {
      i++;
      continue;
    }

    const lineIsAr = isArabic(cleanLine) || (docIsArabic && !/^[A-Za-z0-9\s.,'?!:;()\-*]+$/.test(cleanLine));

    // 2. Heading Level 1 (# Heading / Basmala)
    if (/^#\s/.test(trimmed) || cleanLine.startsWith("بسم الله")) {
      docChildren.push(
        new Paragraph({
          bidirectional: isArabic(cleanLine),
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 60, line: 240 },
          children: parseInlineRuns(cleanLine, SIZE_BASMALA, "000000", true, activeFont),
        })
      );
      i++;
      continue;
    }

    // 3. Heading Level 2 (## Title)
    if (/^##\s/.test(trimmed) || cleanLine.includes("عقد زواج") || cleanLine.includes("عقد إيجار")) {
      docChildren.push(
        new Paragraph({
          bidirectional: isArabic(cleanLine),
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 160, line: 240 },
          children: parseInlineRuns(cleanLine, SIZE_TITLE, "000000", true, activeFont),
        })
      );
      i++;
      continue;
    }

    // 4. Contract clauses & articles ("البند الأول", "المادة الأولى")
    const isClauseHeading =
      /^###\s/.test(trimmed) ||
      /^(<u>)?\s*البند\s+(الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر)/.test(cleanLine) ||
      /^(<u>)?\s*المادة\s+(الأولى|الثانية|الثالثة|الرابعة|الخامسة)/.test(cleanLine);

    if (isClauseHeading) {
      docChildren.push(
        new Paragraph({
          bidirectional: isArabic(cleanLine),
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 0, line: 240 },
          children: parseInlineRuns(cleanLine, SIZE_CLAUSE, "000000", true, activeFont),
        })
      );
      i++;
      continue;
    }

    // 5. Page footer indicator (e.g. "(1)", "(١)", "- 1 -")
    const isPageNumIndicator =
      /^\(?\s*[\d٠-٩]+\s*\)?$/.test(cleanLine) || /^-\s*[\d٠-٩]+\s*-$/.test(cleanLine);
    if (isPageNumIndicator) {
      docChildren.push(
        new Paragraph({
          bidirectional: docIsArabic,
          alignment: AlignmentType.CENTER,
          spacing: { before: 160, after: 0 },
          children: [
            new TextRun({
              text: cleanLine,
              bold: true,
              size: SIZE_BODY,
              font: activeFont,
              rightToLeft: docIsArabic,
              color: "000000",
            }),
          ],
        })
      );
      i++;
      continue;
    }

    // 6. Short label ending with a colon ("أولاً: السيد/", "Remarque :")
    const isPartyOrShortLabel =
      cleanLine.length < 60 &&
      (cleanLine.endsWith(":") || cleanLine.endsWith(":-")) &&
      !cleanLine.includes(".") &&
      !cleanLine.includes(",");

    if (isPartyOrShortLabel) {
      docChildren.push(bodyParagraph(cleanLine, { bold: true, isAr: lineIsAr }));
      i++;
      continue;
    }

    // 7. Regular content line. Printed list markers ("- ", "١- ") stay as written; markdown "* " becomes a bullet
    const bodyText = cleanLine.replace(/^\*\s+/, "• ");
    docChildren.push(bodyParagraph(bodyText, { bold: boldBody, isAr: lineIsAr, centered: tagCentered }));
    i++;
  }

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: activeFont, size: SIZE_BODY, rightToLeft: docIsArabic },
          paragraph: { spacing: { line: LINE_BODY } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(PAGE_W_MM),
              height: convertMillimetersToTwip(PAGE_H_MM),
            },
            margin: {
              top: convertMillimetersToTwip(marginMm),
              bottom: convertMillimetersToTwip(marginMm),
              left: convertMillimetersToTwip(marginMm),
              right: convertMillimetersToTwip(marginMm),
            },
            borders: buildPageBorders(frame),
          },
        },
        children: docChildren,
      },
    ],
  });
}

export async function generateOcrDocx(options: OcrDocxOptions) {
  const blob = await Packer.toBlob(buildOcrDocument(options));
  saveAs(blob, options.fileName || "CopyCat_Extracted_Document.docx");
}
