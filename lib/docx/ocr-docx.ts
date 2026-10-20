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
} from "docx";
import { saveAs } from "file-saver";

export interface OcrDocxOptions {
  title?: string;
  rawText?: string;
  content?: string;
  fileName?: string;
}

const PRIMARY_FONT = "Traditional Arabic";

/**
 * Cleans raw HTML tags (e.g. <center>, <br>, <span>, <div>, ###) from text
 */
function sanitizeText(raw: string): { text: string; isCentered: boolean } {
  const isCentered = /<center>/i.test(raw) || /<\/center>/i.test(raw);
  const cleaned = raw
    .replace(/<\/?center>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(span|div|p|strong|b|em|i)[^>]*>/gi, "")
    .replace(/###\s*/g, "")
    .replace(/##\s*/g, "")
    .replace(/#\s*/g, "")
    .trim();

  return { text: cleaned, isCentered };
}

/**
 * Checks whether text contains Arabic characters
 */
export function isArabic(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * Parses inline formatting like **bold text** into docx TextRuns
 */
function parseInlineRuns(
  text: string,
  baseSize: number,
  baseColor: string,
  isParentBold: boolean = false
): TextRun[] {
  const isAr = isArabic(text);
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*.*?\*\*|__.*?__)/g);

  for (const part of parts) {
    if (!part) continue;
    const partIsAr = isArabic(part);
    const font = partIsAr ? PRIMARY_FONT : "Calibri";
    if (
      (part.startsWith("**") && part.endsWith("**")) ||
      (part.startsWith("__") && part.endsWith("__"))
    ) {
      const inner = part.slice(2, -2).trim();
      runs.push(
        new TextRun({
          text: inner,
          bold: true,
          size: baseSize,
          font,
          rightToLeft: partIsAr,
          color: baseColor,
        })
      );
    } else {
      runs.push(
        new TextRun({
          text: part,
          bold: isParentBold,
          size: baseSize,
          font,
          rightToLeft: partIsAr,
          color: baseColor,
        })
      );
    }
  }

  if (runs.length === 0) {
    runs.push(
      new TextRun({
        text,
        bold: isParentBold,
        size: baseSize,
        font: isAr ? PRIMARY_FONT : "Calibri",
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
function buildContractPhotoHeader(tableLines: string[]): Table {
  // Collect all cells
  const allRowsCells: string[][] = [];
  for (const line of tableLines) {
    if (isTableSeparator(line)) continue;
    const cells = line
      .split("|")
      .map((c) => sanitizeText(c).text)
      .slice(1, -1);
    if (cells.length > 0) allRowsCells.push(cells);
  }

  // Normalize photo header cells for Egyptian contracts:
  // In an RTL table (visuallyRightToLeft: true), cell 0 is placed physically on the RIGHT,
  // cell 1 is in the MIDDLE, and cell 2 is placed physically on the LEFT.
  // In Egyptian contracts: Right box is "صورة الزوج", Middle is Title, Left box is "صورة الزوجة".
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
      // Photo Placeholder Box (22% width, bordered, neat 4x6 proportion: ~35mm x 45mm)
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
                size: 26, // 13pt bold
                font: PRIMARY_FONT,
                rightToLeft: true,
                color: "1E293B",
              }),
            ],
          }),
        ],
      });
    }

    // Center Title Cell (no border, large centered title)
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
            size: isMainHeading ? 58 : 36, // 29pt for contract title, 18pt for Basmala
            font: PRIMARY_FONT,
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
 */
function buildDocxTable(tableLines: string[]): Table | null {
  if (isPhotoHeaderTable(tableLines)) {
    return buildContractPhotoHeader(tableLines);
  }

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
            bidirectional: isArabic(cellContent),
            alignment: isHeader
              ? AlignmentType.CENTER
              : isArabic(cellContent)
              ? AlignmentType.RIGHT
              : AlignmentType.LEFT,
            spacing: { before: 40, after: 40, line: 240 },
            children: parseInlineRuns(
              cellContent,
              isHeader ? 24 : 22,
              isHeader ? "0F172A" : "334155",
              isHeader
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
    visuallyRightToLeft: true,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    rows,
  });
}

/**
 * Generate high-fidelity DOCX document preserving exact layout, tables, font hierarchy, and styles
 */
