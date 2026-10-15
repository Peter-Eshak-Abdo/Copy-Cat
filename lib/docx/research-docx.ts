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
 * أفضل 20 مصدر وقاعدة بيانات بحثية وأكاديمية باللغة العربية
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
      `3. قاعدة بيانات شمعة (Shamaa) - شبكة المعلومات العربية التربوية، بحوث ودراسات محكمة في (${t})، بيروت، 2024.`,
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
      `6. البوابة الجزائرية للمجلات العلمية (ASJP) - الدوريات المحكمة في (${t}) والعلوم التطبيقية، الجزائر، 2024.`,
  },
  {
    id: "aruc",
    name: "الفهرس العربي الموحد (ARUC) ومكتبة الملك فهد الوطنية",
    desc: "المرجع الببليوجرافي الموحد للإنتاج الفكري والكتب المرجعية والتراث العلمي العربي.",
    category: "فهارس ومراجع ببليوجرافية موحدة",
    getCitation: (t: string) =>
      `7. الفهرس العربي الموحد (ARUC) ومكتبة الملك فهد الوطنية - السجل التوثيقي لأوعية المعلومات في (${t})، الرياض، 2023.`,
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
      `9. اتحاد الجامعات العربية ومجمع اللغة العربية بالقاهرة - مجلة البحوث والدراسات المحكمة في (${t})، 2023.`,
  },
  {
    id: "caus",
    name: "دوريات مركز دراسات الوحدة العربية والمجلات الأكاديمية لجامعة الأزهر",
    desc: "الدراسات الفكرية والاستراتيجية والعلوم الشرعية والإنسانية المعاصرة الموثقة.",
    category: "دراسات فكرية واستراتيجية",
    getCitation: (t: string) =>
      `10. دوريات مركز دراسات الوحدة العربية ومجلة قطاع البحوث بجامعة الأزهر الشريف - بحوث ودراسات (${t})، بيروت/القاهرة، 2024.`,
  },
  {
    id: "kau_repo",
    name: "مستودع أبحاث جامعة الملك عبد العزيز (KAU Repository)",
    desc: "المستودع الرقمي للإنتاج العلمي وأطروحات الدراسات العليا والمجلات التخصصية المصنفة عالمياً.",
    category: "مستودعات أبحاث جامعية عليا",
    getCitation: (t: string) =>
      `11. مستودع أبحاث جامعة الملك عبد العزيز - دراسات وأطروحات متقدمة في (${t})، جدة، 2024.`,
  },
  {
    id: "uqu_repo",
    name: "مستودع أبحاث ورسائل جامعة أم القرى ومعهد خادم الحرمين",
    desc: "أرشيف الأطروحات العلمية المحكمة والمجلات البحثية في العلوم التطبيقية والاجتماعية والإنسانية.",
    category: "رسائل وأبحاث جامعية",
    getCitation: (t: string) =>
      `12. جامعة أم القرى ومعهد خادم الحرمين لأبحاث الحج والبيئة - دراسات محكمة حول (${t})، مكة المكرمة، 2023.`,
  },
  {
    id: "jordan_uni",
    name: "مجلة دراسات: عمادة البحث العلمي بالجامعة الأردنية",
    desc: "دورية علمية دولية محكمة ومفهرسة في قواعد البيانات العالمية (Scopus) منذ عقود.",
    category: "دوريات علمية محكمة ومفهرسة",
    getCitation: (t: string) =>
      `13. الجامعة الأردنية - مجلة دراسات للعلوم الإنسانية والاجتماعية والتطبيقية، بحوث (${t})، عمّان، 2024.`,
  },
  {
    id: "ksu_journal",
    name: "مجلة جامعة الملك سعود ومستودع الأبحاث المؤسسي",
    desc: "سلسلة المجلات العلمية المحكمة الصادرة عن جامعة الملك سعود في العلوم الإدارية والتربوية والتقنية.",
    category: "مجلات علمية رائدة",
    getCitation: (t: string) =>
      `14. مجلة جامعة الملك سعود - دراسات علمية محكمة في محاور (${t})، الرياض، 2023.`,
  },
  {
    id: "acrps",
    name: "المركز العربي للأبحاث ودراسة السياسات (دوريات تبيّن وسياسات)",
    desc: "أبرز مؤسسة بحثية عربية مستقلة تنشر دراسات استراتيجية واجتماعية وفكرية محكمة.",
    category: "مراكز بحوث ودراسات استراتيجية",
    getCitation: (t: string) =>
      `15. المركز العربي للأبحاث ودراسة السياسات - دوريات علمية محكمة وأبحاث في (${t})، الدوحة، 2024.`,
  },
  {
    id: "kuwait_uni",
    name: "مجلس النشر العلمي ومستودع الأطروحات لجامعة الكويت",
    desc: "المجلات العلمية المتخصصة وحوليات الآداب والعلوم الاجتماعية المحكمة بالخليج العربي.",
    category: "نشر علمي وأطروحات خليجية",
    getCitation: (t: string) =>
      `16. مجلس النشر العلمي بجامعة الكويت - أبحاث ودراسات محكمة في (${t})، الكويت، 2023.`,
  },
  {
    id: "damascus_uni",
    name: "مجلة جامعة دمشق للبحوث والدراسات العلمية",
    desc: "أقدم الدوريات الأكاديمية المحكمة في العالم العربي في العلوم الأساسية والإنسانية والاقتصادية.",
    category: "دوريات أكاديمية عريقة",
    getCitation: (t: string) =>
      `17. مجلة جامعة دمشق للبحوث العلمية - دراسات تخصصية في (${t})، دمشق، 2023.`,
  },
  {
    id: "kfu_journal",
    name: "مجلة جامعة الملك فيصل للعلوم الإنسانية والإدارية",
    desc: "دورية دورية محكمة تعنى بالدراسات الميدانية والتطبيقية والنظرية المتخصصة.",
    category: "مجلات علمية دورية محكمة",
    getCitation: (t: string) =>
      `18. جامعة الملك فيصل - مجلة العلوم الإنسانية والإدارية، بحوث محكمة في (${t})، الأحساء، 2024.`,
  },
  {
    id: "imamu_repo",
    name: "مستودع الرسائل العلمية لجامعة الإمام محمد بن سعود الإسلامية",
    desc: "أضخم مستودع جامعي لأطروحات الدراسات العليا والمجلات الفقهية والقانونية والاجتماعية.",
    category: "مستودعات رسائل ومجلات تخصصية",
    getCitation: (t: string) =>
      `19. مستودع الرسائل العلمية بجامعة الإمام - دراسات وأطروحات ماجستير ودكتوراه في (${t})، الرياض، 2023.`,
  },
  {
    id: "bau_journal",
    name: "مجلة جامعة بيروت العربية للأبحاث والدراسات المتقدمة",
    desc: "دورية علمية دولية محكمة تصدر دراسات تطبيقية وبينية متميزة بالتعاون مع جامعات عالمية.",
    category: "أبحاث علمية ودراسات بينية",
    getCitation: (t: string) =>
      `20. جامعة بيروت العربية (BAU) - مجلة الدراسات والأبحاث العلمية المحكمة في (${t})، بيروت، 2024.`,
  },
];

