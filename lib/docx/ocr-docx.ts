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
  VerticalAlign,
  UnderlineType,
  Tab,
  TabStopType,
  TableLayoutType,
  HeightRule,
  PageBorderOffsetFrom,
  LineRuleType,
  LeaderType,
  Math as OMath,
  ImageRun,
  ParagraphChild,
  PageOrientation,
} from "docx";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { latexToPieces, latexToPlain, patchEquationRunFonts, splitMath } from "./latex-math";

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
  /** Figures cropped from the scan, keyed by the number in their "[شكل n]" / "[FIGURE n]" line */
  figures?: Record<number, OcrFigure>;
  /** Landscape A4 (wide forms and tables scanned sideways) */
  landscape?: boolean;
}

export interface OcrFigure {
  /** PNG or JPEG data URL of the cropped figure */
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  /** Figure width as a fraction of the scanned page width (keeps its printed size) */
  widthFrac: number;
}

/** "[شكل 3]" / "[FIGURE 3]" placeholder line for a cropped figure */
export const FIGURE_LINE = /^\[(?:شكل|FIGURE|Figure)\s*(\d+)\]$/;

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

const A4_SHORT_MM = 210;
const A4_LONG_MM = 297;

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
    // Heading size ratio ("{1.8}") is layout data, never printed
    .replace(/\s*\{\s*\d+(?:\.\d+)?\s*\}/g, "")
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
/** A date with three parts: 1975/4/30, ٣٠-٤-١٩٧٥ (captured so split() keeps it) */
const DATE_RE = /([0-9٠-٩]{1,4}[/\-][0-9٠-٩]{1,2}[/\-][0-9٠-٩]{1,4})/;