export async function generateOcrDocx({
  title,
  rawText,
  content,
  fileName = "CopyCat_Extracted_Document.docx",
}: OcrDocxOptions) {
  const fullText = rawText || content || "";
  const lines = fullText.split(/\r?\n/).map((l) => l.trimEnd());
  const docIsArabic = isArabic(fullText);

  const docChildren: (Paragraph | Table)[] = [];

  // Filter out unwanted auto-generated technical filenames (e.g. f2f62128..., مستند_مستخرج_...)
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
            font: isTitleAr ? PRIMARY_FONT : "Calibri",
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

    // 1. Check for Table block
    if (isTableRow(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        tableLines.push(lines[i].trim());
        i++;
      }

      const tableComponent = buildDocxTable(tableLines);
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

    const lineIsAr = isArabic(cleanLine) || docIsArabic;

    // 2. Heading Level 1 (# Heading)
    if (trimmed.startsWith("# ") || cleanLine.startsWith("بسم الله")) {
      const headingText = cleanLine.replace(/^#\s+/, "");
      docChildren.push(
        new Paragraph({
          bidirectional: isArabic(headingText),
          alignment: AlignmentType.CENTER,
          spacing: { before: 140, after: 80, line: 260 },
          children: parseInlineRuns(headingText, 32, "0F172A", true), // 16pt
        })
      );
      i++;
      continue;
    }

    // 3. Heading Level 2 (## Heading or contract title)
    if (trimmed.startsWith("## ") || cleanLine.includes("عقد زواج") || cleanLine.includes("عقد إيجار")) {
      const headingText = cleanLine.replace(/^##\s+/, "");
      docChildren.push(
        new Paragraph({
          bidirectional: isArabic(headingText),
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 80, line: 260 },
          children: parseInlineRuns(headingText, 36, "0F172A", true), // 18pt bold
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
          spacing: { before: 180, after: 70, line: 280 },
          children: parseInlineRuns(headingText, 36, "0F172A", true), // 18pt bold centered
        })
      );
      i++;
      continue;
    }

    // 5. Short heading with colon (e.g. "أولاً: السيد/", "ثانياً: السيدة/")
    const isPartyOrShortLabel =
      cleanLine.length < 50 &&
      (cleanLine.endsWith(":") || cleanLine.endsWith(":-")) &&
      !cleanLine.includes(".");

    if (isPartyOrShortLabel) {
      docChildren.push(
        new Paragraph({
          bidirectional: lineIsAr,
          alignment: lineIsAr ? AlignmentType.RIGHT : AlignmentType.LEFT,
          spacing: { before: 90, after: 50, line: 280 },
          children: parseInlineRuns(cleanLine, 29, "0F172A", true), // 14.5pt bold
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
          spacing: { before: 160, after: 40 },
          children: [
            new TextRun({
              text: cleanLine,
              bold: true,
              size: 24, // 12pt
              font: PRIMARY_FONT,
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
          spacing: { before: 50, after: 60, line: 280 },
          children: [
            new TextRun({
              text: prefix,
              bold: true,
              size: 27, // 13.5pt
              font: lineIsAr ? PRIMARY_FONT : "Calibri",
              rightToLeft: lineIsAr,
              color: "0F172A",
            }),
            ...parseInlineRuns(listContent, 27, "0F172A", false),
          ],
        })
      );
      i++;
      continue;
    }

    // 8. Regular Content Paragraph (13.5pt Traditional Arabic with 1.25x line spacing)
    docChildren.push(
      new Paragraph({
        bidirectional: lineIsAr,
        alignment: tagCentered ? AlignmentType.CENTER : lineIsAr ? AlignmentType.RIGHT : AlignmentType.LEFT,
        spacing: { before: 50, after: 70, line: 290 }, // 1.25x line spacing - gracefully fills ~90% of page!
        children: parseInlineRuns(cleanLine, 27, "0F172A", false), // 13.5pt crisp Traditional Arabic
      })
    );

    i++;
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(210), // A4: 210mm
              height: convertMillimetersToTwip(297), // A4: 297mm
            },
            // Professional tight margins (12mm) to ensure 1-page contracts fit completely
            margin: {
              top: convertMillimetersToTwip(12),
              bottom: convertMillimetersToTwip(12),
              left: convertMillimetersToTwip(12),
              right: convertMillimetersToTwip(12),
            },
            // Elegant double page border for legal contracts and official documents
            borders: {
              pageBorders: {
                display: "allPages",
                zOrder: "front",
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
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
}