/**
 * دالة استخراج وتدوير مراجع أكاديمية متنوعة ومتباينة لكل نسخة
 * تضمن عدم تطابق المراجع بين النسخ حتى لو كان نفس الموضوع
 */
export function getDiverseSourcesForVersion(
  allSources: CustomResearchSource[],
  versionNumber: number = 1,
  count: number = 8
): CustomResearchSource[] {
  if (!allSources || allSources.length === 0) return [];
  const v = Math.max(1, versionNumber) - 1;
  const total = allSources.length;
  // Use a prime stride to guarantee shifting sets per version
  const stride = 7;
  const offset = (v * stride) % total;
  const rotated = [...allSources.slice(offset), ...allSources.slice(0, offset)];
  return rotated.slice(0, Math.min(count, total));
}

/**
 * دالة مساعدة لإنشاء فقرة متوافقة 100% مع الاتجاه من اليمين إلى اليسار (RTL) في Microsoft Word
 * تضيف وسم <w:bidi/> تلقائياً لكل فقرة بدون استثناء
 */
function bidiParagraph(options: ConstructorParameters<typeof Paragraph>[0]): Paragraph {
  if (typeof options === "string") {
    return new Paragraph({
      bidirectional: true,
      text: options,
    });
  }
  return new Paragraph({
    bidirectional: true,
    ...(options as object),
  });
}

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
  const rawLines = cleanText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const children: (Paragraph | Table)[] = [];

  // =========================================================================
  // 1. Cover Page (صفحة الغلاف الرسمية - RTL 100%)
  // =========================================================================
  // Top school / institution header
  if (coverInfo.schoolOrUniversity) {
    children.push(
      bidiParagraph({
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
      }),
    );
  }

  // Large Centered Title (26pt bold)
  children.push(
    bidiParagraph({
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
    }),
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
      }),
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
      }),
    );
  }
  if (coverInfo.gradeOrClass) {
    metaRuns.push(
      new TextRun({
        text: `الصف / الفرقة الدراسية: ${coverInfo.gradeOrClass}\n`,
        font: "Arial",
        size: 36,
        rightToLeft: true,
      }),
    );
  }
  if (coverInfo.academicYear) {
    metaRuns.push(
      new TextRun({
        text: `العام الدراسي: ${coverInfo.academicYear}\n`,
        font: "Arial",
        size: 32,
        rightToLeft: true,
      }),
    );
  }

  children.push(
    bidiParagraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 1600, after: 400 },
      children: metaRuns,
    }),
  );

  // Page Break after Cover Page
  children.push(bidiParagraph({ children: [new PageBreak()] }));

  // =========================================================================
  // 2. Scan for actual encyclopedic headings in rawLines (Available for Index & Body)
  // =========================================================================
  // Separate body lines from references lines to avoid duplication and keep references on their own page
  const refHeaderKeywords = ["قائمة المصادر والمراجع", "المصادر والمراجع الأكاديمية", "المصادر والمراجع"];
  const refIndexInRaw = rawLines.findIndex((line) => {
    const trimmed = line.trim();
    return refHeaderKeywords.some((kw) => trimmed.includes(kw));
  });

  let bodyLines = rawLines;
  let textRefLines: string[] = [];

  if (refIndexInRaw !== -1) {
    bodyLines = rawLines.slice(0, refIndexInRaw);
    textRefLines = rawLines.slice(refIndexInRaw + 1);
  }

  const mainHeadingKeywords = [
    "المبحث",
    "مقدمة",
    "خاتمة",
    "الفصل",
    "تمهيد",
    "المصادر والمراجع",
    "قائمة المصادر",
  ];
  const subHeadingKeywords = [
    "أولاً",
    "ثانياً",
    "ثالثاً",
    "رابعاً",
    "خامساً",
    "المطلب",
    "الفرع",
  ];

  const detectedHeadings: string[] = [];
  bodyLines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const isMarkdownHeader = /^#{1,4}\s+/.test(trimmed);
    const isNumbered =
      /^[0-9]+[.-]\s+/.test(trimmed) ||
      /^(\([0-9]+\)|[أ-ي][.-])\s+/.test(trimmed);
    const endsWithColon = trimmed.endsWith(":") || trimmed.endsWith("：");
    const hasKeyword = [
      "مقدمة",
      "تمهيد",
      "خاتمة",
      "المصادر",
      "المراجع",
      "نظرة عامة",
      "النشأة",
      "تاريخ",
      "مفهوم",
      "المبادئ",
      "الأسس",
      "الركائز",
      "الأبعاد",
      "التطبيقات",
      "التحديات",
      "المقارنة",
      "استشراف",
      "التحول",
      "توصيات",
      "دراسة",
      "المحور",
    ].some((kw) => trimmed.includes(kw));

    const isHeading =
      (isMarkdownHeader ||
        isNumbered ||
        (endsWithColon && trimmed.length <= 110) ||
        (hasKeyword && trimmed.length <= 90)) &&
      trimmed.length >= 4 &&
      trimmed.length <= 120 &&
      !trimmed.endsWith(".");

    if (isHeading) {
      const cleanTitle = trimmed
        .replace(/^#{1,4}\s+/, "")
        .replace(/[:：]$/, "")
        .trim();
      if (!detectedHeadings.includes(cleanTitle)) {
        detectedHeadings.push(cleanTitle);
      }
    }
  });

  if (includeIndex) {
    children.push(
      bidiParagraph({
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
      }),
    );

    // 2. If text didn't contain sufficient headings, synthesize structured encyclopedic outline matching targetPages
    let finalHeadings: string[] = [];
    if (detectedHeadings.length >= 4) {
      finalHeadings = detectedHeadings;
    } else {
      const tName =
        topic
          .replace(/^بحث (أكاديمي|دراسي|موسوعي)\s*(متكامل)?\s*بعنوان:\s*/i, "")
          .trim() || "الموضوع";
      if (effectiveTargetPages <= 5) {
        finalHeadings = [
          `مقدمة وتمهيد عام عن (${tName})`,
          `المدخل المفاهيمي والتأصيل العلمي لـ (${tName})`,
          `الركائز الهيكلية والآليات التشغيلية`,
          `النماذج التطبيقية ودراسات الحالة الواقعية`,
          `التحديات الراهنة واستشراف المستقبل والتحول التقني`,
          `خاتمة البحث وخلاصة النتائج والتوصيات`,
          ...(includeReferences
            ? ["قائمة المصادر والمراجع الأكاديمية المعتمدة"]
            : []),
        ];
      } else if (effectiveTargetPages <= 12) {
        finalHeadings = [
          `مقدمة البحث: الإشكالية، الأهمية، والأهداف`,
          `المدخل المفاهيمي والتأصيل المعرفي لـ (${tName})`,
          `الجذور والنشأة التاريخية ومراحل التطور`,
          `الركائز الهيكلية والآليات التشغيلية والسياسات`,
          `التطبيقات الواقعية والنماذج الميدانية المقارنة`,
          `التحديات والمعوقات الراهنة وسبل المعالجة المبتكرة`,
          `الرؤى الاستشرافية والتحول التكنولوجي الذكي`,
          `خاتمة البحث: النتائج والتوصيات التنفيذية المقترحة`,
          ...(includeReferences
            ? ["قائمة المصادر والمراجع الأكاديمية والتوثيقية"]
            : []),
        ];
      } else {
        // 13 to 60 pages
        finalHeadings = [
          `مقدمة وتمهيد عام وإشكالية الدراسة`,
          `المدخل الموسوعي والإطار المفاهيمي لـ (${tName})`,
          `النشأة التاريخية وتطور الظاهرة عبر الحقب المختلفة`,
          `الأسس العلمية والمدارس الفكرية الرائدة`,
          `العلاقات المعرفية والصلات البينية في العلوم الحديثة`,
          `الركائز الهيكلية والمكونات التنظيمية والتشغيلية`,
          `السياسات العامة والأطر التشريعية ومعايير الجودة`,
          `المؤشرات الإحصائية ومقاييس تقييم الأداء (KPIs)`,
          `التطبيقات الميدانية ودراسات الحالة في البيئة العربية`,
          `الأبعاد الاقتصادية والجدوى التنموية لـ (${tName})`,
          `المعوقات والتحديات المؤسسية وحلول المعالجة المبتكرة`,
          `المقارنات الدولية وأفضل الممارسات المعيارية`,
          `الابتكار التكنولوجي وتطبيقات الذكاء الاصطناعي`,
          `خارطة طريق تنفيذية مقترحة للتطوير المستدام`,
          `الرؤى الاستشرافية والسيناريوهات المستقبلية المتوقعة`,
          `خاتمة واستنتاجات وتوصيات تنفيذية شاملة`,
          ...(includeReferences
            ? [
                "قائمة المصادر والمراجع الأكاديمية المعتمدة",
              ]
            : []),
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
              bidiParagraph({
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
              bidiParagraph({
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
                  bidiParagraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: item.title,
                        font: "Arial",
                        size: 32, // 16pt
                        rightToLeft: true,
                        bold:
                          item.title.includes("الفصل") ||
                          item.title.includes("خاتمة") ||
                          item.title.includes("المراجع"),
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                children: [
                  bidiParagraph({
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
          }),
      ),
    ];

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        visuallyRightToLeft: true,
        rows: tableRows,
      }),
    );

    // Page break after Index
    children.push(bidiParagraph({ children: [new PageBreak()] }));
  }

  // =========================================================================
  // 3. Body Content (المقدمة، الفصول، المباحث، الخاتمة)
  // Font sizes: Main Headings = 22pt (44), Subheadings = 20pt (40), Body = 18pt (36)
  // All text explicitly Right-to-Left (bidirectional: true) and Right-Aligned
  // =========================================================================
  let paragraphsSinceLastBreak = 0;

  bodyLines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const isMarkdownHeader = /^#{1,4}\s+/.test(trimmed);
    const isNumberedHeading =
      /^[0-9]+[.-]\s+/.test(trimmed) && trimmed.length <= 110;
    const endsWithColon =
      (trimmed.endsWith(":") || trimmed.endsWith("：")) &&
      trimmed.length <= 110 &&
      !trimmed.endsWith(".");
    const isDetected = detectedHeadings.some((dh) => trimmed.includes(dh));
    const isMainHeading =
      isMarkdownHeader ||
      isNumberedHeading ||
      endsWithColon ||
      isDetected ||
      mainHeadingKeywords.some((kw) => trimmed.includes(kw));

    const isSubHeading =
      !isMainHeading && subHeadingKeywords.some((kw) => trimmed.startsWith(kw));

    // For multi-page papers (>= 10 pages, e.g. 30 pages), start major encyclopedic headings on fresh pages
    if (
      isMainHeading &&
      effectiveTargetPages >= 10 &&
      paragraphsSinceLastBreak >= 3
    ) {
      children.push(bidiParagraph({ children: [new PageBreak()] }));
      paragraphsSinceLastBreak = 0;
    }

    const cleanLine = trimmed.replace(/^#{1,4}\s+/, "").trim();

    if (isMainHeading) {
      children.push(
        bidiParagraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 450, after: 220 },
          children: [
            new TextRun({
              text: cleanLine,
              font: "Arial",
              size: 44, // 22pt
              bold: true,
              rightToLeft: true,
              color: "1E3A8A",
            }),
          ],
        }),
      );
      paragraphsSinceLastBreak++;
    } else if (isSubHeading) {
      children.push(
        bidiParagraph({
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
        }),
      );
    } else {
      paragraphsSinceLastBreak += 1;
      // Body Text: 18pt font (36 half-points), Right-aligned, RTL continuous flow
      children.push(
        bidiParagraph({
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
        }),
      );
    }
  });

  // =========================================================================
  // 4. References Page (المراجع والمصادر الأكاديمية المتنوعة لكل نسخة - RTL 100%)
  // =========================================================================
  if (includeReferences) {
    children.push(bidiParagraph({ children: [new PageBreak()] }));

    children.push(
      bidiParagraph({
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
      }),
    );

    children.push(
      bidiParagraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 100, after: 200 },
        children: [
          new TextRun({
            text: "تم توثيق واستقاء محتوى هذه النسخة بالرجوع إلى أمهات الكتب والأطروحات الصادرة عن قواعد البيانات والمستودعات الأكاديمية المعتمدة:",
            font: "Arial",
            size: 32, // 16pt
            italics: true,
            rightToLeft: true,
            color: "4B5563",
          }),
        ],
      }),
    );

    // If text already has 3+ reference lines generated by AI or synthesizer, use them!
    if (textRefLines.length >= 3) {
      textRefLines.forEach((refLine) => {
        children.push(
          bidiParagraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 120, after: 160, line: 360 },
            children: [
              new TextRun({
                text: refLine,
                font: "Arial",
                size: 36, // 18pt
                rightToLeft: true,
              }),
            ],
          }),
        );
      });
    } else {
      // Citing diverse sources unique to this version number
      const baseSources =
        sources && sources.length > 0 ? sources : TOP_ARABIC_ACADEMIC_SOURCES;
      const activeSources = getDiverseSourcesForVersion(baseSources, versionNumber || 1, 8);

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
          bidiParagraph({
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
          }),
        );
      });
    }
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
              pageBorderTop: {
                style: BorderStyle.SINGLE,
                size: 12,
                space: 24,
                color: "1E3A8A",
              },
              pageBorderRight: {
                style: BorderStyle.SINGLE,
                size: 12,
                space: 24,
                color: "1E3A8A",
              },
              pageBorderBottom: {
                style: BorderStyle.SINGLE,
                size: 12,
                space: 24,
                color: "1E3A8A",
              },
              pageBorderLeft: {
                style: BorderStyle.SINGLE,
                size: 12,
                space: 24,
                color: "1E3A8A",
              },
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              bidiParagraph({
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
  const safeTopic = topic
    .replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "_")
    .slice(0, 25);
  const versionSuffix = versionNumber ? `_نسخة_${versionNumber}` : "";
  if (typeof window !== "undefined") {
    saveAs(blob, `CopyCat_Research_${safeTopic}${versionSuffix}.docx`);
  }
  return blob;
}
