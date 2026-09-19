import { NextRequest, NextResponse } from "next/server";

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const MAX_REQUESTS_PER_MINUTE = 15;

export interface AcademicAngle {
  id: number;
  name: string;
  focus: string;
  keywords: string[];
}

export interface CustomSourceInput {
  name: string;
  category?: string;
  desc?: string;
  citation?: string;
}

export const ACADEMIC_ANGLES: AcademicAngle[] = [
  {
    id: 1,
    name: "المنظور التحليلي والتطبيقي الميداني",
    focus: "التركيز على النماذج التشغيلية، ومؤشرات قياس الأداء (KPIs)، ودراسات الحالة الميدانية في بيئة العمل الواقعية",
    keywords: ["التطبيق العملي", "الكفاءة التشغيلية", "النماذج الميدانية", "قياس الأداء"],
  },
  {
    id: 2,
    name: "المنظور التأصيلي والنظري والتاريخي",
    focus: "التركيز على الجذور الفكرية، وتطور المدارس والنظريات الكلاسيكية والحديثة، والتأصيل اللغوي والاصطلاحي",
    keywords: ["التأصيل التاريخي", "المدارس الفكرية", "التطور النظري", "المفاهيم التأسيسية"],
  },
  {
    id: 3,
    name: "المنظور التكنولوجي والاستشرافي والتحول الرقمي",
    focus: "التركيز على تطبيقات الذكاء الاصطناعي، وتحليلات البيانات الضخمة، والأتمتة السحابية والابتكار التقني",
    keywords: ["الذكاء الاصطناعي", "التحول الرقمي", "الأتمتة", "استشراف المستقبل"],
  },
  {
    id: 4,
    name: "منظور الحوكمة والسياسات والأطر التنظيمية",
    focus: "التركيز على اللوائح التشريعية، ومعايير الشفافية والمساءلة، وإدارة المخاطر، والالتزام المؤسسي",
    keywords: ["الحوكمة الرشيدة", "الأطر التشريعية", "إدارة المخاطر", "السياسات التنظيمية"],
  },
  {
    id: 5,
    name: "المنظور المقارن والدراسات البينية الدولية",
    focus: "التركيز على مقارنة التجارب المحلية والعربية بنظيراتها العالمية واستخلاص أفضل الممارسات المعتمدة",
    keywords: ["الدراسات المقارنة", "التجارب الدولية", "نقل المعرفة", "المعايير العالمية"],
  },
  {
    id: 6,
    name: "المنظور الاقتصادي ودراسات الجدوى والاستدامة المالية",
    focus: "التركيز على تحليل التكلفة والعائد، وإدارة الموارد الاقتصادية، واستدامة الاستثمار والنمو المالي",
    keywords: ["الجدوى الاقتصادية", "تحليل التكلفة", "تعظيم العائد", "الاستدامة المالية"],
  },
  {
    id: 7,
    name: "المنظور السوسيولوجي والأبعاد المجتمعية والسلوكية",
    focus: "التركيز على الأثر المجتمعي، والثقافة التنظيمية، وإدارة التغيير البشري والرضا العام",
    keywords: ["الأثر المجتمعي", "السلوك المؤسسي", "الثقافة التنظيمية", "إدارة التغيير"],
  },
  {
    id: 8,
    name: "المنظور الاستراتيجي والقيادي وصناعة القرار",
    focus: "التركيز على القيادة التحويلية، والتخطيط بعيد المدى، وتحديد الميزات التنافسية وبناء السيناريوهات",
    keywords: ["القيادة الاستراتيجية", "صناعة القرار", "الميزة التنافسية", "الرؤى المستقبلية"],
  },
  {
    id: 9,
    name: "منظور الجودة الشاملة والاعتماد المؤسسي (ISO)",
    focus: "التركيز على معايير الجودة الشاملة، وبطاقات التقييم، وتدقيق العمليات والتحسين المستمر كايزن",
    keywords: ["إدارة الجودة الشاملة", "الاعتماد الأكاديمي", "معايير الآيزو", "التحسين المستمر"],
  },
  {
    id: 10,
    name: "المنظور المعرفي والبحث والتطوير (R&D)",
    focus: "التركيز على إدارة المعرفة، وإنتاج الأصول الفكرية، وحاضنات الابتكار ودور الجامعات البحثية",
    keywords: ["إدارة المعرفة", "البحث والتطوير", "حاضنات الابتكار", "الملكية الفكرية"],
  },
  {
    id: 11,
    name: "منظور التنمية المستدامة والمسؤولية البيئية (ESG)",
    focus: "التركيز على أهداف التنمية المستدامة للأمم المتحدة، والمسؤولية المجتمعية والمبادرات الخضراء",
    keywords: ["التنمية المستدامة", "المعايير البيئية", "رؤية 2030", "المسؤولية الاجتماعية"],
  },
  {
    id: 12,
    name: "المنظور الإجرائي واللوجستي وهندسة العمليات",
    focus: "التركيز على سلاسل الإمداد، وتدفق الإجراءات، وتبسيط دورة العمل وإلغاء الهدر الإداري",
    keywords: ["سلاسل الإمداد", "هندسة العمليات", "تبسيط الإجراءات", "الكفاءة اللوجستية"],
  },
  {
    id: 13,
    name: "المنظور الاتصالي والإعلامي وبناء الصورة الذهنية",
    focus: "التركيز على قنوات الاتصال الاستراتيجي، والتسويق المعرفي، وبناء السمعة المؤسسية الموثوقة",
    keywords: ["الاتصال المؤسسي", "الصورة الذهنية", "التسويق المعرفي", "إشراك المستفيدين"],
  },
  {
    id: 14,
    name: "المنظور التربوي وتأهيل رأس المال البشري",
    focus: "التركيز على التعليم المستمر، وصقل المهارات الرقمية والمهنية، وإعداد جيل الكفاءات الجديد",
    keywords: ["رأس المال البشري", "صقل المهارات", "التأهيل الأكاديمي", "التطوير المهني"],
  },
  {
    id: 15,
    name: "المنظور النقدي والاستدراكي وحل المشكلات الإبداعي",
    focus: "التركيز على تشخيص الثغرات والقصور في الممارسات الحالية وطرح بدائل وحلول إبداعية خارج الصندوق",
    keywords: ["التحليل النقدي", "معالجة الفجوات", "الحلول الإبداعية", "التفكير التصميمي"],
  },
];

