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
} from "docx";
import { saveAs } from "file-saver";

export interface OcrDocxOptions {
  title?: string;
  rawText?: string;
  content?: string;
  fileName?: string;
  font?: string;
  hasPageBorder?: boolean;
  language?: "ar" | "en" | "fr" | "auto";
}

export const FALLBACK_FONT = "Arial";

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
function buildContractPhotoHeader(tableLines: string[], fontName: string = FALLBACK_FONT): Table {
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
    top: { style: BorderStyle.SINGLE, size: 8, color: "1E293B" },
    bottom: { style: BorderStyle.SINGLE, size: 8, color: "1E293B" },
    left: { style: BorderStyle.SINGLE, size: 8, color: "1E293B" },
    right: { style: BorderStyle.SINGLE, size: 8, color: "1E293B" },
  };

  const cells: TableCell[] = firstRow.map((content, idx) => {
    const isSideBox = idx === 0 || idx === cellCount - 1;
    const isPhotoCell = isSideBox && (content.includes("صورة") || content.length < 25);

    if (isPhotoCell) {
      return new TableCell({
        width: { size: 22, type: WidthType.PERCENTAGE },
        borders: photoBorder,
        verticalAlign: VerticalAlign.CENTER,
        margins: {
          top: convertMillimetersToTwip(14),
          bottom: convertMillimetersToTwip(14),
          left: convertMillimetersToTwip(3),
          right: convertMillimetersToTwip(3),
        },
        children: [
          new Paragraph({
            bidirectional: true,
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 80 },
            children: [
              new TextRun({
                text: content.replace(/\[|\]/g, "").trim(),
                bold: true,
                size: 26,
                font: fontName,
                rightToLeft: true,
                color: "1E293B",
              }),
            ],
          }),
        ],
      });
    }

    const titleLines = content.split(/\n+/).filter(Boolean);
    const titleParagraphs = titleLines.map((tLine, pIdx) => {
      const isMainHeading = pIdx > 0 || !tLine.includes("الرحمن");
      return new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.CENTER,
        spacing: { before: isMainHeading ? 60 : 30, after: isMainHeading ? 80 : 50, line: 300 },
        children: [
          new TextRun({
            text: tLine.trim(),
            bold: true,
            size: isMainHeading ? 58 : 36,
            font: fontName,
            rightToLeft: true,
            color: "0F172A",
          }),
        ],
      });
    });

    return new TableCell({
      width: { size: cellCount === 3 ? 56 : 78, type: WidthType.PERCENTAGE },
      borders: noBorder,
      verticalAlign: VerticalAlign.CENTER,
      children: titleParagraphs.length > 0 ? titleParagraphs : [new Paragraph({ children: [] })],
    });
  });

  return new Table({
    visuallyRightToLeft: true,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorder,
    rows: [new TableRow({ children: cells })],
  });
}

/**
 * Converts a standard block of markdown table lines into a clean DOCX Table
 * Sets RTL for Arabic tables and LTR for Latin (French/English) tables
 */
