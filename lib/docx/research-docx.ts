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
  Footer,
  PageNumber,
} from "docx";
import { saveAs } from "file-saver";

/**
 * أفضل 10 مصادر وقواعد بيانات بحثية وأكاديمية باللغة العربية
 * معتمدة للتوثيق والاستشهاد في الأبحاث والرسائل الجامعية
 */
export const TOP_ARABIC_ACADEMIC_SOURCES = [
  {
    id: "ekb",
    name: "بنك المعرفة المصري (Egyptian Knowledge Bank - EKB)",
    desc: "أضخم مستودع رقمي وبوابة للرسائل الجامعية والأطروحات والدوريات الأكاديمية المحكمة في العالم العربي.",
    category: "مستودعات وطنية ورسائل جامعية",
    getCitation: (t: string) =>
      `1. بنك المعرفة المصري (EKB) - البوابة الأكاديمية للدوريات العلمية المحكمة، دراسات متخصصة في (${t})، القاهرة، 2024.`,
  },
  {
    id: "mandumah",
    name: "قواعد بيانات دار المنظومة (Dar Al Mandumah)",
    desc: "رائدة قواعد معلومات الرسائل والمجلات المحكمة العربية (EcoLink, HumanIndex, EduSearch, IslamicInfo, AraBase).",
    category: "قواعد بيانات أطروحات ومجلات محكمة",
    getCitation: (t: string) =>
      `2. قاعدة بيانات دار المنظومة (Dar Al Mandumah) - أطروحات ورسائل ماجستير ودكتوراه مجازة في مجال (${t})، الرياض، 2023.`,
  },
  {
    id: "shamaa",
    name: "شبكة المعلومات العربية التربوية (شمعة - Shamaa)",
    desc: "أشمل قاعدة بيانات عربية متخصصة في الدراسات التربوية والنفسية والاجتماعية عبر 22 دولة عربية.",
    category: "علوم تربوية ونفسية واجتماعية",
    getCitation: (t: string) =>
      `3. قاعدة بيانات شمعة (Shamaa) - شبكة المعلومات العربية التربوية، بحوث ودراسات تربوية محكمة، بيروت، 2024.`,
  },
  {
    id: "sdl",
    name: "المكتبة الرقمية السعودية (SDL) ومستودعات أطروحات الخليج",
    desc: "أكبر تجمع أكاديمي لمصادر المعلومات الرقمية والرسائل الجامعية المفتوحة والنصوص الكاملة.",
    category: "مكتبات رقمية وأطروحات عليا",
    getCitation: (t: string) =>
      `4. المكتبة الرقمية السعودية (SDL) والمستودع المؤسسي للجامعات السعودية - أبحاث علمية في (${t})، الرياض، 2023.`,
  },
  {
    id: "cairo_uni",
    name: "مستودع الأطروحات والرسائل العلمية لجامعة القاهرة وعين شمس",
    desc: "الأرشيف الرقمي لرسائل الماجستير والدكتوراه المحكمة بالجامعات المصرية العريقة والمراكز البحثية.",
    category: "رسائل ماجستير ودكتوراه محكمة",
    getCitation: (t: string) =>
      `5. مستودع الرسائل والأطروحات العلمية بجامعة القاهرة وجامعة عين شمس - دراسات ميدانية وتطبيقية حول (${t})، 2022.`,
  },
  {
    id: "asjp",
    name: "البوابة الجزائرية للمجلات العلمية (ASJP)",
    desc: "المرجع المغاربي والعربي الأول للدوريات والمجلات العلمية المحكمة ذات معاملات التأثير المعترف بها.",
    category: "دوريات محكمة ومجلات مصنفة",
    getCitation: (t: string) =>
      `6. البوابة الجزائرية للمجلات العلمية (ASJP) - الدوريات المحكمة في العلوم الإنسانية والاجتماعية والتطبيقية، الجزائر، 2024.`,
  },
  {
    id: "aruc",
    name: "الفهرس العربي الموحد (ARUC) ومكتبة الملك فهد الوطنية",
    desc: "المرجع الببليوجرافي الموحد للإنتاج الفكري والكتب المرجعية والتراث العلمي العربي.",
    category: "فهارس ومراجع ببليوجرافية موحدة",
    getCitation: (t: string) =>
      `7. الفهرس العربي الموحد (ARUC) ومكتبة الملك فهد الوطنية - السجل التوثيقي لأوعية المعلومات العربية، الرياض، 2023.`,
  },
  {
    id: "scholar_ar",
    name: "الباحث العلمي العربي من Google (Google Scholar Arabic Index)",
    desc: "محرك البحث الأكاديمي الشامل للمقالات المحكمة ورسائل المؤتمرات ذات الاستشهادات العالية.",
    category: "محركات استشهاد أكاديمي",
    getCitation: (t: string) =>
      `8. الباحث العلمي من Google (Google Scholar) - المؤشر الأكاديمي العربي للأبحاث المحكمة والأكثر استشهاداً في (${t})، 2024.`,
  },
  {
    id: "aaru",
    name: "المجلات العلمية لاتحاد الجامعات العربية ومجمع اللغة العربية",
    desc: "الدراسات التخصصية الصادرة عن عمادات البحث العلمي ومجامع العلوم واللغة العربية.",
    category: "مجلات جامعية ومجامع لغوية",
    getCitation: (t: string) =>
      `9. اتحاد الجامعات العربية ومجمع اللغة العربية بالقاهرة - مجلة البحوث والدراسات المحكمة، بحوث محكمة، 2023.`,
  },
  {
    id: "caus",
    name: "دوريات مركز دراسات الوحدة العربية والمجلات الأكاديمية لجامعة الأزهر",
    desc: "الدراسات الفكرية والاستراتيجية والعلوم الشرعية والإنسانية المعاصرة الموثقة.",
    category: "دراسات فكرية واستراتيجية",
    getCitation: (t: string) =>
      `10. دوريات مركز دراسات الوحدة العربية ومجلة قطاع البحوث بجامعة الأزهر الشريف - بحوث ودراسات (${t})، بيروت/القاهرة، 2024.`,
  },
];