/**
 * High-fidelity academic research synthesizer (Wikipedia / Encyclopedic Architecture)
 * Generates rich, realistic encyclopedic chapters scaling to any page count (including 30-60 pages)
 * with dynamic and randomized heading structures without cliché boilerplate stamps.
 */
function generateAcademicFallback(
  topic: string,
  pages: number,
  includeIntro: boolean,
  includeConclusion: boolean,
  includeRefs: boolean,
  angle?: AcademicAngle,
  customSources?: CustomSourceInput[],
  versionIndex: number = 0
): string {
  const t = topic.trim();
  const currentAngle = angle || ACADEMIC_ANGLES[versionIndex % ACADEMIC_ANGLES.length];
  const paragraphs: string[] = [];

  // Main encyclopedic research title
  paragraphs.push(`دراسة موسوعية وبحث أكاديمي بعنوان: ${t} (${currentAngle.name})\n`);

  if (includeIntro) {
    paragraphs.push(`مقدمة وتمهيد عام:`);
    paragraphs.push(
      `يُمثّل موضوع "${t}" أحد المحاور الحيوية الأكثر تأثيراً في مسارات التطور المعرفي والتطبيقي المعاصر. وتناول هذا البحث ينطلق خصيصاً من (${currentAngle.name})؛ حيث ينصب التركيز والتحليل على: ${currentAngle.focus}. إن دراسة هذا الموضوع تنطلق من إدراك عميق لأثره المباشر في تشكيل الرؤى وتطوير الأدوات المعرفية التي تواكب مستجدات العصر، مع الاستناد إلى قواعد بيانات علمية رصينة ومستودعات أطروحات جامعية معتمدة.`
    );
    paragraphs.push(
      `وتتجسد الإشكالية الجوهرية في استجلاء الأبعاد المتداخلة لـ "${t}" من زاوية (${currentAngle.keywords.join(" و ")}). مع تتبع البدايات والمحددات الإجرائية والتطبيقات الميدانية، ورصد التحديات الراهنة التي تحول دون الاستثمار الأمثل لمخرجاته، وصولاً إلى استشراف مساراته المستقبلية بأسلوب منهجي وصفي تحليلي واستقصائي مقارن يضمن استيعاب كافة المتغيرات المحيطة.`
    );
    paragraphs.push(
      `ويهدف البحث إلى تزويد الباحث والممارس بإطار مرجعي متكامل يتناول المفاهيم الجوهرية والآليات التشغيلية، معتمداً على التأصيل النظري والاستدلال بالنماذج الواقعية والدراسات الميدانية المحكمة، بما يسهم في إثراء المحتوى العلمي بمرجع رصين ومتميز.`
    );
  }

  if (pages <= 5) {
    // 1-5 Pages: 5 Core Encyclopedic Sections
    paragraphs.push(`نظرة عامة والمدخل المفاهيمي لـ (${t}):`);
    paragraphs.push(
      `يُعرّف "${t}" في الأدبيات العلمية والمعاجم التخصصية بأنه نسق متكامل يربط بين الأطر الفكرية والنماذج التطبيقية. وقد تطور هذا المفهوم تدريجياً استجابة لمتطلبات العصر واحتياجات المؤسسات، خاصة فيما يتصل بـ ${currentAngle.focus}.`
    );
    paragraphs.push(
      `وتشير الدراسات التوثيقية إلى أن الفهم الدقيق لـ "${t}" يقتضي استيعاب مقوماته الأساسية وموقعه ضمن منظومة المعرفة الإنسانية والتطبيقية المعاصرة.`
    );

    paragraphs.push(`النشأة التاريخية ومراحل التطور والتحول:`);
    paragraphs.push(
      `شهدت مسيرة "${t}" محطات فارقة؛ حيث انطلقت من بدايات تأسيسية محدودة تبلورت عبر إسهامات نخبة من الرواد، وصولاً إلى مرحلة التأطير المؤسسي، ثم القفزة الرقمية والتكنولوجية المعاصرة التي أعادت صياغة الأولويات وفتحت آفاقاً واسعة للابتكار.`
    );

    paragraphs.push(`المقومات الجوهرية والآليات التشغيلية:`);
    paragraphs.push(
      `تقوم بنية "${t}" على حزمة من الركائز المتكاملة تشمل: الكفاءات البشرية، السياسات والإجراءات الواضحة، البنية التقنية الداعمة، ومعايير الجودة والحوكمة. ويعتمد الأداء الفعال على التناغم بين هذه المكونات لضمان تحقيق أعلى معدلات الكفاءة والاستدامة.`
    );

    paragraphs.push(`النماذج التطبيقية والتجارب الميدانية الواقعية:`);
    paragraphs.push(
      `تسلط دراسات الحالة الموثقة في بنك المعرفة وقواعد البيانات العربية الضوء على نماذج رائدة استثمرت مبادئ "${t}" بنجاح، مما أسهم في تحسين الإنتاجية، وترشيد الموارد، وابتكار حلول عملية لمعضلات معقدة في بيئات العمل المختلفة.`
    );

    paragraphs.push(`التحديات الراهنة واستشراف المسارات المستقبلية:`);
    paragraphs.push(
      `على الرغم من المكتسبات، تواجه مسيرة "${t}" تحديات تتعلق بمقاومة التغيير، ونقص الموارد، وسرعة التحولات التكنولوجية. ومع ذلك، يفتح الذكاء الاصطناعي والأتمتة السحابية آفاقاً غير مسبوقة لبناء نماذج مستقبلية أكثر مرونة واستجابة للمتغيرات العالمية.`
    );
  } else {
    // 6-60 Pages: Comprehensive, In-Depth Encyclopedic Sections (scaling up to 30 pages!)
    const encyclopedicHeadings = [
      `المدخل الموسوعي والإطار المفاهيمي لـ (${t})`,
      `الجذور والنشأة التاريخية وتطور الظاهرة عبر الحقب المختلفة`,
      `الأسس العلمية والمدارس الفكرية الرائدة في دراسة (${t})`,
      `العلاقات المعرفية والصلات البينية مع العلوم الحديثة`,
      `الركائز الهيكلية والمكونات التنظيمية والتشغيلية`,
      `الأطر التشريعية والسياسات العامة ومعايير الجودة المعتمدة`,
      `المؤشرات الإحصائية ومقاييس تقييم كفاءة الأداء (KPIs)`,
      `التطبيقات الميدانية ودراسات الحالة الواقعية في البيئة العربية`,
      `الأبعاد الاقتصادية والجدوى التنموية والاستثمارية لـ (${t})`,
      `الأثر المجتمعي والأبعاد السلوكية والثقافية المحيطة`,
      `المعوقات والتحديات التشغيلية والإدارية والمالية الراهنة`,
      `المقارنات الدولية وأفضل الممارسات العالمية المعيارية`,
      `الابتكار التكنولوجي وتطبيقات الذكاء الاصطناعي في مجالات (${t})`,
      `خارطة طريق تنفيذية مقترحة للتطوير المستدام والريادة`,
      `الرؤى الاستشرافية والسيناريوهات المستقبلية المتوقعة حتى 2030`,
    ];

    // Reorder and randomize headings for diverse copies
    const offset = versionIndex % encyclopedicHeadings.length;
    const reorderedHeadings = [
      encyclopedicHeadings[0], // Concept
      encyclopedicHeadings[1], // History
      ...encyclopedicHeadings.slice(2, -2).sort((a, b) => {
        const hashA = (a.length + offset * 7) % 10;
        const hashB = (b.length + offset * 7) % 10;
        return hashA - hashB;
      }),
      encyclopedicHeadings[encyclopedicHeadings.length - 2],
      encyclopedicHeadings[encyclopedicHeadings.length - 1],
    ];

    reorderedHeadings.forEach((heading, idx) => {
      paragraphs.push(`${idx + 1}. ${heading}:`);
      paragraphs.push(
        `تكتسب مباحث "${heading}" أهمية بالغة عند تناول موضوع "${t}" من زاوية (${currentAngle.name})؛ حيث ينعكس أثرها المباشر في تعميق الرؤية وتفكيك الإشكاليات المعقدة المرتبطة بـ ${currentAngle.focus}.`
      );
      paragraphs.push(
        `وتكشف القراءات التحليلية المعمقة المستندة إلى قواعد بيانات "دار المنظومة" و"المكتبة الرقمية السعودية" ومستودعات أطروحات "جامعة القاهرة" و"عين شمس" عن تمايز التجارب الميدانية وتنوع مناهج المعالجة العلمية لهذا المحور، مما يؤكد الطبيعة الديناميكية المتجددة لـ "${t}".`
      );
      paragraphs.push(
        `ويبرز التحليل المقارن أن التوظيف المنهجي لمحددات (${currentAngle.keywords.join("، ")}) ضمن هذا السياق يسهم في سد الفجوات التنظيمية وبناء حلول ابتكارية مستدامة تضمن تحقيق أعلى عوائد ممكنة على الصعيدين النظري والتطبيقي.`
      );
      if (pages >= 15) {
        paragraphs.push(
          `وعلى صعيد النماذج العملية، يُظهر الرصد الميداني أن المؤسسات التي تبنت استراتيجيات مرنة قائمة على البيانات الدقيقة والمتابعة التقييمية المستمرة تمكنت من تجاوز العقبات التقليدية وتحقيق قفزات نوعية في مؤشرات التنافسية والجودة الشاملة.`
        );
      }
    });
  }

  if (includeConclusion) {
    paragraphs.push(`خاتمة واستنتاجات وتوصيات تنفيذية:`);
    paragraphs.push(
      `في ختام هذه الدراسة الموسوعية الشاملة والمستفيضة لموضوع "${t}"، تبرز حزمة من الحقائق والاستنتاجات الجوهرية؛ أولها أن "${t}" لم يعد مجرد خيار إجرائي، بل غدا محركاً استراتيجياً للتحديث والتطوير الشامل.`
    );
    paragraphs.push(
      `واستناداً إلى النتائج المستخلصة، يُوصى بما يلي: أولاً، مأسسة برامج البحث والتطوير الموجهة لـ "${t}". ثانياً، تعزيز التكامل بين المؤسسات الأكاديمية والقطاعات التنفيذية. ثالثاً، التوسع في توظيف التقنيات الذكية والأتمتة لضمان كفاءة المخرجات واستدامتها على المدى الطويل.`
    );
  }

  if (includeRefs) {
    paragraphs.push(`قائمة المصادر والمراجع الأكاديمية المعتمدة:`);
    if (customSources && customSources.length > 0) {
      customSources.forEach((s, idx) => {
        paragraphs.push(
          `${idx + 1}. ${s.name}${s.category ? ` (${s.category})` : ""} - دراسات وبحوث متخصصة في (${t})، ${s.citation || s.desc || "توثيق معتمد 2024"}.`
        );
      });
    } else {
      paragraphs.push(`1. بنك المعرفة المصري (Egyptian Knowledge Bank - EKB) - البوابة الأكاديمية للدوريات العلمية المحكمة، أبحاث متخصصة في (${t})، القاهرة، 2024.`);
      paragraphs.push(`2. قاعدة بيانات دار المنظومة (Dar Al Mandumah) - قواعد معلومات الرسائل والمجلات المحكمة، أبحاث (${t})، الرياض، 2023.`);
      paragraphs.push(`3. شبكة المعلومات العربية التربوية (شمعة - Shamaa) - مستودع البحوث والدراسات في 22 دولة عربية، بيروت، 2024.`);
      paragraphs.push(`4. المكتبة الرقمية السعودية (Saudi Digital Library - SDL) - أبحاث ودراسات موسوعية في (${t})، الرياض، 2023.`);
      paragraphs.push(`5. مستودع الأطروحات والرسائل العلمية لجامعة القاهرة وجامعة عين شمس - رسائل الماجستير والدكتوراه المحكمة في (${t})، 2023.`);
      paragraphs.push(`6. البوابة الجزائرية للمجلات العلمية (ASJP) - الدوريات والمجلات العلمية المحكمة في العلوم التطبيقية والإنسانية، الجزائر، 2024.`);
      paragraphs.push(`7. الفهرس العربي الموحد (ARUC) ومكتبة الملك فهد الوطنية - السجل الببليوجرافي الموحد للإنتاج الفكري، الرياض، 2023.`);
      paragraphs.push(`8. الباحث العلمي العربي من Google (Google Scholar Arabic Index) - مؤشر الأبحاث الأكثر استشهاداً في (${t})، 2024.`);
      paragraphs.push(`9. اتحاد الجامعات العربية ومجمع اللغة العربية بالقاهرة - مجلة البحوث العلمية والدراسات التخصصية، 2023.`);
      paragraphs.push(`10. دوريات مركز دراسات الوحدة العربية وجامعة الأزهر الشريف - دراسات فكرية واستراتيجية متقدمة في (${t})، 2024.`);
    }
  }

  return paragraphs.join("\n\n");
}

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "anonymous";
    const now = Date.now();
    const clientLimit = rateLimitMap.get(ip);

    if (clientLimit && now < clientLimit.resetTime) {
      if (clientLimit.count >= MAX_REQUESTS_PER_MINUTE) {
        return NextResponse.json(
          { error: "تم تجاوز الحد الأقصى للطلبات مؤقتاً. يرجى الانتظار دقيقة قبل المحاولة مجدداً." },
          { status: 429 }
        );
      }
      clientLimit.count += 1;
    } else {
      rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
    }

    // 2. Parse & Validate Payload
    const body = await req.json().catch(() => ({}));
    const {
      topic,
      targetPages = 5,
      includeIntro = true,
      includeConclusion = true,
      includeRefs = true,
      customDetails = "",
      versionsCount = 1,
      customSources = [],
    } = body;

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return NextResponse.json({ error: "من فضلك أدخل عنوان البحث المطلوب" }, { status: 400 });
    }

    const sanitizedTopic = topic.trim().slice(0, 300);
    const numPages = Math.max(1, Math.min(60, Number(targetPages) || 5));
    const targetWords = numPages * 320;
    const count = Math.max(1, Math.min(15, Number(versionsCount) || 1));

    // Determine random starting angle offset so repeat queries on different days yield different angles
    const randomStartOffset = Math.floor(Math.random() * ACADEMIC_ANGLES.length);

    // Format active sources text for prompt
    let sourcesText = "";
    if (Array.isArray(customSources) && customSources.length > 0) {
      sourcesText =
        "قائمة المصادر وقواعد البيانات البحثية المعتمدة للتوثيق والاستشهاد بالبحث:\n" +
        customSources
          .map(
            (s: CustomSourceInput, i: number) =>
              `${i + 1}. ${s.name}${s.category ? ` (${s.category})` : ""}${s.desc ? ` - ${s.desc}` : ""}`
          )
          .join("\n");
    } else {
      sourcesText = `
أهم مصادر وقواعد بيانات بحثية وأكاديمية باللغة العربية معتمدة للتوثيق والاستشهاد:
1. بنك المعرفة المصري (Egyptian Knowledge Bank - EKB)
2. قواعد بيانات دار المنظومة (Dar Al Mandumah)
3. شبكة المعلومات العربية التربوية (شمعة - Shamaa)
4. المكتبة الرقمية السعودية (SDL) ومستودعات أطروحات الجامعات السعودية والخليجية
5. مستودع الأطروحات والرسائل العلمية لجامعة القاهرة وجامعة عين شمس
6. البوابة الجزائرية للمجلات العلمية (ASJP)
7. الفهرس العربي الموحد (ARUC) ومكتبة الملك فهد الوطنية
8. الباحث العلمي العربي من Google (Google Scholar Arabic Index)
9. اتحاد الجامعات العربية ومجمع اللغة العربية بالقاهرة
10. دوريات مركز دراسات الوحدة العربية وجامعة الأزهر الشريف
`;
    }

    // Helper to build prompt for a specific academic angle with Wikipedia-style architecture
    const buildPromptForAngle = (angle: AcademicAngle, versionNum: number) => {
      const sectionCount = Math.max(5, Math.min(16, Math.round(numPages * 0.45) + 3));

      return `أنت أستاذ أكاديمي وباحث ومحرر موسوعي متخصص. اكتب بحثاً دراسياً وأكاديمياً وموسوعياً متميزاً ومفصلاً باللغة العربية الفصحى حول موضوع: (${sanitizedTopic}).

منظور التناول الأكاديمي لهذه النسخة المحددة (نسخة رقم ${versionNum}):
[${angle.name}]
المحور الجوهري: ${angle.focus}
الكلمات الدالة: ${angle.keywords.join("، ")}.

القواعد الذهبية لنظام العناوين والمحتوى (أسلوب المقالات الموسوعية الكبرى وويكيبيديا):
1. ممنوع منعاً باتاً استخدام أسطامبة "المبحث الأول" أو "المبحث الثاني" أو "الفصل الأول" أو "الفصل الثاني".
2. استخرج وصِغ عناوين فرعية موضوعية حقيقية غنية ومباشرة نابعة من صلب موضوع (${sanitizedTopic}) ومنظور (${angle.name})، تماماً كما في الموسوعات الأكاديمية وويكيبيديا المحكمة (مثل: "النشأة التاريخية وتطور الظاهرة"، "الأسس والمبادئ النظرية الحاكمة"، "المكونات والعناصر الجوهرية"، "الآليات الميدانية ونماذج التطبيق"، "التحديات والمخاطر الراهنة"، "المقارنات الدولية المعيارية"، "استشراف المستقبل والتحول التقني والذكاء الاصطناعي"، "إحصائيات ومؤشرات قياس الأداء").
3. الترتيب والتنويع العشوائي بين النسخ: اجعل هذه النسخة (رقم ${versionNum}) مختلفة تماماً في ترتيب المحاور، صياغة العناوين، زوايا التحليل، والأمثلة المطروحة، بحيث إذا تم طلب عدة نسخ لنفس الموضوع تكون كل نسخة مستقلة ومتفردة بهيكلها ومحتواها.
4. مقياس التوسع والعمق لـ (${numPages}) صفحة (المستهدف حوالي ${targetWords} كلمة باللغة العربية الفصحى):
   اكتب بحثاً موسعاً ومستفيضاً جداً يغطي ما لا يقل عن (${sectionCount}) عناوين موسوعية رئيسية متسلسلة، وتحت كل عنوان اكتب عدة فقرات تفصيلية، شروحات علمية، دراسات مقارنة، وأرقام واقتباسات دقيقة.
5. ${sourcesText}
${customDetails && customDetails.trim() ? `شروط وملاحظات وتفاصيل خاصة مطلوبة بالبحث:\n${customDetails.trim()}\n` : ""}

قواعد إخراج النص:
- ابدأ بنص البحث فوراً دون أي تحيات أو مقدمات من الذكاء الاصطناعي.
- العنوان الرئيسي: "بحث موسوعي ودراسة شاملة بعنوان: ${sanitizedTopic} (${angle.name})".
- اجعل العناوين الفرعية واضحة في سطور مستقلة تنتهي بنقطتين (مثل: "النشأة التاريخية والمراحل التأسيسية:").
- أنهِ البحث بخاتمة تتضمن الاستنتاجات والتوصيات، وقائمة المصادر والمراجع الأكاديمية.
- لا تستخدم علامات ماركداون معقدة (# أو ***).`;
    };

    // Helper for fetch with timeout
    const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 25000) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return res;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    };

    // Helper to generate text from Gemini / Groq for a given prompt
    const callAIWithPrompt = async (prompt: string): Promise<{ text: string | null; provider: string }> => {
      // 1. Gemini
      let geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        try {
          const fs = await import("fs");
          const path = await import("path");
          const envPath = path.join(process.cwd(), ".env.local");
          if (fs.existsSync(envPath)) {
            const match = fs.readFileSync(envPath, "utf-8").match(/GEMINI_API_KEY=([^\r\n]+)/);
            if (match) geminiKey = match[1].trim();
          }
        } catch {}
      }

      if (geminiKey && geminiKey.length > 10 && !geminiKey.includes("placeholder")) {
        const geminiModels = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.5-pro"];
        for (const model of geminiModels) {
          try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
            const resp = await fetchWithTimeout(geminiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 16384 },
              }),
            }, 30000);

            if (resp.ok) {
              const data = await resp.json();
              const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (candidate && candidate.trim().length > 150) {
                return { text: candidate, provider: `Google Gemini (${model})` };
              }
            }
          } catch {}
        }
      }

      // 2. Groq
      const groqKey = process.env.GROQ_API_KEY;
      if (groqKey && groqKey.startsWith("gsk_")) {
        try {
          const groqUrl = "https://api.groq.com/openai/v1/chat/completions";
          const resp = await fetchWithTimeout(groqUrl, {
            method: "POST",
            headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [{ role: "user", content: prompt }],
              temperature: 0.7,
              max_tokens: 6000,
            }),
          }, 8000);

          if (resp.ok) {
            const data = await resp.json();
            const choice = data?.choices?.[0]?.message?.content;
            if (choice && choice.trim().length > 150) {
              return { text: choice, provider: "Groq (llama-3.3-70b)" };
            }
          }
        } catch {}
      }

      // 3. Pollinations.ai (Free Tier Fallback)
      try {
        const pollinationsUrl = "https://text.pollinations.ai/";
        const resp = await fetchWithTimeout(pollinationsUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }],
            model: "openai",
            seed: Math.floor(Math.random() * 10000),
          }),
        }, 8000);

        if (resp.ok) {
          const text = await resp.text();
          if (text && text.trim().length > 150) {
            return { text, provider: "Pollinations.ai (OpenAI)" };
          }
        }
      } catch {}

      return { text: null, provider: "Fallback Synthesizer" };
    };

    // 4. Generate the requested number of versions
    const versions: Array<{
      versionNumber: number;
      angle: AcademicAngle;
      content: string;
      provider: string;
      wordCount: number;
      estimatedPages: number;
    }> = [];

    for (let i = 0; i < count; i++) {
      const angleIndex = (randomStartOffset + i) % ACADEMIC_ANGLES.length;
      const angle = ACADEMIC_ANGLES[angleIndex];
      const versionNum = i + 1;
      const prompt = buildPromptForAngle(angle, versionNum);

      const aiResult = await callAIWithPrompt(prompt);

      let finalContent = aiResult.text;
      let finalProvider = aiResult.provider;

      if (!finalContent || finalContent.trim().length < 150) {
        finalContent = generateAcademicFallback(
          sanitizedTopic,
          numPages,
          includeIntro,
          includeConclusion,
          includeRefs,
          angle,
          customSources,
          i
        );
        finalProvider = "محرك التوليد الأكاديمي الموسوعي (Copy-Cat Core Synthesizer)";
      }

      const words = finalContent.trim().split(/\s+/).filter(Boolean).length;
      const pagesCalc = Math.max(1, Math.round(words / 320));

      versions.push({
        versionNumber: versionNum,
        angle,
        content: finalContent,
        provider: finalProvider,
        wordCount: words,
        estimatedPages: pagesCalc,
      });
    }

    return NextResponse.json({
      success: true,
      topic: sanitizedTopic,
      targetPages: numPages,
      versions,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "حدث خطأ غير متوقع أثناء توليد البحث";
    console.error("API /api/research error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
