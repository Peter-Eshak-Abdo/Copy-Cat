import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  convertMillimetersToTwip,
  BorderStyle,
  PageBreak,
} from "docx";
import { saveAs } from "file-saver";

export interface VocabItem {
  word: string;
  meaning?: string;
}

export type SchoolSheetConfig = {
  schoolName?: string;
  teacherName?: string;
  subject?: string;
  grade?: string;
  instructions?: string;
  modelAWords: (string | VocabItem)[];
  modelBWords: (string | VocabItem)[];
  fileName?: string;
};

export type SchoolSheetsOptions = SchoolSheetConfig;

function buildSheetSection(
  modelName: string,
  words: VocabItem[],
  header: { schoolName?: string; teacherName?: string; subject?: string; grade?: string }
): Paragraph[] {
  const elements: Paragraph[] = [];

  // Header Box
  elements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: header.schoolName || "مكتبة كوبي كات للخدمات التعليمية",
          bold: true,
          size: 32, // 16pt
          font: "Arial",
          rightToLeft: true,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [
        new TextRun({
          text: `المادة: ${header.subject || "اللغة العربية"} | الصف: ${
            header.grade || "العام الدراسي 2025/2026"
          } | إشراف: ${header.teacherName || "المعلم الفاضل"}`,
          size: 24, // 12pt
          font: "Arial",
          color: "475569",
          rightToLeft: true,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 250 },
      children: [
        new TextRun({
          text: `★ شيت تقييم ومفردات — ${modelName} ★`,
          bold: true,
          size: 36, // 18pt
          font: "Arial",
          color: "1e3a8a",
          rightToLeft: true,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: "اسم الطالب: ................................................................   الفصل: ...................   الدرجة: ........ / 20",
          bold: true,
          size: 26, // 13pt
          font: "Arial",
          rightToLeft: true,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 200, before: 100 },
      children: [
        new TextRun({
          text: "السؤال: اكتب معنى / مضاد الكلمات الآتية في المكان المخصص:",
          bold: true,
          size: 28, // 14pt
          font: "Arial",
          color: "0f172a",
          rightToLeft: true,
        }),
      ],
    })
  );

  return elements;
}

function buildVocabTable(words: VocabItem[]): Table {
  const tableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          shading: { fill: "1e293b" },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "م", bold: true, color: "ffffff", size: 24, font: "Arial" }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 45, type: WidthType.PERCENTAGE },
          shading: { fill: "1e293b" },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "الكلمة / المفردة",
                  bold: true,
                  color: "ffffff",
                  size: 24,
                  font: "Arial",
                  rightToLeft: true,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 45, type: WidthType.PERCENTAGE },
          shading: { fill: "1e293b" },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "المعنى / الإجابة",
                  bold: true,
                  color: "ffffff",
                  size: 24,
                  font: "Arial",
                  rightToLeft: true,
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  words.forEach((item, index) => {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            shading: { fill: index % 2 === 0 ? "f8fafc" : "ffffff" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: String(index + 1), size: 24, font: "Arial", bold: true }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            shading: { fill: index % 2 === 0 ? "f8fafc" : "ffffff" },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 80, after: 80 },
                children: [
                  new TextRun({
                    text: item.word,
                    bold: true,
                    size: 32, // 16pt for clear reading
                    font: "Arial",
                    rightToLeft: true,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            shading: { fill: index % 2 === 0 ? "f8fafc" : "ffffff" },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: item.meaning ? `(${item.meaning})` : "..................................",
                    size: 24,
                    color: item.meaning ? "334155" : "94a3b8",
                    font: "Arial",
                    rightToLeft: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  });
}

export async function generateSchoolSheetsDocx(options: SchoolSheetsOptions) {
  const normalize = (items: (string | VocabItem)[]): VocabItem[] =>
    items.map((item) => (typeof item === "string" ? { word: item } : item));

  const wordsA = normalize(options.modelAWords);
  const wordsB = normalize(options.modelBWords);

  const headerInfo = {
    schoolName: options.schoolName,
    teacherName: options.teacherName,
    subject: options.subject,
    grade: options.grade,
  };

  const modelAParagraphs = buildSheetSection("نموذج ( أ )", wordsA, headerInfo);
  const modelATable = buildVocabTable(wordsA);

  const modelBParagraphs = buildSheetSection("نموذج ( ب )", wordsB, headerInfo);
  const modelBTable = buildVocabTable(wordsB);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(210),
              height: convertMillimetersToTwip(297),
            },
            margin: {
              top: convertMillimetersToTwip(12.7),
              bottom: convertMillimetersToTwip(12.7),
              left: convertMillimetersToTwip(12.7),
              right: convertMillimetersToTwip(12.7),
            },
            borders: {
              pageBorders: { display: "allPages", zOrder: "front" },
              pageBorderTop: { style: BorderStyle.SINGLE, size: 8, color: "334155", space: 14 },
              pageBorderBottom: { style: BorderStyle.SINGLE, size: 8, color: "334155", space: 14 },
              pageBorderLeft: { style: BorderStyle.SINGLE, size: 8, color: "334155", space: 14 },
              pageBorderRight: { style: BorderStyle.SINGLE, size: 8, color: "334155", space: 14 },
            },
          },
        },
        children: [
          ...modelAParagraphs,
          modelATable,
          new Paragraph({ children: [new PageBreak()] }),
          ...modelBParagraphs,
          modelBTable,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, options.fileName || "CopyCat_School_Vocabulary_Sheets.docx");
}