function parseInlineRuns(
  text: string,
  baseSize: number,
  baseColor: string,
  isParentBold: boolean = false,
  fontName: string = FALLBACK_FONT
): ParagraphChild[] {
  const tokens = tokenizeFormattedText(text, isParentBold);
  const runs: ParagraphChild[] = [];
  // In an Arabic line, operator / digit runs between equations ("+", " = ") must be right-to-left too:
  // left-to-right they merged with the equations into one LTR block and printed "١/٤ = ٣/٤ +"
  const lineIsRtl = isArabic(text);

  const textRunProps = (token: InlineToken) => ({
    bold: token.bold,
    italics: token.italic,
    underline: token.underline ? { type: UnderlineType.SINGLE } : undefined,
    size: baseSize,
    font: fontName,
    color: baseColor,
  });
  const textRun = (t: string, token: InlineToken) =>
    new TextRun({ ...textRunProps(token), text: t, rightToLeft: isArabic(t) || (lineIsRtl && !/[A-Za-z]/.test(t)) });

  for (const token of tokens) {
    // $...$ math: fractions / powers / roots become Word equations, the rest stays text in reading order
    for (const part of splitMath(token.text)) {
      if (!part.math) {
        // Dates ("١٩٧٥/٤/٣٠") stay one left-to-right block: inside a right-to-left run Word flips them
        // to "٣٠/٤/١٩٧٥"
        for (const [k, piece] of part.s.split(DATE_RE).entries()) {
          if (!piece) continue;
          runs.push(k % 2 ? new TextRun({ ...textRunProps(token), text: piece, rightToLeft: false }) : textRun(piece, token));
        }
        continue;
      }
      for (const piece of latexToPieces(part.s)) {
        if (piece.kind === "text") runs.push(textRun(piece.text, token));
        else runs.push(new OMath({ children: piece.components }));
      }
    }
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
function measureTextMm(rawText: string, sizeHalfPts: number, bold: boolean, fontName: string): number {
  const text = splitMath(rawText).map((p) => (p.math ? latexToPlain(p.s) : p.s)).join("");
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
const NEW_ITEM_START =
  /^(\*\*)?(أولاً|ثانياً|ثالثاً|رابعاً|خامساً|ويحمل|وتحمل|السؤال|س\s*[0-9٠-٩]+|\(?[0-9٠-٩]+\s*[-.)/]|\([أ-ي]{1,2}\)|[أ-ي]\s*[-)]|[A-Za-z][.)]\s|[-*•]\s|\[)/;

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
    /<center>/i.test(l) ||
    /^\[/.test(l) ||
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

/**
 * "$\frac{١}{٤} + \frac{٣}{٤} = .........$": a dotted answer blank written inside the maths is moved out
 * of it, so it is sized and placed like any other blank (inside, it was stretched mid-equation).
 */
function liftBlanksOutOfMath(line: string): string {
  return splitMath(line)
    .map((part) => {
      if (!part.math) return part.s;
      return part.s
        .split(/(\.{3,}|…+)/)
        .map((seg, k) => (k % 2 === 1 ? ` ${seg} ` : seg.trim() ? `$${seg.trim()}$` : ""))
        .join("")
        .replace(/\s{2,}/g, " ");
    })
    .join("")
    .replace(/\s+$/, "");
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

  const cellRows = tableLines
    .filter((line) => !isTableSeparator(line))
    .map((line) =>
      line
        .split("|")
        .map((c) => sanitizeText(c).text)
        .slice(1, -1)
    )
    .filter((cells) => cells.length > 0);
  if (cellRows.length === 0) return null;

  // Column widths follow the longest entry in each column (names and jobs need more room than dates),
  // with a floor so an empty or one-word column stays usable
  const colCount = Math.max(...cellRows.map((r) => r.length));
  const plain = (c: string) => c.replace(/<[^>]+>|\*\*|\$/g, "").trim();
  const colWeights = Array.from({ length: colCount }, (_, k) =>
    Math.max(6, ...cellRows.map((r) => Math.min(40, plain(r[k] || "").length)))
  );
  const weightSum = colWeights.reduce((a, b) => a + b, 0);
  const colPercents = colWeights.map((w) => Math.max(7, (w / weightSum) * 100));
  // Long tables (family lists, grades, schedules) are printed with tight rows so the form fits one page
  const dense = cellRows.length > 8;
  const padV = convertMillimetersToTwip(dense ? 0.4 : 2);
  // Printed tables (exam grids, schedules, forms) use thin black rules; bold comes only from ** in a cell
  const rule = { style: BorderStyle.SINGLE, size: 6, color: "000000" };

  const rows = cellRows.map(
    (rawCells, rowIdx) =>
      new TableRow({
        tableHeader: rowIdx === 0,
        children: rawCells.map((cellContent, k) => {
          const cellIsAr = isArabic(cellContent);
          // Short entries (numbers, single words) sit centred in their cell as on printed grids
          const plainLen = plain(cellContent).length;
          return new TableCell({
            width: { size: Math.round(convertMillimetersToTwip(((colPercents[k] ?? 10) / colPercents.reduce((a, b) => a + b, 0)) * textWidthMm)), type: WidthType.DXA },
            borders: { top: rule, bottom: rule, left: rule, right: rule },
            margins: {
              top: padV,
              bottom: padV,
              left: convertMillimetersToTwip(dense ? 1.5 : 2.5),
              right: convertMillimetersToTwip(dense ? 1.5 : 2.5),
            },
            children: [
              new Paragraph({
                bidirectional: cellIsAr,
                alignment: plainLen <= 25 ? AlignmentType.CENTER : cellIsAr ? AlignmentType.RIGHT : AlignmentType.LEFT,
                // Arabic fonts carry a tall built-in line gap, so dense rows get an exact pitch
                spacing: dense
                  ? { before: 0, after: 0, line: 285, lineRule: LineRuleType.EXACT }
                  : { before: 40, after: 40, line: 240 },
                children: parseInlineRuns(cellContent, SIZE_BODY - 2, "000000", false, fontName),
              }),
            ],
          });
        }),
      })
  );

  if (rows.length === 0) return null;

  const totalPct = colPercents.reduce((a, b) => a + b, 0);
  return new Table({
    visuallyRightToLeft: tableIsAr,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    // Word lays a table out from its grid; percentages on the cells alone are ignored
    columnWidths: colPercents.map((pct) => Math.round(convertMillimetersToTwip((pct / totalPct) * textWidthMm))),
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
  figures,
  landscape = false,
}: OcrDocxOptions): Document {
  const PAGE_W_MM = landscape ? A4_LONG_MM : A4_SHORT_MM;
  const fullText = rawText || content || "";
  const lines = mergeWrappedLines(fullText.split(/\r?\n/).map((l) => liftBlanksOutOfMath(l.trimEnd())));
  const docIsArabic = language === "ar" ? true : language === "en" || language === "fr" ? false : isArabic(fullText);

  const activeFont = font && font.trim() && font.trim().toLowerCase() !== "auto" ? font.trim() : FALLBACK_FONT;

  const frame: PageBorderKind = borderStyle && borderStyle !== "none" ? borderStyle : hasPageBorder ? "double" : "none";
  // Leave room for the art border band so text never collides with it
  const marginMm = landscape ? 12 : frame === "decorative" ? 16 : frame === "none" ? 15 : 18;
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
    // Three or more " || " parts are side-by-side items (multiple-choice options, columns): equal tab columns
    const columns = text.split(TRAILING_SPLIT).filter((p) => p.trim().length > 0);
    const hasMath = /\$[^$]+\$/.test(text);
    // An exact line height clips stacked fractions and powers, so maths lines may grow
    const lineSpacing = { line: LINE_BODY, lineRule: hasMath ? LineRuleType.AT_LEAST : LINE_RULE };
    if (columns.length >= 3) {
      const runs: ParagraphChild[] = [];
      columns.forEach((col, k) => {
        if (k > 0) runs.push(new TextRun({ children: [new Tab()], size: SIZE_BODY, font: activeFont, bold: opts.bold }));
        runs.push(...parseInlineRuns(col.trim(), SIZE_BODY, "000000", opts.bold, activeFont));
      });
      return new Paragraph({
        bidirectional: opts.isAr,
        alignment: opts.isAr ? AlignmentType.RIGHT : AlignmentType.LEFT,
        tabStops: columns.slice(1).map((_, k) => ({
          type: TabStopType.START,
          position: Math.round(((k + 1) * textWidthTwip) / columns.length),
        })),
        spacing: { before: opts.before ?? 0, after: opts.after ?? 0, ...lineSpacing },
        children: runs,
      });
    }
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
    // On legal forms (framed / bold body) every line spans the width, so a nearly full one-line paragraph is
    // "distributed" too; elsewhere that spread single lines (exam questions) into widely spaced words.
    const legalForm = boldBody || frame === "decorative";
    const alignment = opts.centered
      ? AlignmentType.CENTER
      : !opts.isAr
      ? AlignmentType.LEFT
      : hasTab || hasDots
      ? AlignmentType.RIGHT
      : widthMm > textWidthMm
      ? AlignmentType.JUSTIFIED
      : legalForm && widthMm > textWidthMm * 0.8
      ? AlignmentType.DISTRIBUTE
      : AlignmentType.RIGHT;
    return new Paragraph({
      bidirectional: opts.isAr,
      alignment,
      tabStops: hasTab
        ? [{ type: TabStopType.END, position: textWidthTwip, leader: leader ? LeaderType.DOT : undefined }]
        : undefined,
      spacing: { before: opts.before ?? 0, after: opts.after ?? 0, ...lineSpacing },
      children: runs,
    });
  };

  // Heading size from the "{1.4}" ratio the OCR appends (text height relative to body text)
  const headingSize = (line: string, fallback: number) => {
    const m = line.match(/\{\s*(\d+(?:\.\d+)?)\s*\}\s*(<\/center>)?\s*$/);
    if (!m) return fallback;
    const ratio = Math.min(2.4, Math.max(1, parseFloat(m[1])));
    return Math.round((SIZE_BODY * ratio) / 2) * 2;
  };
  const stripSizeTag = (line: string) => line.replace(/\s*\{\s*\d+(?:\.\d+)?\s*\}/, "");

  const figureParagraph = (fig: OcrFigure) => {
    // Printed size: the figure keeps its share of the page width, never wider than the text block
    const widthMm = Math.min(textWidthMm, Math.max(25, fig.widthFrac * PAGE_W_MM));
    const heightMm = (widthMm * fig.heightPx) / Math.max(1, fig.widthPx);
    const mmToPx = (mm: number) => Math.round((mm / 25.4) * 96);
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 60 },
      children: [
        new ImageRun({
          type: fig.dataUrl.startsWith("data:image/png") ? "png" : "jpg",
          data: dataUrlToBytes(fig.dataUrl),
          transformation: { width: mmToPx(widthMm), height: mmToPx(heightMm) },
        }),
      ],
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

    // Figure cropped from the scan; an unresolved "[FIGURE: y, x, y, x]" box is dropped, never printed
    const bare = trimmed.replace(/<\/?center>/gi, "").trim();
    const figMatch = bare.match(FIGURE_LINE);
    if (figMatch || /^\[FIGURE:[^\]]*\]$/i.test(bare)) {
      const fig = figMatch ? figures?.[Number(figMatch[1])] : undefined;
      if (fig) docChildren.push(figureParagraph(fig));
      i++;
      continue;
    }

    const { text: cleanLine, isCentered: tagCentered } = sanitizeText(stripSizeTag(trimmed));
    if (!cleanLine) {
      i++;
      continue;
    }

    const lineIsAr = isArabic(cleanLine) || (docIsArabic && !/^[A-Za-z0-9\s.,'?!:;()\-*]+$/.test(cleanLine));

    // 2. Heading Level 1 (# Heading / Basmala)
    if (/^#\s/.test(bare) || cleanLine.startsWith("بسم الله")) {
      docChildren.push(
        new Paragraph({
          bidirectional: isArabic(cleanLine),
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 60, line: 240 },
          children: parseInlineRuns(cleanLine, headingSize(bare, SIZE_BASMALA), "000000", true, activeFont),
        })
      );
      i++;
      continue;
    }

    // 3. Heading Level 2 (## Title)
    if (/^##\s/.test(bare) || (cleanLine.length < 40 && (cleanLine.includes("عقد زواج") || cleanLine.includes("عقد إيجار")))) {
      docChildren.push(
        new Paragraph({
          bidirectional: isArabic(cleanLine),
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 160, line: 240 },
          children: parseInlineRuns(cleanLine, headingSize(bare, SIZE_TITLE), "000000", true, activeFont),
        })
      );
      i++;
      continue;
    }

    // 4. Contract clauses & articles ("البند الأول", "المادة الأولى")
    const isContractClause =
      /^(<u>)?\s*البند\s+(الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر)/.test(cleanLine) ||
      /^(<u>)?\s*المادة\s+(الأولى|الثانية|الثالثة|الرابعة|الخامسة)/.test(cleanLine);
    const isClauseHeading = /^###\s/.test(bare) || isContractClause;

    if (isClauseHeading) {
      // Contract clauses are centred on the printed forms; other section headings keep their side
      const centered = tagCentered || isContractClause;
      docChildren.push(
        new Paragraph({
          bidirectional: isArabic(cleanLine),
          alignment: centered ? AlignmentType.CENTER : lineIsAr ? AlignmentType.RIGHT : AlignmentType.LEFT,
          spacing: { before: 40, after: 0, line: 240 },
          children: parseInlineRuns(cleanLine, headingSize(bare, SIZE_CLAUSE), "000000", true, activeFont),
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
      docChildren.push(bodyParagraph(cleanLine, { bold: boldBody, isAr: lineIsAr, centered: tagCentered }));
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
              // docx swaps width and height itself for a landscape section
              width: convertMillimetersToTwip(A4_SHORT_MM),
              height: convertMillimetersToTwip(A4_LONG_MM),
              orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
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

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
  return bytes;
}

/** Packs the document and applies the equation font fix (see patchEquationRunFonts) */
export async function packOcrDocx(options: OcrDocxOptions): Promise<Blob> {
  const blob = await Packer.toBlob(buildOcrDocument(options));
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml || !xml.includes("<m:r>")) return blob;
  const font = options.font && options.font.trim() && options.font.toLowerCase() !== "auto" ? options.font.trim() : FALLBACK_FONT;
  zip.file("word/document.xml", patchEquationRunFonts(xml, font, SIZE_BODY));
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export async function generateOcrDocx(options: OcrDocxOptions) {
  saveAs(await packOcrDocx(options), options.fileName || "CopyCat_Extracted_Document.docx");
}
