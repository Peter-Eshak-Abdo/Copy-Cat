import {
  Document,
  Packer,
  Paragraph,
  AlignmentType,
  convertMillimetersToTwip,
  TextRun,
  PageBreak,
} from "docx";
import { saveAs } from "file-saver";

export interface ResearchDocxOptions {
  topic: string;
  rawText: string;
  includeIndex?: boolean;
}

export async function generateResearchDocx(options: ResearchDocxOptions) {
  const { topic, rawText, includeIndex = true } = options;

  // Clean raw AI text from markdown headers & bold stars
  const cleanText = rawText.replace(/[*#]/g, "");
  const lines = cleanText.split("\n");

  const children: Paragraph[] = [];

  // 1. Cover Page Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2000, after: 800 },
      children: [
        new TextRun({
          text: `بحث علمي متكامل وموسع حول:\n\n${topic}`,
          font: "Arial",
          size: 40,
          bold: true,
          rightToLeft: true,
        }),
      ],
    })
  );

  // 2. Index Page
  if (includeIndex) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 400, after: 400 },
        children: [
          new TextRun({
            text: "فهرس وتبويب المحتويات",
            font: "Arial",
            size: 32,
            bold: true,
            rightToLeft: true,
          }),
        ],
      })
    );

    const indexItems = [
      "• مقدمة البحث الأكاديمية .................................................. صفحة 3",
      "• المبحث الأول: الإطار المفاهيمي والنظري .............................. صفحة 4",
      "• المبحث الثاني: الأبعاد والتحليلات التطبيقية ........................... صفحة 6",
      "• المبحث الثالث: التحديات والآفاق المستقبلية .......................... صفحة 8",
      "• الخاتمة والنتائج والتوصيات المترتبة .................................... صفحة 10",
      "• قائمة المصادر والمراجع العلمية ........................................... صفحة 11",
    ];

    indexItems.forEach((item) => {
      children.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 100, after: 100 },
          children: [
            new TextRun({
              text: item,
              font: "Arial",
              size: 24,
              rightToLeft: true,
            }),
          ],
        })
      );
    });
  }

  // 3. Body Content
  children.push(new Paragraph({ children: [new PageBreak()] }));

  const headingKeywords = [
    "المبحث",
    "مقدمة",
    "خاتمة",
    "المصادر",
    "تمهيد",
    "أولاً",
    "ثانياً",
    "ثالثاً",
    "رابعاً",
    "الفصل",
  ];

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const isHeading = headingKeywords.some((kw) => trimmed.includes(kw));

    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: isHeading ? 300 : 120, after: isHeading ? 180 : 120 },
        children: [
          new TextRun({
            text: trimmed,
            font: "Arial",
            size: isHeading ? 30 : 24,
            bold: isHeading,
            rightToLeft: true,
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
            margin: {
              top: convertMillimetersToTwip(25),
              bottom: convertMillimetersToTwip(25),
              left: convertMillimetersToTwip(25),
              right: convertMillimetersToTwip(25),
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeFilename = `Research_${topic.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "_").slice(0, 20)}.docx`;
  saveAs(blob, safeFilename);
}