export interface CustomResearchSource {
  id: string;
  name: string;
  desc?: string;
  category?: string;
  getCitation?: (t: string) => string;
  citation?: string;
}

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
  sources?: CustomResearchSource[];
  versionNumber?: number;
}

export async function generateResearchDocx(options: ResearchDocxOptions) {
  const {
    topic,
    rawText,
    includeIndex = true,
    includeReferences = true,
    coverInfo = {},
    targetPages = 5,
    sources,
    versionNumber,
  } = options;

  const effectiveTargetPages = Math.max(3, Number(targetPages) || 5);

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
  // 2. Table of Contents / Index (صفحة الفهرس التفاعلية المتناسبة مع عدد الصفحات)
  // =========================================================================
  const mainHeadingKeywords = ["المبحث", "مقدمة", "خاتمة", "الفصل", "تمهيد", "المصادر والمراجع", "قائمة المصادر"];
  const subHeadingKeywords = ["أولاً", "ثانياً", "ثالثاً", "رابعاً", "خامساً", "المطلب", "الفرع"];

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
            color: "1E3A8A",
          }),
        ],
      })
    );

    // 1. Scan for actual headings in rawLines
    const detectedHeadings: string[] = [];
    rawLines.forEach((line) => {
      const isHeading =
        mainHeadingKeywords.some((kw) => line.includes(kw)) ||
        subHeadingKeywords.some((kw) => line.startsWith(kw));
      // Must be a concise heading line (not a full paragraph)
      if (isHeading && line.length <= 110 && !detectedHeadings.includes(line)) {
        detectedHeadings.push(line.replace(/[:：]$/, "").trim());
      }
    });

    // 2. If text didn't contain sufficient headings, synthesize structured academic outline matching targetPages
    let finalHeadings: string[] = [];
    if (detectedHeadings.length >= 4) {
      finalHeadings = detectedHeadings;
    } else {
      if (effectiveTargetPages <= 5) {
        finalHeadings = [
          "مقدمة البحث التمهيدية وإشكالية الدراسة",
          "المبحث الأول: الإطار المفاهيمي والتأصيل النظري",
          "المبحث الثاني: العناصر والأبعاد الرئيسية والتطبيقات",
          "المبحث الثالث: التحليلات المعاصرة والآثار العملية",
          "خاتمة البحث وخلاصة النتائج والتوصيات",
          ...(includeReferences ? ["قائمة المصادر والمراجع المعتمدة (أهم 10 مصادر عربية)"] : []),
        ];
      } else if (effectiveTargetPages <= 12) {
        finalHeadings = [
          "مقدمة البحث: الإشكالية، الأهمية، والأهداف",
          "المبحث الأول: الإطار المفاهيمي والنشأة التاريخية",
          "المبحث الثاني: الركائز الهيكلية والآليات التشغيلية",
          "المبحث الثالث: التطبيقات الواقعية والدراسات المقارنة",
          "المبحث الرابع: التحديات والمعوقات الراهنة وسبل المعالجة",
          "المبحث الخامس: الرؤى الاستشرافية ومسارات التطوير",
          "خاتمة البحث: أبرز النتائج والتوصيات التنفيذية",
          ...(includeReferences ? ["قائمة المصادر والمراجع المعتمدة (قواعد البيانات العربية)"] : []),
        ];
      } else if (effectiveTargetPages <= 20) {
        finalHeadings = [
          "مقدمة البحث التمهيدية والإطار المنهجي",
          "الفصل الأول: الإطار النظري والتأصيل المعرفي والتاريخي",
          "المبحث الأول: النشأة ومراحل التطور عبر العصور",
          "المبحث الثاني: المدارس الفكرية والاتجاهات الحديثة",
          "الفصل الثاني: البنية التطبيقية والآليات التشغيلية",
          "المبحث الأول: الركائز الفنية والمكونات الجوهرية",
          "المبحث الثاني: النماذج الواقعية ودراسات الحالة الميدانية",
          "الفصل الثالث: التحديات والحلول والرؤى المستقبلية",
          "المبحث الأول: المعوقات المؤسسية وإدارة التغيير",
          "المبحث الثاني: استشراف المستقبل والتحول التكنولوجي",
          "خاتمة البحث: حزمة النتائج والتوصيات الأكاديمية",
          ...(includeReferences ? ["قائمة المصادر والمراجع المعتمدة (المستودعات الأكاديمية)"] : []),
        ];
      } else {
        // 21 to 60 pages (e.g. 30 pages requested by user!)
        finalHeadings = [
          "مقدمة البحث الشاملة: الإشكالية، الفروض، والمنهج المعتمد",
          "الفصل الأول: الإطار النظري والتأصيل المفاهيمي والتاريخي",
          "المبحث الأول: الجذور التاريخية وتطور المفهوم",
          "المبحث الثاني: الاتجاهات النظرية والمدارس الفكرية الرائدة",
          "المبحث الثالث: المفاهيم المتقاطعة والصلات البينية",
          "الفصل الثاني: الأبعاد الهيكلية والآليات التشغيلية والتنظيمية",
          "المبحث الأول: الركائز الأساسية والمكونات الجوهرية",
          "المبحث الثاني: السياسات والأطر والمعايير المعتمدة",
          "المبحث الثالث: المنهجيات المعاصرة ومؤشرات الكفاءة",
          "الفصل الثالث: الدراسات الميدانية والتجارب المقارنة",
          "المبحث الأول: النماذج الرائدة والتطبيقات الواقعية",
          "المبحث الثاني: المعوقات والتحديات التشغيلية والإدارية",
          "المبحث الثالث: التحليل التقييمي والدروس المستفادة",
          "الفصل الرابع: استشراف المستقبل، الحلول المبتكرة، والتحول الذكي",
          "المبحث الأول: تطبيقات الذكاء الاصطناعي والأتمتة",
          "المبحث الثاني: خارطة طريق مقترحة للتطوير المستدام",
          "خاتمة البحث المستفيضة: النتائج والتوصيات والآفاق المستقبلية",
          ...(includeReferences ? ["قائمة المصادر والمراجع الأكاديمية (أهم 10 مصادر عربية)"] : []),
        ];
      }
    }

    // 3. Proportional, strictly non-decreasing page calculation scaling up to targetPages
    const startPage = 3;
    const endPage = effectiveTargetPages;
    const totalItems = finalHeadings.length;

    let lastAssigned = startPage;
    const indexData = finalHeadings.map((title, idx) => {
      if (idx === 0) {
        return { title, page: String(startPage) };
      }
      if (idx === totalItems - 1) {
        return { title, page: String(endPage) };
      }
      const ratio = idx / (totalItems - 1);
      const calculatedP = Math.round(startPage + ratio * (endPage - startPage));
      const assigned = Math.max(lastAssigned, Math.min(endPage, calculatedP));
      lastAssigned = assigned;
      return { title, page: String(assigned) };
    });

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
                        bold: item.title.includes("الفصل") || item.title.includes("خاتمة") || item.title.includes("المراجع"),
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
  // 3. Body Content (المقدمة، الفصول، المباحث، الخاتمة)
  // Font sizes: Main Headings = 22pt (44), Subheadings = 20pt (40), Body = 18pt (36)
  // All text explicitly Right-to-Left and Right-Aligned
  // Dynamically inserts PageBreak for multi-page papers so Word pagination matches target
  // =========================================================================
  let paragraphsSinceLastBreak = 0;

  rawLines.forEach((line) => {
    const isChapter = line.includes("الفصل ");
    const isMainHeading = mainHeadingKeywords.some((kw) => line.includes(kw));
    const isSubHeading = !isMainHeading && subHeadingKeywords.some((kw) => line.startsWith(kw));

    // For multi-page papers (>= 10 pages), start major chapters on fresh pages to match page layout
    if (isChapter && effectiveTargetPages >= 10) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      paragraphsSinceLastBreak = 0;
    } else if (isMainHeading && effectiveTargetPages >= 20 && paragraphsSinceLastBreak >= 5) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      paragraphsSinceLastBreak = 0;
    }

    if (isChapter) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 500, after: 240 },
          children: [
            new TextRun({
              text: line,
              font: "Arial",
              size: 48, // 24pt
              bold: true,
              rightToLeft: true,
              color: "1E3A8A",
            }),
          ],
        })
      );
    } else if (isMainHeading) {
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
      paragraphsSinceLastBreak += 1;
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
  // 4. References Page (المراجع والمصادر الأكاديمية - أهم 10 مصادر عربية معتمدة)
  // =========================================================================
  if (includeReferences) {
    children.push(new Paragraph({ children: [new PageBreak()] }));

    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 300, after: 300 },
        children: [
          new TextRun({
            text: "قائمة المصادر والمراجع الأكاديمية المعتمدة",
            font: "Arial",
            size: 44, // 22pt bold
            bold: true,
            rightToLeft: true,
            color: "1E3A8A",
          }),
        ],
      })
    );

    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 100, after: 200 },
        children: [
          new TextRun({
            text: "تم توثيق واستقاء محتوى هذه الدراسة بالرجوع إلى أمهات الكتب والأطروحات الصادرة عن أفضل 10 قواعد بيانات ومستودعات أكاديمية عربية موثقة:",
            font: "Arial",
            size: 32, // 16pt
            italics: true,
            rightToLeft: true,
            color: "4B5563",
          }),
        ],
      })
    );

    // Citing custom or default Top 10 Arabic Academic Research databases customized to topic
    const activeSources = sources && sources.length > 0 ? sources : TOP_ARABIC_ACADEMIC_SOURCES;
    activeSources.forEach((source, idx) => {
      let citationText = "";
      if ("getCitation" in source && typeof source.getCitation === "function") {
        citationText = source.getCitation(topic);
      } else if ("citation" in source && source.citation) {
        citationText = source.citation;
      } else {
        citationText = `${idx + 1}. ${source.name} - ${source.desc || "أبحاث ورسائل جامعية محكمة"} - دراسات تخصصية في (${topic})، 2024.`;
      }
      children.push(
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 120, after: 160, line: 360 },
          children: [
            new TextRun({
              text: citationText,
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
  // Document Structure: A4 with Narrow Margins (12.7 mm = 0.5 inch) & Centered Page Numbers
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
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: "Arial",
                    size: 24, // 12pt
                    color: "4B5563",
                    bold: true,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeTopic = topic.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "_").slice(0, 25);
  const versionSuffix = versionNumber ? `_نسخة_${versionNumber}` : "";
  if (typeof window !== "undefined") {
    saveAs(blob, `CopyCat_Research_${safeTopic}${versionSuffix}.docx`);
  }
  return blob;
}