function buildDocxTable(tableLines: string[], fontName: string = FALLBACK_FONT): Table | null {
  if (isPhotoHeaderTable(tableLines)) {
    return buildContractPhotoHeader(tableLines, fontName);
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
 * Generate high-fidelity DOCX document preserving exact layout, tables, font hierarchy, and styles.
 * Adheres strictly to Requirement #4:
 * - Detects/uses font or falls back to "Arial".
 * - For Arabic: RTL direction and align Right.
 * - For French / English / Latin: LTR direction and align Left.
 * - Leaves out arbitrary double borders unless requested (hasPageBorder === true).
 */
export async function generateOcrDocx({
  title,
  rawText,
  content,
  fileName = "CopyCat_Extracted_Document.docx",
  font,
  hasPageBorder = false,
  language = "auto",
}: OcrDocxOptions) {
  const fullText = rawText || content || "";
  const lines = fullText.split(/\r?\n/).map((l) => l.trimEnd());
  const docIsArabic = language === "ar" ? true : language === "en" || language === "fr" ? false : isArabic(fullText);

  // Requirement #4: Use detected font or fallback to "Arial"
  const activeFont = font && font.trim() && font.trim().toLowerCase() !== "auto" ? font.trim() : FALLBACK_FONT;

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
            size: 36, // 18pt
            font: activeFont,
            color: "0F172A",
            rightToLeft: isTitleAr,
          }),
        ],
      })
    );
  }

  // Iterate line by line with state tracking for tables
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line
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
      // If it's a page separator header, handle page break
      if (docChildren.length > 0) {
        docChildren.push(
          new Paragraph({
            pageBreakBefore: true,
            children: [],
          })
        );
      }
      i++;
      continue;
    }

    // 1. Check for Table block
    if (isTableRow(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        tableLines.push(lines[i].trim());
        i++;
      }

      const tableComponent = buildDocxTable(tableLines, activeFont);
      if (tableComponent) {
        docChildren.push(tableComponent);
        docChildren.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [],
          })
        );
      }
      continue;
    }

    const { text: cleanLine, isCentered: tagCentered } = sanitizeText(trimmed);
    if (!cleanLine) {
      i++;
      continue;
    }

    // Determine direction and alignment:
    // If line has Arabic -> RTL & Align Right
    // If Latin (French / English) -> LTR & Align Left
    const lineIsAr = isArabic(cleanLine) || (docIsArabic && !/^[A-Za-z0-9\s.,'?!:;()\-*]+$/.test(cleanLine));

    // 2. Heading Level 1 (# Heading)
    if (trimmed.startsWith("# ") || cleanLine.startsWith("بسم الله")) {
      const headingText = cleanLine.replace(/^#\s+/, "");
      docChildren.push(
        new Paragraph({
          bidirectional: isArabic(headingText),
          alignment: AlignmentType.CENTER,
          spacing: { before: 140, after: 80, line: 260 },
          children: parseInlineRuns(headingText, 32, "0F172A", true, activeFont),
        })
      );
      i++;
      continue;
    }

    // 3. Heading Level 2 (## Heading)
    if (trimmed.startsWith("## ") || cleanLine.includes("عقد زواج") || cleanLine.includes("عقد إيجار")) {
      const headingText = cleanLine.replace(/^##\s+/, "");
      docChildren.push(
        new Paragraph({
          bidirectional: isArabic(headingText),
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 80, line: 260 },
          children: parseInlineRuns(headingText, 36, "0F172A", true, activeFont),
        })
      );
      i++;
      continue;
    }

    // 4. Contract Clauses & Articles (e.g. "البند الأول", "البند الثاني", "المادة الأولى")
    const isClauseHeading =
      trimmed.startsWith("### ") ||
      /^البند\s+(الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر)/.test(cleanLine) ||
      /^المادة\s+(الأولى|الثانية|الثالثة|الرابعة|الخامسة)/.test(cleanLine);

    if (isClauseHeading) {
      const headingText = cleanLine.replace(/^###\s+/, "");
      docChildren.push(
        new Paragraph({
          bidirectional: isArabic(headingText),
          alignment: AlignmentType.CENTER,
          spacing: { before: 160, after: 70, line: 280 },
          children: parseInlineRuns(headingText, 32, "0F172A", true, activeFont),
        })
      );
      i++;
      continue;
    }

    // 5. Short heading with colon (e.g. "أولاً: السيد/", "Question 1:", "Remarque :")
    const isPartyOrShortLabel =
      cleanLine.length < 60 &&
      (cleanLine.endsWith(":") || cleanLine.endsWith(":-")) &&
      !cleanLine.includes(".") &&
      !cleanLine.includes(",");

    if (isPartyOrShortLabel) {
      docChildren.push(
        new Paragraph({
          bidirectional: lineIsAr,
          alignment: lineIsAr ? AlignmentType.RIGHT : AlignmentType.LEFT,
          spacing: { before: 90, after: 50, line: 280 },
          children: parseInlineRuns(cleanLine, 28, "0F172A", true, activeFont),
        })
      );
      i++;
      continue;
    }

    // 6. Page footer indicator (e.g. "(1)", "(2)", "- 1 -")
    const isPageNumIndicator = /^\(?\s*\d+\s*\)?$/.test(cleanLine) || /^-\s*\d+\s*-$/.test(cleanLine);
    if (isPageNumIndicator) {
      docChildren.push(
        new Paragraph({
          bidirectional: false,
          alignment: AlignmentType.CENTER,
          spacing: { before: 140, after: 40 },
          children: [
            new TextRun({
              text: cleanLine,
              bold: true,
              size: 22,
              font: activeFont,
              color: "475569",
            }),
          ],
        })
      );
      i++;
      continue;
    }

    // 7. Bullet or Numbered List Item
    const isBullet = cleanLine.startsWith("- ") || cleanLine.startsWith("* ") || cleanLine.startsWith("• ");
    const isNumbered = /^\d+[\.\)]\s+/.test(cleanLine);

    if (isBullet || isNumbered) {
      const listContent = cleanLine.replace(/^[-*•]\s+/, "").replace(/^\d+[\.\)]\s+/, "");
      const prefix = isBullet ? "• " : cleanLine.match(/^\d+[\.\)]\s+/)?.[0] || "";

      docChildren.push(
        new Paragraph({
          bidirectional: lineIsAr,
          alignment: lineIsAr ? AlignmentType.RIGHT : AlignmentType.LEFT,
          indent: lineIsAr
            ? { right: convertMillimetersToTwip(4) }
            : { left: convertMillimetersToTwip(4) },
          spacing: { before: 40, after: 50, line: 260 },
          children: [
            new TextRun({
              text: prefix,
              bold: true,
              size: 26,
              font: activeFont,
              rightToLeft: lineIsAr,
              color: "0F172A",
            }),
            ...parseInlineRuns(listContent, 26, "0F172A", false, activeFont),
          ],
        })
      );
      i++;
      continue;
    }

    // 8. Regular Content Paragraph
    // Requirement #4: Align Right for Arabic, Align Left for English / French
    docChildren.push(
      new Paragraph({
        bidirectional: lineIsAr,
        alignment: tagCentered
          ? AlignmentType.CENTER
          : lineIsAr
          ? AlignmentType.RIGHT
          : AlignmentType.LEFT,
        spacing: { before: 40, after: 60, line: 280 },
        children: parseInlineRuns(cleanLine, 26, "0F172A", false, activeFont),
      })
    );

    i++;
  }

  // Page borders config: only applied if hasPageBorder is true (e.g. legal contracts)
  const pageBordersConfig = hasPageBorder
    ? {
        pageBorders: {
          display: "allPages" as const,
          zOrder: "front" as const,
        },
        pageBorderTop: {
          style: BorderStyle.DOUBLE,
          size: 12,
          color: "1E293B",
          space: 14,
        },
        pageBorderBottom: {
          style: BorderStyle.DOUBLE,
          size: 12,
          color: "1E293B",
          space: 14,
        },
        pageBorderLeft: {
          style: BorderStyle.DOUBLE,
          size: 12,
          color: "1E293B",
          space: 14,
        },
        pageBorderRight: {
          style: BorderStyle.DOUBLE,
          size: 12,
          color: "1E293B",
          space: 14,
        },
      }
    : undefined;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(210), // A4 width
              height: convertMillimetersToTwip(297), // A4 height
            },
            // Clean standard printable margins (15mm)
            margin: {
              top: convertMillimetersToTwip(15),
              bottom: convertMillimetersToTwip(15),
              left: convertMillimetersToTwip(15),
              right: convertMillimetersToTwip(15),
            },
            borders: pageBordersConfig,
          },
        },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
}
