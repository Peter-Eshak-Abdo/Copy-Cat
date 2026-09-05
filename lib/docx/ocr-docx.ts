import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  convertMillimetersToTwip,
  BorderStyle,
} from "docx";
import { saveAs } from "file-saver";

export interface OcrDocxOptions {
  title?: string;
  rawText?: string;
  content?: string;
  fileName?: string;
}

export async function generateOcrDocx({
  title = "مستند مستخرج (Copy-Cat OCR)",
  rawText,
  content,
  fileName = "CopyCat_Extracted_Document.docx",
}: OcrDocxOptions) {
  const fullText = rawText || content || "";
  // Split paragraphs by line break
  const lines = fullText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const paragraphs: Paragraph[] = [];

  // Title paragraph if present
  if (title) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300, before: 100 },
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 40, // 20pt
            font: "Arial",
            color: "0f172a",
            rightToLeft: true,
          }),
        ],
      })
    );
  }

  // Content paragraphs: 18pt (size: 36 in half-points), Narrow margins, RTL
  lines.forEach((line) => {
    // Check if line looks like a header (short and bold-like)
    const isHeading = line.startsWith("#") || (line.length < 50 && line.endsWith(":"));
    const cleanLine = line.replace(/^#+\s*/, "");

    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: isHeading ? 200 : 160, line: 360 }, // 1.5 line spacing
        children: [
          new TextRun({
            text: cleanLine,
            bold: isHeading,
            size: isHeading ? 40 : 36, // 18pt body, 20pt heading
            font: "Arial",
            rightToLeft: true,
            color: isHeading ? "1e293b" : "334155",
          }),
        ],
      })
    );
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(210), // A4: 210mm
              height: convertMillimetersToTwip(297), // A4: 297mm
            },
            // Narrow Margins: 12.7mm = 0.5 inch = 720 twips
            margin: {
              top: convertMillimetersToTwip(12.7),
              bottom: convertMillimetersToTwip(12.7),
              left: convertMillimetersToTwip(12.7),
              right: convertMillimetersToTwip(12.7),
            },
            // Page Borders: Elegant thin solid border around page
            borders: {
              pageBorders: {
                display: "allPages",
                zOrder: "front",
              },
              pageBorderTop: {
                style: BorderStyle.SINGLE,
                size: 12, // 1.5 pt
                color: "1e293b",
                space: 18,
              },
              pageBorderBottom: {
                style: BorderStyle.SINGLE,
                size: 12,
                color: "1e293b",
                space: 18,
              },
              pageBorderLeft: {
                style: BorderStyle.SINGLE,
                size: 12,
                color: "1e293b",
                space: 18,
              },
              pageBorderRight: {
                style: BorderStyle.SINGLE,
                size: 12,
                color: "1e293b",
                space: 18,
              },
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
}
