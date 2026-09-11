import {
  Document,
  Packer,
  Paragraph,
  AlignmentType,
  convertMillimetersToTwip,
  TextRun,
  PageBreak,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  PageBorderDisplay,
  PageBorderZOrder,
  PageBorderOffsetFrom,
} from "docx";
import { saveAs } from "file-saver";

export interface ResearchCoverInfo {
  studentName?: string;
  teacherName?: string;
  gradeOrClass?: string;
  schoolOrUniversity?: string;
  academicYear?: string;
}

export interface ResearchDocxOptions {
  topic: string;
  rawText: string;
  includeIndex?: boolean;
  includeReferences?: boolean;
  coverInfo?: ResearchCoverInfo;
  targetPages?: number;
}

export async function generateResearchDocx(options: ResearchDocxOptions) {
  const {
    topic,
    rawText,
    includeIndex = true,
    includeReferences = true,
    coverInfo = {},
  } = options;

  // Clean raw AI text from markdown stars & headers
  const cleanText = rawText.replace(/[*#]/g, "");
  const rawLines = cleanText.split("\n").map((l) => l.trim()).filter(Boolean);

  const children: (Paragraph | Table)[] = [];

  // =========================================================================
  // 1. Cover Page (صفحة الغلاف الرسمية)
  // =========================================================================
  // Top school / institution header
  if (coverInfo.schoolOrUniversity) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({
            text: coverInfo.schoolOrUniversity,
            font: "Arial",
            size: 32, // 16pt
            bold: true,
            rightToLeft: true,
          }),
        ],
      })
    );
  }

  // Large Centered Title (26pt bold)
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 1800, after: 800 },
      children: [
        new TextRun({
          text: `بحث دراسي متكامل عن:\n`,
          font: "Arial",
          size: 36, // 18pt
          bold: true,
          rightToLeft: true,
        }),
        new TextRun({
          text: topic,
          font: "Arial",
          size: 52, // 26pt bold
          bold: true,
          rightToLeft: true,
          color: "1E3A8A",
        }),
      ],
    })
  );

  // Metadata Box (Student, Teacher, Grade, School)
  const metaRuns: TextRun[] = [];
  if (coverInfo.studentName) {
    metaRuns.push(
      new TextRun({
        text: `إعداد الطالب / الباحث: ${coverInfo.studentName}\n`,
        font: "Arial",
        size: 36, // 18pt
        bold: true,
        rightToLeft: true,
      })
    );
  }
  if (coverInfo.teacherName) {
    metaRuns.push(
      new TextRun({
        text: `إشراف الأستاذ / المشرف: ${coverInfo.teacherName}\n`,
        font: "Arial",
        size: 36,
        bold: true,
        rightToLeft: true,
      })
    );
  }
  if (coverInfo.gradeOrClass) {
    metaRuns.push(
      new TextRun({
        text: `الصف / الفرقة الدراسية: ${coverInfo.gradeOrClass}\n`,
        font: "Arial",
        size: 36,
        rightToLeft: true,
      })
    );
  }
  if (coverInfo.academicYear) {
    metaRuns.push(
      new TextRun({
        text: `العام الدراسي: ${coverInfo.academicYear}\n`,
        font: "Arial",
        size: 32,
        rightToLeft: true,
      })
    );
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 1600, after: 400 },
      children: metaRuns,
    })
  );

  // Page Break after Cover Page
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // =========================================================================
  // 2. Table of Contents / Index (صفحة الفهرس في جدول منظم)
  // =========================================================================
  if (includeIndex) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 300, after: 400 },
        children: [
          new TextRun({
            text: "فهرس وتبويب محتويات البحث",
            font: "Arial",
            size: 44, // 22pt bold
            bold: true,
            rightToLeft: true,
          }),
        ],
      })
    );

    const indexData = [
      { title: "مقدمة البحث التمهيدية", page: "3" },
      { title: "المبحث الأول: الإطار المفاهيمي والنشأة", page: "4" },
      { title: "المبحث الثاني: العناصر والأبعاد الرئيسية", page: "5" },
      { title: "المبحث الثالث: التطبيقات والأثر العلمي والعملي", page: "7" },
      { title: "المبحث الرابع: الرؤى والتحليلات المعاصرة", page: "8" },
      { title: "خاتمة البحث وخلاصة النتائج والتوصيات", page: "9" },
      { title: "قائمة المصادر والمراجع المعتمدة", page: "10" },
    ];

    const tableRows = [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 75, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "عنوان المبحث أو الفصل",
                    font: "Arial",
                    size: 36, // 18pt bold
                    bold: true,
                    rightToLeft: true,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "رقم الصفحة",
                    font: "Arial",
                    size: 36,
                    bold: true,
                    rightToLeft: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      ...indexData.map(
        (item) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 75, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: item.title,
                        font: "Arial",
                        size: 32, // 16pt
                        rightToLeft: true,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: item.page,
                        font: "Arial",
                        size: 32,
                        bold: true,
                        rightToLeft: true,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          })
      ),
    ];

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        visuallyRightToLeft: true,
        rows: tableRows,
      })
    );

    // Page break after Index
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // =========================================================================
  // 3. Body Content (المقدمة، المباحث، الخاتمة) - Natural Continuous Flow
  // Font sizes: Main Headings = 22pt (44), Subheadings = 20pt (40), Body = 18pt (36)
  // All text explicitly Right-to-Left and Right-Aligned
  // =========================================================================
  const mainHeadingKeywords = ["المبحث", "مقدمة", "خاتمة", "الفصل", "تمهيد", "المصادر والمراجع"];
  const subHeadingKeywords = ["أولاً", "ثانياً", "ثالثاً", "رابعاً", "خامساً", "المطلب", "الفرع"];

  rawLines.forEach((line) => {
    const isMainHeading = mainHeadingKeywords.some((kw) => line.includes(kw));
    const isSubHeading = !isMainHeading && subHeadingKeywords.some((kw) => line.startsWith(kw));

    if (isMainHeading) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 400, after: 200 },
          children: [
            new TextRun({
              text: line,
              font: "Arial",
              size: 44, // 22pt
              bold: true,
              rightToLeft: true,
              color: "1E3A8A",
            }),
          ],
        })
      );
    } else if (isSubHeading) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 280, after: 160 },
          children: [
            new TextRun({
              text: line,
              font: "Arial",
              size: 40, // 20pt
              bold: true,
              rightToLeft: true,
            }),
          ],
        })
      );
    } else {
      // Body Text: 18pt font (36 half-points), Right-aligned, natural continuous flow
      children.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: {
            before: 100,
            after: 140,
            line: 360, // 1.5 line spacing
          },
          children: [
            new TextRun({
              text: `    ${line}`,
              font: "Arial",
              size: 36, // 18pt
              rightToLeft: true,
            }),
          ],
        })
      );
    }
  });

  // =========================================================================
  // 4. References Page (المراجع والمصادر المعتمدة)
  // =========================================================================
  if (includeReferences) {
    children.push(new Paragraph({ children: [new PageBreak()] }));

    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 300, after: 300 },
        children: [
          new TextRun({
            text: "قائمة المصادر والمراجع المعتمدة",
            font: "Arial",
            size: 44, // 22pt bold
            bold: true,
            rightToLeft: true,
            color: "1E3A8A",
          }),
        ],
      })
    );

    const defaultRefs = [
      `1. الموسوعة العربية الحرة (ويكيبيديا) - قسم الدراسات والأبحاث التخصصية حول (${topic}).`,
      `2. منصة "موضوع" وموسوعة "سطور" العلمية والتعليمية المعتمدة.`,
      `3. الدوريات والمجلات الأكاديمية الصادرة عن الجامعات والمراكز البحثية العربية.`,
      `4. مجموعة من الكتب والمراجع التخصصية المحكمة في مجالات الفكر والبحث العلمي.`,
    ];

    defaultRefs.forEach((ref) => {
      children.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 120, after: 160, line: 360 },
          children: [
            new TextRun({
              text: ref,
              font: "Arial",
              size: 36, // 18pt
              rightToLeft: true,
            }),
          ],
        })
      );
    });
  }

  // =========================================================================
  // Document Structure: A4 with Narrow Margins (12.7 mm = 0.5 inch)
  // =========================================================================
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(210), // A4 Width
              height: convertMillimetersToTwip(297), // A4 Height
            },
            margin: {
              top: convertMillimetersToTwip(12.7), // Narrow Margins (0.5 in)
              bottom: convertMillimetersToTwip(12.7),
              left: convertMillimetersToTwip(12.7),
              right: convertMillimetersToTwip(12.7),
            },
            borders: {
              pageBorders: {
                display: PageBorderDisplay.ALL_PAGES,
                zOrder: PageBorderZOrder.FRONT,
                offsetFrom: PageBorderOffsetFrom.PAGE,
              },
              pageBorderTop: { style: BorderStyle.SINGLE, size: 12, space: 24, color: "1E3A8A" },
              pageBorderRight: { style: BorderStyle.SINGLE, size: 12, space: 24, color: "1E3A8A" },
              pageBorderBottom: { style: BorderStyle.SINGLE, size: 12, space: 24, color: "1E3A8A" },
              pageBorderLeft: { style: BorderStyle.SINGLE, size: 12, space: 24, color: "1E3A8A" },
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeTopic = topic.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "_").slice(0, 25);
  saveAs(blob, `CopyCat_Research_${safeTopic}.docx`);
}
